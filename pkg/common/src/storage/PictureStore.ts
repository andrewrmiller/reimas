import amqp from 'amqplib';
import createDebug from 'debug';
import createHttpError from 'http-errors';
import sizeOf from 'image-size';
import * as util from 'util';
import { v1 as createGuid } from 'uuid';
import {
  PictureExtension,
  PictureMimeType,
  VideoExtension,
  VideoMimeType
} from '../FileTypes';
import { HttpStatusCode } from '../httpConstants';
import { IRecalcFolderMsg, IResizePictureMsg, MessageType } from '../messages';
import { Paths } from '../Paths';
import { ThumbnailSize } from '../thumbnails';
import { JobsChannelName } from '../workers';
import { DbFactory } from './db/DbFactory';
import { FileSystemFactory } from './files/FileSystemFactory';
import {
  IFile,
  IFileAdd,
  IFileUpdate,
  IFolderAdd,
  IFolderUpdate,
  ILibraryAdd,
  ILibraryUpdate
} from './models';

const debug = createDebug('storage:picturestore');
const sizeOfPromise = util.promisify(sizeOf);

enum FormatSupportStatus {
  NotSupported = 0,
  IsSupportedPicture = 1,
  IsSupportedVideo = 2
}

const RabbitUrl = 'amqp://localhost';

/**
 * Service which wraps the database and the file system to
 * provide a single picture storage facade.
 */
export class PictureStore {
  /**
   * Retrieves a list of the libraries in the system.
   */
  public static getLibraries() {
    const db = DbFactory.createInstance();
    return db.getLibraries();
  }

  /**
   * Retrieves the details for a specific library.
   *
   * @param libraryId Unique ID of the library.
   */
  public static getLibrary(libraryId: string) {
    const db = DbFactory.createInstance();
    return db.getLibrary(libraryId);
  }

  /**
   * Adds a new library to the service.
   *
   * @param add Library creation information.
   */

  public static addLibrary(add: ILibraryAdd) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // Create a GUID and use that as the unique ID of the folder
    // and also the name of the folder in the file system.  This avoids
    // naming conflicts in the filesystem.
    add.libraryId = createGuid();
    debug(`Generated ID ${add.libraryId} for new library ${add.name}`);

    // Create the library folder on disk first.
    return fs.createFolder(add.libraryId).then(() => {
      // Now add the library to the database.
      return db.addLibrary(add).catch(err => {
        // Failed to add it to the database.  Make an attempt to
        // remove the file system folder that we just created.
        debug(`ERROR: Create library failed for library ${add.name}`);
        debug('Folder was created in file system but database insert failed.');
        fs.deleteFolder(add.name);
        throw err;
      });
    });
  }

  /**
   * Updates an existing library.
   *
   * @param libraryId Unique ID of the library to update.
   * @param update Information to update on the library.
   */
  public static updateLibrary(libraryId: string, update: ILibraryUpdate) {
    const db = DbFactory.createInstance();
    return db.updateLibrary(libraryId, update);
  }

  /**
   * Deletes an existing library.
   *
   * @param libraryId Unique ID of the library to delete.
   */
  public static deleteLibrary(libraryId: string) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // Delete the library in the database first.
    return db.deleteLibrary(libraryId).then(result => {
      // Now try to delete the library folder in the file system.
      return fs
        .deleteFolder(libraryId)
        .then(() => {
          // Return the result from the database delete.
          return result;
        })
        .catch(err => {
          debug(`ERROR: Delete library failed for library ${libraryId}`);
          debug(`Library was deleted in db but file system delete failed.`);
          debug(`Library folder '${libraryId}' may need to be cleaned up.`);
          throw err;
        });
    });
  }

  /**
   * Retrieves a list of folders in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param parent Unique ID of the parent folder,
   *
   * NOTE: Pass unknown for parent to get list of root folders.
   */
  public static getFolders(libraryId: string, parent?: string) {
    const db = DbFactory.createInstance();
    return db.getFolders(libraryId, parent ? parent : null);
  }

  /**
   * Retrieves a specific folder in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   */
  public static getFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.getFolder(libraryId, folderId);
  }

  /**
   * Adds a new folder to an existing library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param add Information about the new folder.
   */
  public static addFolder(libraryId: string, add: IFolderAdd) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // Grab some information about the parent folder first.
    return db.getFolder(libraryId, add.parentId!).then(parent => {
      // Create the folder in the file system first.
      const fileSystemPath = `${libraryId}/${parent.path}/${add.name}`;
      return fs.createFolder(fileSystemPath).then(() => {
        // Now create the folder in the database.
        return db.addFolder(libraryId, add).catch(err => {
          // We failed to create the folder in the file system.  Try to
          // remove the folder that we created in the database.
          debug(`ERROR: Create folder failed for folder ${add.name}.`);
          debug(`Folder was created in the file system but not in db.`);
          debug(`Attempting to delete the folder in the file systme.`);
          fs.deleteFolder(fileSystemPath);
          throw err;
        });
      });
    });
  }

  /**
   * Updates an existing folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder to update.
   * @param update Information to update.
   */
  public static updateFolder(
    libraryId: string,
    folderId: string,
    update: IFolderUpdate
  ) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    return db.getFolder(libraryId, folderId).then(folder => {
      const fileSystemPath = `${libraryId}/${folder.path}`;
      return fs.renameFolderOrFile(fileSystemPath, update.name!).then(() => {
        return db.updateFolder(libraryId, folderId, update).catch(err => {
          debug(`ERROR: Patching folder ${folderId} failed.`);
          const newPath = Paths.replaceLastSubpath(
            fileSystemPath,
            update.name!
          );
          debug(`Attempting to revert ${newPath} to ${folder.name}.`);
          fs.renameFolderOrFile(newPath, folder.name);
          throw err;
        });
      });
    });
  }

  /**
   * Deletes an existing folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder to delete.
   */
  public static deleteFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // Grab the folder info first and then delete the folder in the database.
    return db.getFolder(libraryId, folderId).then(folder => {
      return db.deleteFolder(libraryId, folderId).then(result => {
        // Now try to delete the folder in the file system.
        return fs
          .deleteFolder(`${libraryId}/${folder.path}`)
          .then(() => {
            // Return the result from the database delete.
            return result;
          })
          .catch(err => {
            debug(`ERROR: Delete folder failed for folder ${folder.path}.`);
            debug(`Folder was deleted in db but file system delete failed.`);
            debug(`Folder may need to be cleaned up.`);
            throw err;
          });
      });
    });
  }

  /**
   * Recalculates the statistics on a folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   */
  public static recalcFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.recalcFolder(libraryId, folderId).then(folder => {
      if (folder.parentId) {
        PictureStore.enqueueRecalcFolderJob(folder.libraryId, folder.parentId);
      }
      return folder;
    });
  }

  /**
   * Gets a value which indicates if the local file system is
   * being used for file storage.
   */
  public static isLocalFileSystem() {
    return true;
  }

  /**
   * Retrieves a list of files in a library folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the parent folder.
   */
  public static getFiles(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.getFiles(libraryId, folderId);
  }

  /**
   * Retrieves the metadata for a specific file in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   */
  public static getFile(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    return db.getFile(libraryId, fileId);
  }

  /**
   * Retrieves the contents for a specific file in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   */
  public static getFileContents(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    return db.getFileContentInfo(libraryId, fileId).then(info => {
      return fs.readFile(`${libraryId}/${info.path}`).then(buffer => {
        return {
          buffer,
          mimeType: info.mimeType
        };
      });
    });
  }

  /**
   * Imports a file into a folder in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the parent folder.
   * @param localPath Local path of the file to import.
   * @param filename Target name of the file in the library.
   * @param mimeType Mime type of the file.
   * @param fileSize Size of the file in bytes.
   */
  public static importFile(
    libraryId: string,
    folderId: string,
    localPath: string,
    filename: string,
    mimeType: string,
    fileSize: number
  ) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    return sizeOfPromise(localPath)
      .then(imageInfo => {
        // File was recognized as an image file.  See if we support it.
        const supportStatus = PictureStore.getExtSupportStatus(
          imageInfo.type.toLowerCase()
        );

        if (supportStatus === FormatSupportStatus.NotSupported) {
          throw createHttpError(
            HttpStatusCode.BAD_REQUEST,
            `Invalid file type: ${imageInfo.type}`
          );
        }

        return db.getFolder(libraryId, folderId).then(folder => {
          return fs
            .importFile(localPath, `${libraryId}/${folder.path}/${filename}`)
            .then(filenameUsed => {
              // File has been impmorted into the file system.  Now
              // create a row in the database with the file's metadata.
              return db
                .addFile(libraryId, folderId, {
                  name: filenameUsed,
                  mimeType,
                  isVideo:
                    supportStatus === FormatSupportStatus.IsSupportedVideo,
                  height: imageInfo.height,
                  width: imageInfo.width,
                  fileSize,
                  isProcessing: true
                } as IFileAdd)
                .then(file => {
                  return PictureStore.enqueueFileJobs(file);
                });
            });
        });
      })
      .catch(err => {
        if (err.status) {
          throw err;
        } else {
          throw createHttpError(
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            err.message
          );
        }
      });
  }

  /**
   * Imports a thumbnail for an existing file in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   * @param thumbSize Size of the thumbnail (sm, md or lg).
   * @param fileSize Size of the thumbnail file in bytes.
   */
  public static importThumbnail(
    libraryId: string,
    fileId: string,
    thumbSize: ThumbnailSize,
    localPath: string,
    fileSize: number
  ) {
    debug(
      `Importing ${thumbSize} thumbnail for file ${fileId} in library ${libraryId}.`
    );

    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    return db.getFileContentInfo(libraryId, fileId).then(fileInfo => {
      const pictureFolder = Paths.deleteLastSubpath(fileInfo.path);
      const thumbnailFolder = `${libraryId}/${pictureFolder}/tn_${thumbSize}`;
      const thumbnailFilename = Paths.changeFileExtension(
        fileInfo.name,
        PictureExtension.Jpg
      );

      return fs
        .createFolder(thumbnailFolder)
        .then(() => {
          return fs
            .importFile(localPath, `${thumbnailFolder}/${thumbnailFilename}`)
            .then(filenameUsed => {
              // File has been impmorted into the file system.  Now
              // create a row in the database with the file's metadata.
              return db
                .updateFileThumbnail(libraryId, fileId, thumbSize, fileSize)
                .then(file => {
                  return PictureStore.enqueueRecalcFolderJob(
                    libraryId,
                    fileInfo.folderId
                  );
                });
            });
        })
        .catch(err => {
          if (err.status) {
            throw err;
          } else {
            debug(`Error importing thumbnail: ${err}`);
            throw createHttpError(
              HttpStatusCode.INTERNAL_SERVER_ERROR,
              err.message
            );
          }
        });
    });
  }

  /**
   * Updates a file in a library folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file to update.
   * @param update Information to update on the file.
   */
  public static updateFile(
    libraryId: string,
    fileId: string,
    update: IFileUpdate
  ) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // If name is changing, rename file on disk first, then update
    // the database. Othwerise just update the database since all
    // other updates are metadata only.
    if (update.name) {
      return db.getFileContentInfo(libraryId, fileId).then(info => {
        if (!PictureStore.areExtensionsEqual(info.name, update.name!)) {
          throw createHttpError(
            HttpStatusCode.BAD_REQUEST,
            'Invalid operation.  File extensions must match.'
          );
        }

        const fileSystemPath = `${libraryId}/${info.path}`;
        return fs.renameFolderOrFile(fileSystemPath, update.name!).then(() => {
          return db.updateFile(libraryId, fileId, update).catch(err => {
            debug(`ERROR: Patching file ${fileId} failed.`);
            const newPath = Paths.replaceLastSubpath(
              fileSystemPath,
              update.name!
            );
            debug(`Attempting to revert ${newPath} to ${info.name}.`);
            fs.renameFolderOrFile(newPath, info.name);
            throw err;
          });
        });
      });
    } else {
      return db.updateFile(libraryId, fileId, update);
    }
  }

  public static deleteFile(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    // Grab the file info first and then delete the file in the database.
    return db.getFileContentInfo(libraryId, fileId).then(file => {
      return db.deleteFile(libraryId, fileId).then(result => {
        // Now try to delete the file in the file system.
        return fs
          .deleteFile(`${libraryId}/${file.path}`)
          .then(() => {
            PictureStore.enqueueRecalcFolderJob(file.libraryId, file.folderId);
            // Return the result from the database delete.
            return result;
          })
          .catch(err => {
            debug(`ERROR: Delete file failed for folder ${file.path}.`);
            debug(`File was deleted in db but file system delete failed.`);
            debug(`File may need to be cleaned up.`);
            throw err;
          });
      });
    });
  }

  /**
   * Retrieves the path to the file in the local file system.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   */
  public static getLocalFilePath(libraryId: string, fileId: string) {
    debug(`Getting local path to file ${fileId} in library ${libraryId}`);

    const db = DbFactory.createInstance();
    const fs = FileSystemFactory.createInstance();

    return db
      .getFileContentInfo(libraryId, fileId)
      .then(info => {
        return fs.getFilePath(`${libraryId}/${info.path}`);
      })
      .catch(err => {
        debug(`Error: getLocalFilePath: ${err}`);
        throw err;
      });
  }

  private static enqueueRecalcFolderJob(libraryId: string, folderId: string) {
    PictureStore.enqueue(ch => {
      debug('Publishing recalc folder message.');
      const message: IRecalcFolderMsg = {
        type: MessageType.RecalcFolder,
        libraryId,
        folderId
      };
      if (
        !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
      ) {
        throw new Error('Failed to enqueue recalc folder message.');
      }
      return null;
    });
  }

  private static enqueueFileJobs(file: IFile) {
    return PictureStore.enqueue(ch => {
      debug('Publishing thumbnail creation jobs.');
      PictureStore.postResizeMessage(
        ch,
        file.libraryId,
        file.fileId,
        ThumbnailSize.Small
      );
      PictureStore.postResizeMessage(
        ch,
        file.libraryId,
        file.fileId,
        ThumbnailSize.Medium
      );
      PictureStore.postResizeMessage(
        ch,
        file.libraryId,
        file.fileId,
        ThumbnailSize.Large
      );
      return file;
    });
  }

  private static postResizeMessage(
    ch: amqp.Channel,
    libraryId: string,
    fileId: string,
    size: ThumbnailSize
  ) {
    const message: IResizePictureMsg = {
      type: MessageType.ResizePicture,
      libraryId,
      fileId,
      size
    };

    if (
      !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
    ) {
      throw new Error('Failed to enqueue resize picture message.');
    }
  }

  private static enqueue(callback: (ch: amqp.Channel) => any) {
    debug('Connecting to RabbitMQ server...');
    return amqp
      .connect(RabbitUrl)
      .then(conn => {
        debug('Creating RabbitMQ channel and asserting the queue...');
        return conn.createChannel().then(ch => {
          return ch.assertQueue(JobsChannelName).then(() => {
            return callback(ch);
          });
        });
      })
      .catch(err => {
        debug('Error while communicating with RabbitMQ: ' + err);
        throw err;
      });
  }

  /**
   * Returns a value which indicates if the specified mime
   * type is supported by the service.
   *
   * @param mimeType The type of file to check.
   */
  private static getSupportStatus(mimeType: string) {
    if (PictureStore.isSupportedPicture(mimeType)) {
      return FormatSupportStatus.IsSupportedPicture;
    } else if (PictureStore.isSupportedVideo(mimeType)) {
      return FormatSupportStatus.IsSupportedVideo;
    } else {
      debug(`Rejecting invalid file type: ${mimeType}`);
      return FormatSupportStatus.NotSupported;
    }
  }

  private static isSupportedPicture(mimeType: string) {
    return (
      mimeType === PictureMimeType.Jpeg ||
      mimeType === PictureMimeType.Png ||
      mimeType === PictureMimeType.Gif ||
      mimeType === PictureMimeType.Tif ||
      mimeType === PictureMimeType.Tiff
    );
  }

  private static isSupportedVideo(mimeType: string) {
    return (
      mimeType === VideoMimeType.MP4 ||
      mimeType === VideoMimeType.MOV ||
      mimeType === VideoMimeType.WMV ||
      mimeType === VideoMimeType.AVI
    );
  }

  /**
   * Returns the extension portion of the given filename.
   *
   * @param file Filename to inspect.
   */
  private static getFileExtension(file: string) {
    const index = file.lastIndexOf('.');
    if (index < 0) {
      throw createHttpError(HttpStatusCode.BAD_REQUEST, 'Invalid argument');
    }

    return file.substr(index);
  }

  /**
   * Returns true if the extensions on the two files are the same.
   *
   * @param file1 First file to compare.
   * @param file2 Second file to compare.
   */
  private static areExtensionsEqual(file1: string, file2: string) {
    return (
      PictureStore.getFileExtension(file1).toLowerCase() ===
      PictureStore.getFileExtension(file2).toLowerCase()
    );
  }

  /**
   * Returns a value which indicates if the specified extension
   * is supported by the service.
   *
   * @param ext The type of file to check.
   */
  private static getExtSupportStatus(ext: string) {
    if (PictureStore.isExtSupportedPicture(ext)) {
      return FormatSupportStatus.IsSupportedPicture;
    } else if (PictureStore.isExtSupportedVideo(ext)) {
      return FormatSupportStatus.IsSupportedVideo;
    } else {
      debug(`Rejecting invalid file type: ${ext}`);
      return FormatSupportStatus.NotSupported;
    }
  }

  private static isExtSupportedPicture(ext: string) {
    return (
      ext === PictureExtension.Jpeg ||
      ext === PictureExtension.Jpg ||
      ext === PictureExtension.Png ||
      ext === PictureExtension.Gif ||
      ext === PictureExtension.Tif ||
      ext === PictureExtension.Tiff
    );
  }

  private static isExtSupportedVideo(ext: string) {
    return (
      ext === VideoExtension.MP4 ||
      ext === VideoExtension.MOV ||
      ext === VideoExtension.WMV ||
      ext === VideoExtension.AVI
    );
  }
}

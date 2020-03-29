import {
  IFile,
  IFileAdd,
  IFileUpdate,
  IFolderAdd,
  IFolderUpdate,
  IFolderUserAdd,
  ILibraryAdd,
  ILibraryUpdate,
  ThumbnailSize
} from '@picstrata/client';
import amqp from 'amqplib';
import config from 'config';
import createDebug from 'debug';
import { ExifData, ExifImage } from 'exif';
import ffmpeg from 'ffmpeg';
import fs from 'fs';
import createHttpError from 'http-errors';
import sizeOf from 'image-size';
import { path as buildTempPath } from 'temp';
import * as util from 'util';
import { v1 as createGuid } from 'uuid';
import {
  PictureExtension,
  PictureMimeType,
  VideoExtension,
  VideoMimeType
} from '../FileTypes';
import { HttpStatusCode } from '../httpConstants';
import { IMessageQueueConfig } from '../IMessageQueueConfig';
import {
  IProcessPictureMsg,
  IProcessVideoMsg,
  IRecalcFolderMsg,
  MessageType
} from '../messages';
import { Paths } from '../Paths';
import { JobsChannelName } from '../workers';
import { DbFactory } from './db/DbFactory';
import { FileSystemFactory } from './files/FileSystemFactory';

const debug = createDebug('storage:picturestore');
const fsPromises = fs.promises;
const sizeOfPromise = util.promisify(sizeOf);

enum FormatSupportStatus {
  NotSupported = 0,
  IsSupportedPicture = 1,
  IsSupportedVideo = 2
}

// API key used for system operations like async photo processing.
export const SystemApiKey = '00000000-0000-0000-0000-000000000000';

// Unique ID of the system user.  The system user is used in
// asynchronous processing operations and other scenarios.  It
// is granted special privileges in some cases.
export const SystemUserId = 'system.user@picstrata.api';

// Interface for the ApiKeys configuration element.
interface IApiKeysConfig {
  key1: string;
  key2: string;
}

// Interface for metadata which can be extracted from a file.
interface IFileMetadata {
  type?: string;
  isVideo: boolean;
  height?: number;
  width?: number;
  takenOn?: string;
  rating?: string;
  title?: string;
  comments?: string;
  keywords?: string;
  orientation?: number;
}

/**
 * Service which wraps the database and the file system to
 * provide a single picture storage facade.
 */
export class PictureStore {
  /**
   * Creates a new PictureStore instance which can be used to satisfy
   * an API request.
   *
   * @param apiKey API key transmitted in the request.
   * @param userId Unique ID of the user who initiated the request.
   */
  public static createForApiRequest(apiKey: string, userId?: string) {
    return new PictureStore(apiKey, userId);
  }

  /**
   * Creates a new PictureStore instance which can be used for system operations.
   */
  public static createForSystemOp() {
    return new PictureStore(SystemApiKey, SystemUserId);
  }

  /**
   * Extracts the metadata from the file.
   *
   * @param filePath Full path to the file to inspect.
   * @param isVideo True if this is a video file.
   *
   * @returns An IFileMetadata instance.
   */
  private static getFileMetadata(filePath: string, isVideo: boolean) {
    return isVideo
      ? PictureStore.getVideoMetadata(filePath)
      : PictureStore.getPictureMetadata(filePath);
  }

  private static async getPictureMetadata(
    filePath: string
  ): Promise<IFileMetadata> {
    const metadata: IFileMetadata = { isVideo: false };
    debug('Getting picture metadata.');
    await sizeOfPromise(filePath)
      .then(imageInfo => {
        metadata.type = imageInfo.type;
        metadata.height = imageInfo.height;
        metadata.width = imageInfo.width;
        metadata.orientation = imageInfo.orientation;
      })
      .catch(err => {
        debug(err);
        throw err;
      });

    if (
      metadata.type === PictureMimeType.Jpeg ||
      metadata.type === PictureMimeType.Tiff
    ) {
      debug('Retrieving EXIF metadata.');
      await PictureStore.getExifInfo(filePath)
        .then(exifData => {
          metadata.takenOn = exifData.exif.CreateDate;
          metadata.comments = exifData.exif.UserComment?.toString();
        })
        .catch(err => {
          throw err;
        });
    }

    return metadata;
  }

  private static getExifInfo(imageFile: string): Promise<ExifData> {
    return new Promise((resolve, reject) => {
      const _ = new ExifImage(
        imageFile,
        (error: Error | null, exifData: ExifData) => {
          if (error) {
            reject(error);
          } else {
            resolve(exifData);
          }
        }
      );
    });
  }

  /**
   * Retrieves some information about a video file.
   *
   * @param videoPath Local path to the video file.
   */
  private static getVideoMetadata(filePath: string) {
    return new ffmpeg(filePath).then(video => {
      const metadata = video.metadata;
      const resolution = (metadata as any).video.resolution;
      return {
        isVideo: true,
        width: metadata.width || resolution.w,
        height: metadata.height || resolution.h,
        type: metadata.encoder
      } as IFileMetadata;
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

  /**
   * Deletes a file in the file system.
   *
   * @param localPath Path to the file to delete.
   */
  private static deleteFile(localPath: string) {
    fsPromises
      .unlink(localPath)
      .then(_ => {
        debug(`Deleted file ${localPath}.`);
      })
      .catch(err => {
        debug(`Error deleting file: ${err}.`);
      });
  }

  // User ID is optional here to allow for anonymous requests.
  private userId?: string;

  /**
   * Initializes a new instance of the PictureStore.
   *
   * @param apiKey API key provided by the caller.
   * @param userId Unique ID of the user accessing the store.
   */
  private constructor(apiKey: string, userId?: string) {
    // Validate the API key.
    if (apiKey !== SystemApiKey) {
      const apiKeys: IApiKeysConfig = config.get('ApiKeys');
      if (apiKey !== apiKeys.key1 && apiKey !== apiKeys.key2) {
        throw createHttpError(HttpStatusCode.UNAUTHORIZED, 'Invalid API key');
      }
    }

    // The special system user ID can only be used with the system API key.
    if (apiKey !== SystemApiKey && userId === SystemUserId) {
      throw createHttpError(HttpStatusCode.BAD_REQUEST, 'Invalid user ID');
    }

    this.userId = userId;
  }

  /**
   * Retrieves statistics for the service as a whole.
   */
  public getStatistics() {
    const db = DbFactory.createInstance();
    return db.getStatistics();
  }

  /**
   * Retrieves a list of the libraries in the system.
   */
  public getLibraries() {
    const db = DbFactory.createInstance();
    return db.getLibraries(this.getUserId());
  }

  /**
   * Retrieves the details for a specific library.
   *
   * @param libraryId Unique ID of the library.
   */
  public getLibrary(libraryId: string) {
    const db = DbFactory.createInstance();
    return db.getLibrary(this.getUserId(), libraryId);
  }

  /**
   * Adds a new library to the service.
   *
   * @param add Library creation information.
   */

  public addLibrary(add: ILibraryAdd) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();

    // Create a GUID and use that as the unique ID of the folder
    // and also the name of the folder in the file system.  This avoids
    // naming conflicts in the filesystem.
    add.libraryId = createGuid();
    debug(`Generated ID ${add.libraryId} for new library ${add.name}`);

    // Create the library folder on disk first.
    return fileSystem.createFolder(add.libraryId).then(() => {
      // Now add the library to the database.
      return db.addLibrary(this.getUserId(), add).catch(err => {
        // Failed to add it to the database.  Make an attempt to
        // remove the file system folder that we just created.
        debug(`ERROR: Create library failed for library ${add.name}`);
        debug('Folder was created in file system but database insert failed.');
        fileSystem.deleteFolder(add.libraryId!);
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
  public updateLibrary(libraryId: string, update: ILibraryUpdate) {
    const db = DbFactory.createInstance();
    return db.updateLibrary(this.getUserId(), libraryId, update);
  }

  /**
   * Deletes an existing library.
   *
   * @param libraryId Unique ID of the library to delete.
   */
  public deleteLibrary(libraryId: string) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();

    // Delete the library in the database first.
    return db.deleteLibrary(this.getUserId(), libraryId).then(result => {
      // Now try to delete the library folder in the file system.
      return fileSystem
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
   * @param userId Unique ID of the user making the request.
   * @param libraryId Unique ID of the parent library.
   * @param parent Unique ID of the parent folder,
   *
   * NOTE: Pass unknown for parent to get list of root folders.
   */
  public getFolders(libraryId: string, parent?: string) {
    const db = DbFactory.createInstance();
    return db.getFolders(this.getUserId(), libraryId, parent ? parent : null);
  }

  /**
   * Retrieves a specific folder in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   */
  public getFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.getFolder(this.getUserId(), libraryId, folderId);
  }

  /**
   * Retrieves the breadcrumbs in a folder's parent hierarchy.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   */
  public getFolderBreadcrumbs(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.getFolderBreadcrumbs(this.getUserId(), libraryId, folderId);
  }

  /**
   * Adds a new folder to an existing library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param add Information about the new folder.
   */
  public addFolder(libraryId: string, add: IFolderAdd) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();
    const userId = this.getUserId();

    // Grab some information about the parent folder first.
    return db.getFolder(userId, libraryId, add.parentId!).then(parent => {
      // Create the folder in the file system first.
      const folderId = createGuid();
      const fileSystemPath = this.buildLibraryPath(
        libraryId,
        parent.path,
        folderId
      );
      return fileSystem.createFolder(fileSystemPath).then(() => {
        // Now create the folder in the database.
        return db.addFolder(userId, libraryId, folderId, add).catch(err => {
          // We failed to create the folder in the file system.  Try to
          // remove the folder that we created in the database.
          debug(`ERROR: Create folder failed for folder ${add.name}.`);
          debug(`Folder was created in the file system but not in db.`);
          debug(`Attempting to delete the folder in the file systme.`);
          fileSystem.deleteFolder(fileSystemPath);
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
  public updateFolder(
    libraryId: string,
    folderId: string,
    update: IFolderUpdate
  ) {
    const db = DbFactory.createInstance();
    const userId = this.getUserId();

    return db.getFolder(userId, libraryId, folderId).then(folder => {
      return db.updateFolder(userId, libraryId, folderId, update).catch(err => {
        debug(`ERROR: Patching folder ${folderId} failed.`);
        throw err;
      });
    });
  }

  /**
   * Deletes an existing folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder to delete.
   */
  public deleteFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();
    const userId = this.getUserId();

    // Grab the folder info first and then delete the folder in the database.
    return db.getFolder(userId, libraryId, folderId).then(folder => {
      return db.deleteFolder(userId, libraryId, folderId).then(result => {
        // Now try to delete the folder in the file system.
        return fileSystem
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
   * Adds a new user to a folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   * @param newUserId Unique ID of the new user.
   * @param role Role the user should have in the folder.
   */
  public addFolderUser(
    libraryId: string,
    folderId: string,
    newFolderUser: IFolderUserAdd
  ) {
    const db = DbFactory.createInstance();
    return db
      .addFolderUser(
        this.getUserId(),
        libraryId,
        folderId,
        newFolderUser.userId,
        newFolderUser.role
      )
      .then(result => {
        return result;
      });
  }

  /**
   * Recalculates the statistics on a folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the folder.
   */
  public recalcFolder(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.recalcFolder(libraryId, folderId).then(folder => {
      if (folder.parentId) {
        this.enqueueRecalcFolderJob(folder.libraryId, folder.parentId);
      }
      return folder;
    });
  }

  /**
   * Gets a value which indicates if the local file system is
   * being used for file storage.
   */
  public isLocalFileSystem() {
    const fileSystem = FileSystemFactory.createInstance();
    return fileSystem.isLocalFileSystem();
  }

  /**
   * Retrieves a list of files in a library folder.
   *
   * @param libraryId Unique ID of the parent library.
   * @param folderId Unique ID of the parent folder.
   */
  public getFiles(libraryId: string, folderId: string) {
    const db = DbFactory.createInstance();
    return db.getFiles(this.getUserId(), libraryId, folderId);
  }

  /**
   * Retrieves the metadata for a specific file in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   */
  public getFile(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    return db.getFile(this.getUserId(), libraryId, fileId);
  }

  /**
   * Retrieves a stream of the file contents and also a mime
   * type for the file stream.  Note that if the file was
   * converted to a more friendly/compatible format, the returned
   * stream will be for the converted file, not the original file.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   */
  public getFileContents(libraryId: string, fileId: string) {
    debug(`Retrieving the contents of file ${fileId} in library ${libraryId}`);
    const db = DbFactory.createInstance();
    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(contents => {
        let filePath = contents.path;

        // If the file is a video and it is not in MP4 format, we retrieve
        // the converted MP4 video instead of the file itself.
        if (contents.isVideo && contents.mimeType !== VideoMimeType.MP4) {
          filePath = Paths.deleteLastSubpath(filePath);
          filePath = `${filePath}/cnv/${contents.fileId}`;
        }

        return {
          stream: this.getFileStream(libraryId, filePath),
          mimeType: contents.isVideo ? VideoMimeType.MP4 : contents.mimeType,
          filename: contents.name
        };
      });
  }

  /**
   * Retrieves a stream of the thumbnail for a file
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   * @param size Size of the thumbnail to retrieve.
   */
  public getFileThumbnail(
    libraryId: string,
    fileId: string,
    size: ThumbnailSize
  ) {
    debug(
      `Retrieving the ${size} thumbnail of file ${fileId} in library ${libraryId}`
    );
    const db = DbFactory.createInstance();
    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(contents => {
        let filePath = contents.path;
        filePath = Paths.deleteLastSubpath(filePath);
        filePath = `${filePath}/tn_${size}/${contents.fileId}`;

        return {
          stream: this.getFileStream(libraryId, filePath),
          mimeType: PictureMimeType.Jpeg
        };
      });
  }

  /**
   * Returns a read-only stream of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  public getFileStream(libraryId: string, path: string) {
    const fileSystem = FileSystemFactory.createInstance();
    return fileSystem.getFileStream(`${libraryId}/${path}`);
  }

  /**
   * Downloads a file to a temporary file in the local file system.
   *
   * @param libraryId Unique ID of the library.
   * @param fileId Unique ID of the file to download.
   */
  public downloadTempFile(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(contentInfo => {
        // Generate a temporary path and filename.
        const tempPath = buildTempPath({
          suffix: contentInfo.name
        });

        return new Promise<string>((resolve, reject) => {
          debug(
            `Downloading ${contentInfo.path} to temporary file ${tempPath}`
          );
          const writeStream = fs.createWriteStream(tempPath);
          const readStream = this.getFileStream(libraryId, contentInfo.path);

          readStream.on('end', () => {
            resolve(tempPath);
          });

          readStream.on('error', readError => {
            reject(readError);
          });

          readStream.pipe(writeStream);
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
  public async importFile(
    libraryId: string,
    folderId: string,
    localPath: string,
    filename: string,
    mimeType: string,
    fileSize: number
  ) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();
    const userId = this.getUserId();

    const fileExtension = Paths.getFileExtension(filename).toLowerCase();
    const supportStatus = PictureStore.getExtSupportStatus(fileExtension);
    if (supportStatus === FormatSupportStatus.NotSupported) {
      throw createHttpError(
        HttpStatusCode.BAD_REQUEST,
        `Invalid file type: ${fileExtension}`
      );
    }

    // Get whatever metadata we can out of the file.
    const metadata = await PictureStore.getFileMetadata(
      localPath,
      supportStatus === FormatSupportStatus.IsSupportedVideo
    ).catch(err => {
      throw createHttpError(
        HttpStatusCode.BAD_REQUEST,
        `Unrecognized picture or video file: ${filename}`
      );
    });

    return db
      .getFolder(userId, libraryId, folderId)
      .then(folder => {
        const fileId = createGuid();
        return fileSystem
          .importFile(
            localPath,
            this.buildLibraryPath(libraryId, folder.path, fileId)
          )
          .then(_ => {
            PictureStore.deleteFile(localPath);

            // File has been imported into the file system.  Now
            // create a row in the database with the file's metadata.
            return db
              .addFile(userId, libraryId, folderId, fileId, {
                name: filename,
                mimeType,
                isVideo: metadata.isVideo,
                height: metadata.height,
                width: metadata.width,
                fileSize,
                isProcessing: true
              } as IFileAdd)
              .then(file => {
                return this.enqueueProcessFileJob(file);
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
   * Updates an existing picture in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   * @param localPath Local path to the updated picture.
   * @param fileSize Size of the file in bytes.
   * @param height Height of the updated picture.
   * @param width Width of the picture picture.
   */
  public updatePicture(
    libraryId: string,
    fileId: string,
    localPath: string,
    fileSize: number,
    height: number,
    width: number
  ) {
    debug(
      `Importing updated picture for file ${fileId} in library ${libraryId}.`
    );

    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();

    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(fileInfo => {
        return fileSystem.importFile(localPath, fileInfo.path).then(() => {
          // File has been imported into the file system.  Update the database.
          return db
            .updateFileDimsAndSize(
              SystemUserId,
              libraryId,
              fileId,
              height,
              width,
              fileSize
            )
            .then(_ => {
              return this.enqueueRecalcFolderJob(libraryId, fileInfo.folderId);
            });
        });
      })
      .catch(err => {
        if (err.status) {
          throw err;
        } else {
          debug(`Error updating picture: ${err}`);
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
   * @param localPath Local path to the thumbnail file.
   * @param fileSize Size of the thumbnail file in bytes.
   */
  public importThumbnail(
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
    const fileSystem = FileSystemFactory.createInstance();

    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(fileInfo => {
        const pictureFolder = Paths.deleteLastSubpath(fileInfo.path);
        const thumbnailFolder = this.buildLibraryPath(
          libraryId,
          pictureFolder,
          `tn_${thumbSize}`
        );

        return fileSystem
          .createFolder(thumbnailFolder)
          .then(() => {
            const fileSystemPath = `${thumbnailFolder}/${fileId}`;
            return fileSystem.importFile(localPath, fileSystemPath).then(() => {
              PictureStore.deleteFile(localPath);

              // File has been imported into the file system.  Update the database.
              return db
                .updateFileThumbnail(libraryId, fileId, thumbSize, fileSize)
                .then(file => {
                  return this.enqueueRecalcFolderJob(
                    libraryId,
                    fileInfo.folderId
                  );
                })
                .catch(dbErr => {
                  // We failed to update the database.  Make sure we clean
                  // up the file that we created in the file system.
                  fileSystem.deleteFile(fileSystemPath);
                  throw dbErr;
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
   * Imports a converted video file into a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param fileId Unique ID of the file.
   * @param localPath Local path to the converted video file.
   * @param fileSize Size of the converted video file.
   */
  public importConvertedVideo(
    libraryId: string,
    fileId: string,
    localPath: string,
    fileSize: number
  ) {
    debug(
      `Importing converted video for file ${fileId} in library ${libraryId}.`
    );

    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();

    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(fileInfo => {
        const pictureFolder = Paths.deleteLastSubpath(fileInfo.path);
        const videoFolder = this.buildLibraryPath(
          libraryId,
          pictureFolder,
          'cnv'
        );

        return fileSystem
          .createFolder(videoFolder)
          .then(() => {
            const fileSystemPath = `${videoFolder}/${fileId}`;
            return fileSystem.importFile(localPath, fileSystemPath).then(() => {
              PictureStore.deleteFile(localPath);

              // File has been imported into the file system.  Update the database.
              return db
                .updateFileConvertedVideo(libraryId, fileId, fileSize)
                .then(file => {
                  return this.enqueueRecalcFolderJob(
                    libraryId,
                    fileInfo.folderId
                  );
                })
                .catch(dbErr => {
                  // We failed to update the database.  Make sure we clean
                  // up the file that we created in the file system.
                  fileSystem.deleteFile(fileSystemPath);
                  throw dbErr;
                });
            });
          })
          .catch(err => {
            if (err.status) {
              throw err;
            } else {
              debug(`Error importing converted video: ${err}`);
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
  public updateFile(libraryId: string, fileId: string, update: IFileUpdate) {
    const db = DbFactory.createInstance();
    const userId = this.getUserId();

    // If name is changing, rename file on disk first, then update
    // the database. Othwerise just update the database since all
    // other updates are metadata only.
    if (update.name) {
      return db.getFileContentInfo(userId, libraryId, fileId).then(info => {
        if (!PictureStore.areExtensionsEqual(info.name, update.name!)) {
          throw createHttpError(
            HttpStatusCode.BAD_REQUEST,
            'Invalid operation.  File extensions must match.'
          );
        }

        return db.updateFile(userId, libraryId, fileId, update);
      });
    } else {
      return db.updateFile(userId, libraryId, fileId, update);
    }
  }

  public deleteFile(libraryId: string, fileId: string) {
    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();
    const userId = this.getUserId();

    // Grab the file info first and then delete the file in the database.
    return db.getFileContentInfo(userId, libraryId, fileId).then(file => {
      return db.deleteFile(userId, libraryId, fileId).then(result => {
        // Now try to delete the file in the file system
        // along with any thumbnails that have been created.
        const fileDir = Paths.deleteLastSubpath(file.path);
        return fileSystem
          .deleteFile(`${libraryId}/${file.path}`)
          .then(() => {
            return fileSystem.deleteFile(
              this.buildLibraryPath(libraryId, fileDir, `tn_sm/${file.fileId}`)
            );
          })
          .then(() => {
            return fileSystem.deleteFile(
              this.buildLibraryPath(libraryId, fileDir, `tn_md/${file.fileId}`)
            );
          })
          .then(() => {
            return fileSystem.deleteFile(
              this.buildLibraryPath(libraryId, fileDir, `tn_lg/${file.fileId}`)
            );
          })
          .then(() => {
            this.enqueueRecalcFolderJob(file.libraryId, file.folderId);
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
  public getLocalFilePath(libraryId: string, fileId: string) {
    debug(`Getting local path to file ${fileId} in library ${libraryId}`);

    const db = DbFactory.createInstance();
    const fileSystem = FileSystemFactory.createInstance();

    return db
      .getFileContentInfo(this.getUserId(), libraryId, fileId)
      .then(info => {
        return fileSystem.getLocalFilePath(`${libraryId}/${info.path}`);
      })
      .catch(err => {
        debug(`Error: getLocalFilePath: ${err}`);
        throw err;
      });
  }

  /**
   * Simple cover which checks this.userId before use.
   */
  private getUserId() {
    if (!this.userId) {
      throw createHttpError(HttpStatusCode.UNAUTHORIZED, 'Not authorized.');
    }

    return this.userId;
  }

  /**
   * Builds a path to a file or folder in a library.
   *
   * @param libraryId Unique ID of the library.
   * @param parentFolderPath Relative path to the parent folder.
   * @param itemName Name of the file or folder.
   */
  private buildLibraryPath(
    libraryId: string,
    parentFolderPath: string,
    itemName: string
  ) {
    // Files at the root of All Pictures are stored directly
    // under the library folder.
    return parentFolderPath && parentFolderPath.length > 0
      ? `${libraryId}/${parentFolderPath}/${itemName}`
      : `${libraryId}/${itemName}`;
  }

  private enqueueRecalcFolderJob(libraryId: string, folderId: string) {
    this.enqueue(ch => {
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

  private enqueueProcessFileJob(file: IFile) {
    let message: IProcessPictureMsg | IProcessVideoMsg;
    return this.enqueue(ch => {
      if (!file.isVideo) {
        debug('Publishing thumbnail creation jobs.');
        message = {
          type: MessageType.ProcessPicture,
          libraryId: file.libraryId,
          fileId: file.fileId
        } as IProcessPictureMsg;
      } else {
        debug('Publishing video conversion job.');
        message = {
          type: MessageType.ProcessVideo,
          libraryId: file.libraryId,
          fileId: file.fileId,
          convertToMp4: Paths.getFileExtension(file.name) !== VideoExtension.MP4
        } as IProcessVideoMsg;
      }

      if (
        !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
      ) {
        throw new Error('Failed to enqueue process picture/video message.');
      }

      return file;
    });
  }

  private enqueue(callback: (ch: amqp.Channel) => any) {
    const messageQueueConfig: IMessageQueueConfig = config.get('MessageQueue');
    debug(`Connecting to RabbitMQ server at ${messageQueueConfig.url}`);
    return amqp
      .connect(messageQueueConfig.url)
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
}

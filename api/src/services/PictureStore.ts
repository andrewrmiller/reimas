import createDebug from 'debug';
import sizeOf from 'image-size';
import * as util from 'util';
import { v1 as createGuid } from 'uuid';
import { Paths } from '../common/Paths';
import { DbFactory } from '../services/db/DbFactory';
import { LocalFileSystem } from './files/LocalFileSystem';
import {
  IFileAdd,
  IFileUpdate,
  IFolderAdd,
  IFolderUpdate,
  ILibraryAdd,
  ILibraryUpdate
} from './models';

const debug = createDebug('api:picturestore');
const sizeOfPromise = util.promisify(sizeOf);

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

    // Create a GUID and use that as the unique ID of the folder
    // and also the name of the folder in the file system.  This avoids
    // naming conflicts in the filesystem.
    add.libraryId = createGuid();
    debug(`Generated ID ${add.libraryId} for new library ${add.name}`);

    // Create the library folder on disk first.
    return LocalFileSystem.createFolder(add.libraryId).then(() => {
      // Now add the library to the database.
      return db.addLibrary(add).catch(err => {
        // Failed to add it to the database.  Make an attempt to
        // remove the file system folder that we just created.
        debug(`ERROR: Create library failed for library ${add.name}`);
        debug('Folder was created in file system but database insert failed.');
        LocalFileSystem.deleteFolder(add.name);
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

    // Delete the library in the database first.
    return db.deleteLibrary(libraryId).then(result => {
      // Now try to delete the library folder in the file system.
      return LocalFileSystem.deleteFolder(libraryId)
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

    // Grab some information about the parent folder first.
    return db.getFolder(libraryId, add.parentId!).then(parent => {
      // Create the folder in the file system first.
      const fileSystemPath = `${libraryId}/${parent.path}/${add.name}`;
      return LocalFileSystem.createFolder(fileSystemPath).then(() => {
        // Now create the folder in the database.
        return db.addFolder(libraryId, add).catch(err => {
          // We failed to create the folder in the file system.  Try to
          // remove the folder that we created in the database.
          debug(`ERROR: Create folder failed for folder ${add.name}.`);
          debug(`Folder was created in the file system but not in db.`);
          debug(`Attempting to delete the folder in the file systme.`);
          LocalFileSystem.deleteFolder(fileSystemPath);
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

    return db.getFolder(libraryId, folderId).then(folder => {
      const fileSystemPath = `${libraryId}/${folder.path}`;
      return LocalFileSystem.renameFolder(fileSystemPath, update.name!).then(
        () => {
          return db.updateFolder(libraryId, folderId, update).catch(err => {
            debug(`ERROR: Patching folder ${folderId} failed.`);
            const newPath = Paths.replaceLastSubpath(
              fileSystemPath,
              update.name!
            );
            debug(`Attempting to revert ${newPath} to ${folder.name}.`);
            LocalFileSystem.renameFolder(newPath, folder.name);
            throw err;
          });
        }
      );
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

    // Grab the folder info first and then delete the folder in the database.
    return db.getFolder(libraryId, folderId).then(folder => {
      return db.deleteFolder(libraryId, folderId).then(result => {
        // Now try to delete the folder in the file system.
        return LocalFileSystem.deleteFolder(`${libraryId}/${folder.path}`)
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
    return db.getFileContentInfo(libraryId, fileId).then(contentInfo => {
      return LocalFileSystem.readFile(`${libraryId}/${contentInfo.path}`).then(
        buffer => {
          return {
            buffer,
            mimeType: contentInfo.mimeType
          };
        }
      );
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

    return sizeOfPromise(localPath).then(imageInfo => {
      return db.getFolder(libraryId, folderId).then(folder => {
        return LocalFileSystem.importFile(
          localPath,
          `${libraryId}/${folder.path}/${filename}`
        ).then(() => {
          // File has been impmorted into the file system.  Now
          // create a row in the database with the file's metadata.
          return db.addFile(libraryId, folderId, {
            name: filename,
            mimeType,
            isVideo: PictureStore.isVideo(mimeType),
            height: imageInfo.height,
            width: imageInfo.width,
            fileSize,
            isProcessing: true
          } as IFileAdd);
        });
      });
    });
  }

  public static updateFile(
    libraryId: string,
    fileId: string,
    update: IFileUpdate
  ) {
    // TODO: Implement this.
    return new Promise((resolve, reject) => {
      resolve({ fileId });
    });
  }

  public static deleteFile(libraryId: string, fileId: string) {
    // TODO: Implement this
    return new Promise((resolve, reject) => {
      resolve({ fileId });
    });
  }

  private static isVideo(mimeType: string) {
    // TODO: Implement this.
    return false;
  }
}

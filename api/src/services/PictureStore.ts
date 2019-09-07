import createDebug from 'debug';
import { v1 as createGuid } from 'uuid';
import { Paths } from '../common/Paths';
import { DbFactory } from '../services/db/DbFactory';
import { LocalFileSystem } from './files/LocalFileSystem';
import { IFolderPatch, ILibraryPatch, INewFolder, INewLibrary } from './models';

const debug = createDebug('api:picturestore');

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
   * Creates a new library.
   *
   * @param newLibrary Library creation information.
   */

  public static createLibrary(newLibrary: INewLibrary) {
    const db = DbFactory.createInstance();

    // Create a GUID and use that as the unique ID of the folder
    // and also the name of the folder in the file system.  This avoids
    // naming conflicts in the filesystem.
    newLibrary.libraryId = createGuid();
    debug(
      `Generated ID ${newLibrary.libraryId} for new library ${newLibrary.name}`
    );

    // Create the library folder on disk first.
    return LocalFileSystem.createFolder(newLibrary.libraryId).then(() => {
      // Now add the library to the database.
      return db.addLibrary(newLibrary).catch(err => {
        // Failed to add it to the database.  Make an attempt to
        // remove the file system folder that we just created.
        debug(`ERROR: Create library failed for library ${newLibrary.name}`);
        debug('Folder was created in file system but database insert failed.');
        LocalFileSystem.deleteFolder(newLibrary.name);
        throw err;
      });
    });
  }

  /**
   * Updates an existing library.
   *
   * @param libraryId Unique ID of the library to update.
   * @param patch Information to update on the library.
   */
  public static updateLibrary(libraryId: string, patch: ILibraryPatch) {
    const db = DbFactory.createInstance();
    return db.patchLibrary(libraryId, patch);
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
   * Creates a new folder in a library.
   *
   * @param libraryId Unique ID of the parent library.
   * @param newFolder Information about the new folder.
   */
  public static createFolder(libraryId: string, newFolder: INewFolder) {
    const db = DbFactory.createInstance();

    // Grab some information about the parent folder first.
    return db.getFolder(libraryId, newFolder.parentId!).then(parent => {
      // Create the folder in the file system first.
      const fileSystemPath = `${libraryId}/${parent.path}/${newFolder.name}`;
      return LocalFileSystem.createFolder(fileSystemPath).then(() => {
        // Now create the folder in the database.
        return db.addFolder(libraryId, newFolder).catch(err => {
          // We failed to create the folder in the file system.  Try to
          // remove the folder that we created in the database.
          debug(`ERROR: Create folder failed for folder ${newFolder.name}.`);
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
   * @param patch Information to update.
   */
  public static updateFolder(
    libraryId: string,
    folderId: string,
    patch: IFolderPatch
  ) {
    const db = DbFactory.createInstance();

    return db.getFolder(libraryId, folderId).then(folder => {
      const fileSystemPath = `${libraryId}/${folder.path}`;
      return LocalFileSystem.renameFolder(fileSystemPath, patch.name!).then(
        () => {
          return db.patchFolder(libraryId, folderId, patch).catch(err => {
            debug(`ERROR: Patching folder ${folderId} failed.`);
            const newPath = Paths.replaceLastSubpath(
              fileSystemPath,
              patch.name!
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
}

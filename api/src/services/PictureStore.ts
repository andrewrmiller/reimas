import createDebug from 'debug';
import { v1 as createGuid } from 'uuid';
import { DbFactory } from '../services/db/DbFactory';
import { ILibraryPatch, INewLibrary } from '../services/db/models';
import { LocalFileSystem } from '../services/files/LocalFileSystem';

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

    // Create the folder on disk first and if that works add it
    // to the database.
    return LocalFileSystem.createFolder(newLibrary.libraryId).then(() => {
      return db.addLibrary(newLibrary).catch(err => {
        // Failed to add it to the database.  Make an attempt to
        // remove the file system folder that we just created and
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
      return LocalFileSystem.deleteFolder(libraryId).catch(err => {
        debug(`ERROR: Delete library failed for library ${libraryId}`);
        debug(`Library was deleted in the database but folder delete failed.`);
        debug(`Library folder '${libraryId}' may need to be cleaned up.`);
        throw err;
      });
    });
  }
}

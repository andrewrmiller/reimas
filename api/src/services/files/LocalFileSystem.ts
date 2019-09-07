import createDebug from 'debug';
import { promises as fs } from 'fs';
import rimraf from 'rimraf';
import { Paths } from '../../common/Paths';

const debug = createDebug('api:localfilesystem');

const FileSystemRoot = 'libraries';

/**
 * Local file system interface for picture and video storage.
 */
export class LocalFileSystem {
  /**
   * Creates a new folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public static createFolder(path: string) {
    const folderPath = `${FileSystemRoot}/${path}`;
    debug(`Creating local file system folder ${folderPath}`);
    return fs.mkdir(folderPath);
  }

  /**
   * Renames a folder in the file system.
   *
   * @param path Relative path to the folder.
   * @param newName The new name for the folder.
   */
  public static renameFolder(path: string, newName: string) {
    const folderPath = `${FileSystemRoot}/${path}`;
    const newPath = Paths.replaceLastSubpath(folderPath, newName);
    debug(`Renaming local file system folder '${folderPath}' to '${newName}'`);
    return fs.rename(folderPath, newPath);
  }

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public static deleteFolder(path: string) {
    const folderPath = `${FileSystemRoot}/${path}`;
    debug(`Recursively deleting local file system folder ${folderPath}`);
    // Rimraf gives us recursive delete but no Promise interface
    // unfortunately so we create the Promise ourselves.
    return new Promise((resolve, reject) => {
      rimraf(folderPath, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

import createDebug from 'debug';
import fs from 'fs';
import rimraf from 'rimraf';
import * as util from 'util';
import { Paths } from '../../common/Paths';

const debug = createDebug('api:localfilesystem');
const fsPromises = fs.promises;
const rimrafPromise = util.promisify(rimraf);

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
    return fsPromises.mkdir(folderPath);
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
    return fsPromises.rename(folderPath, newPath);
  }

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public static deleteFolder(path: string) {
    const folderPath = `${FileSystemRoot}/${path}`;
    debug(`Recursively deleting local file system folder ${folderPath}`);
    return rimrafPromise(folderPath);
  }

  /**
   * Reads the contents of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  public static readFile(path: string) {
    const filePath = `${FileSystemRoot}/${path}`;
    debug(`Reading file ${filePath}`);
    return fsPromises.readFile(filePath);
  }

  /**
   * Imports a file into a folder under the file system root.
   *
   * @param localPath Local path to the file to import.
   * @param targetPath Relative path for the imported file.
   *
   * NOTE: The source file at localPath will be deleted after
   * the file is imported or if an error occurs.
   */
  public static importFile(localPath: string, targetPath: string) {
    const target = `${FileSystemRoot}/${targetPath}`;
    debug(`Importing ${localPath} as ${target}`);
    return fsPromises
      .copyFile(localPath, target, fs.constants.COPYFILE_EXCL)
      .finally(() => {
        debug(`Deleting ${localPath}`);
        fsPromises.unlink(localPath);
      });
  }
}

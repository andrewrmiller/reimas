import createDebug from 'debug';
import fs from 'fs';
import createHttpError from 'http-errors';
import rimraf from 'rimraf';
import * as util from 'util';
import { HttpStatusCode } from '../../common/httpConstants';
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
   * Renames a folder or file in the file system.
   *
   * @param path Relative path to the folder.
   * @param newName The new name for the folder.
   */
  public static renameFolderOrFile(path: string, newName: string) {
    const currentPath = `${FileSystemRoot}/${path}`;
    const newPath = Paths.replaceLastSubpath(currentPath, newName);

    // Does the target file or folder exist?
    return fsPromises
      .access(newPath)
      .catch(err => {
        // The file does not exist.  OK to rename.
        debug(
          `Renaming local file system item '${currentPath}' to '${newName}'`
        );
        return fsPromises.rename(currentPath, newPath);
      })
      .then(() => {
        throw createHttpError(
          HttpStatusCode.CONFLICT,
          'A file already exists with that name.'
        );
      });
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
   * @param suffix Optional numeric suffix to append to filename.
   *
   * NOTE: The source file at localPath will be deleted after
   * the file is imported or if an error occurs.
   */
  public static importFile(
    localPath: string,
    targetPath: string,
    suffix?: number
  ): Promise<string> {
    let target = `${FileSystemRoot}/${targetPath}`;

    // If a numeric suffix has been provided, update the target
    // path to include that suffix.
    if (suffix) {
      target = Paths.addFilenameSuffixToPath(target, suffix);
      debug(`Trying modified path ${target}`);
    }

    debug(`Importing ${localPath} as ${target}`);
    return fsPromises
      .copyFile(localPath, target, fs.constants.COPYFILE_EXCL)
      .then(() => {
        // After cleaning up, return the filename to the caller
        // so they know what file we ended up using.
        debug(`Deleting ${localPath}`);
        fsPromises.unlink(localPath);
        return Paths.getLastSubpath(target);
      })
      .catch(err => {
        // Target file exists.  Try again with a new name.
        const newSuffix = suffix ? suffix + 1 : 2;
        if (newSuffix >= 999) {
          throw createHttpError(HttpStatusCode.BAD_REQUEST, 'Too many files.');
        }
        return LocalFileSystem.importFile(localPath, targetPath, newSuffix);
      });
  }

  /**
   * Deletes a file under the file system root.
   *
   * @param path Relative path to the file.
   */
  public static deleteFile(path: string) {
    const filePath = `${FileSystemRoot}/${path}`;
    debug(`Deleting file ${filePath}`);
    return fsPromises.unlink(filePath);
  }
}

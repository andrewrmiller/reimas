import config from 'config';
import createDebug from 'debug';
import fs from 'fs';
import createHttpError from 'http-errors';
import rimraf from 'rimraf';
import * as util from 'util';
import { HttpStatusCode } from '../../httpConstants';
import { IFileSystemConfig } from '../../IFileSystemConfig';
import { Paths } from '../../Paths';

const debug = createDebug('storage:localfilesystem');
const fsPromises = fs.promises;
const rimrafPromise = util.promisify(rimraf);

/**
 * Local file system interface for picture and video storage.
 */
export class LocalFileSystem {
  private config: IFileSystemConfig;

  constructor() {
    this.config = config.get('FileSystem');
  }

  /**
   * Creates a new folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public createFolder(path: string) {
    const folderPath = `${this.config.root}/${path}`;
    debug(`Creating local file system folder ${folderPath}`);
    try {
      fs.accessSync(folderPath);

      // Folder already exists.  We're done.
      return new Promise((resolve, reject) => {
        resolve();
      });
    } catch (err) {
      return fsPromises.mkdir(folderPath);
    }
  }

  /**
   * Renames a folder or file in the file system.
   *
   * @param path Relative path to the folder.
   * @param newName The new name for the folder.
   */
  public renameFolderOrFile(path: string, newName: string) {
    const currentPath = `${this.config.root}/${path}`;
    const newPath = Paths.replaceLastSubpath(currentPath, newName);

    try {
      // Check to see if the target folder or file exists.
      fs.accessSync(newPath);
    } catch (err) {
      // The file does not exist.  OK to rename.
      debug(`Renaming local file system item '${currentPath}' to '${newName}'`);
      return fsPromises.rename(currentPath, newPath);
    }

    // The file exists so the rename must fail.
    throw createHttpError(
      HttpStatusCode.CONFLICT,
      'A folder or file already exists with that name.'
    );
  }

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public deleteFolder(path: string) {
    const folderPath = `${this.config.root}/${path}`;
    debug(`Recursively deleting local file system folder ${folderPath}`);
    return rimrafPromise(folderPath);
  }

  /**
   * Reads the contents of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  public readFile(path: string) {
    const filePath = `${this.config.root}/${path}`;
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
  public importFile(
    localPath: string,
    targetPath: string,
    suffix?: number
  ): Promise<string> {
    let target = `${this.config.root}/${targetPath}`;

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
        return this.importFile(localPath, targetPath, newSuffix);
      });
  }

  /**
   * Deletes a file under the file system root.
   *
   * @param path Relative path to the file.
   */
  public deleteFile(path: string) {
    const filePath = `${this.config.root}/${path}`;
    debug(`Deleting file ${filePath}`);
    return fsPromises.unlink(filePath);
  }

  /**
   * Returns the full path to a file in the library.
   *
   * @param path Relative path to the file.
   */
  public getFilePath(path: string) {
    return `${this.config.root}/${path}`;
  }
}

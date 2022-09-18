import { Paths } from 'common';
import createDebug from 'debug';
import fs from 'fs';
import rimraf from 'rimraf';
import * as util from 'util';
import { ILocalFileSystemConfig } from '../config/IFileSystemConfig';
import { IFileSystem } from './IFileSystem';

const debug = createDebug('storage:localfilesystem');
const fsPromises = fs.promises;
const rimrafPromise = util.promisify(rimraf);

/**
 * Local file system interface for picture and video storage.
 */
export class LocalFileSystem implements IFileSystem {
  private config: ILocalFileSystemConfig;

  constructor(localConfig: ILocalFileSystemConfig) {
    this.config = localConfig;
  }

  /**
   * Returns true if the files in this file system are
   * stored locally.
   */
  public isLocalFileSystem(): boolean {
    return true;
  }

  /**
   * Creates a new folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public createFolder(path: string): Promise<void | null> {
    const folderPath = `${this.config.root}/${path}`;
    debug(`Creating local file system folder ${folderPath}`);
    try {
      fs.accessSync(folderPath);

      // Folder already exists.  We're done.
      return new Promise((resolve, reject) => {
        resolve(null);
      });
    } catch (err) {
      return fsPromises.mkdir(folderPath);
    }
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
   * Returns a read-only stream of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  public getFileStream(path: string) {
    const filePath = `${this.config.root}/${path}`;
    debug(`Reading file as stream from ${filePath}`);
    return fs.createReadStream(filePath);
  }

  /**
   * Imports a file into a folder under the file system root.
   *
   * @param localPath Local path to the file to import.
   * @param targetPath Relative path for the imported file.
   */
  public importFile(localPath: string, targetPath: string): Promise<void> {
    const target = `${this.config.root}/${targetPath}`;
    debug(`Importing ${localPath} as ${target}`);
    return fsPromises.copyFile(localPath, target);
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
   * Copies a file in one location to another.
   *
   * @param sourcePath Relative path to the source file.
   * @param targetPath Relative path to the target file.
   */
  public copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const sourceFilePath = `${this.config.root}/${sourcePath}`;
    const targetFilePath = `${this.config.root}/${targetPath}`;
    return fsPromises.copyFile(sourceFilePath, targetFilePath);
  }

  /**
   * Returns the full local path to a file in the library.
   *
   * @param path Relative path to the file.
   */
  public getLocalFilePath(path: string) {
    return `${this.config.root}/${path}`;
  }
}

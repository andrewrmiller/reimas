import createDebug from 'debug';
import { promises as fs } from 'fs';

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
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public static deleteFolder(path: string) {
    const folderPath = `${FileSystemRoot}/${path}`;
    debug(`Deleting local file system folder ${folderPath}`);
    return fs.rmdir(folderPath);
  }
}

import * as stream from 'stream';

export interface IFileSystem {
  /**
   * Returns true if the files in this file system are
   * stored locally.
   */
  isLocalFileSystem(): boolean;

  /**
   * Creates a new folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  createFolder(path: string): Promise<void | null>;

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  deleteFolder(path: string): Promise<void | null>;

  /**
   * Imports a file into a folder under the file system root.
   *
   * @param localPath Local path to the file to import.
   * @param targetPath Relative path for the imported file.
   *
   * NOTE: The source file at localPath will be deleted after
   * the file is imported or if an error occurs.
   */
  importFile(localPath: string, targetPath: string): Promise<void | null>;

  /**
   * Returns a read-only stream of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  getFileStream(path: string): stream.Readable;

  /**
   * Deletes a file under the file system root.
   *
   * @param path Relative path to the file.
   */
  deleteFile(path: string): Promise<void | null>;

  /**
   * Copies a file in one location to another.
   *
   * @param sourcePath Relative path to the source file.
   * @param targetPath Relative path to the target file.
   */
  copyFile(sourcePath: string, targetPath: string): Promise<void | null>;

  /**
   * Returns the full local path to a file in the library.
   *
   * @param path Relative path to the file.
   *
   * @throws Error when this is not a local file system.
   */
  getLocalFilePath(path: string): string;
}

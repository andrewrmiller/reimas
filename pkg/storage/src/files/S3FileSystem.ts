import AWS from 'aws-sdk';
import { Paths } from 'common';
import config from 'config';
import createDebug from 'debug';
import fs from 'fs';
import {
  FileSystemType,
  IFileSystemConfig,
  IS3FileSystemConfig
} from '../config/IFileSystemConfig';
import { IFileSystem } from './IFileSystem';

const debug = createDebug('storage:s3filesystem');

/**
 * Retrieve a properly configured S3 client object.
 */
function getS3Client() {
  const fileSystemConfig = config.get('FileSystem') as IFileSystemConfig;

  // If the system is not currently configured to store files in S3
  // we do not need to create a connection.
  if (fileSystemConfig.type !== FileSystemType.S3) {
    return undefined;
  }

  const s3Config = fileSystemConfig.s3FileSystem!;
  const credentials = new AWS.Credentials(
    s3Config.accessKeyId,
    s3Config.secretAccessKey
  );
  AWS.config.credentials = credentials;
  AWS.config.update({ region: 'us-west-2' });
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

  s3.listBuckets((err, data) => {
    if (err) {
      debug(`Error: Unable to list AWS S3 buckets: ${err}`);
      throw err;
    }

    if (data.Buckets!.findIndex(b => b.Name === s3Config.bucket) === -1) {
      debug(`Error: Bucket ${s3Config.bucket} not found.`);
      throw new Error('Configured bucket not found.');
    }

    debug(`Using bucket ${s3Config.bucket}.`);
  });

  return s3;
}

const s3Client = getS3Client()!;

export class S3FileSystem implements IFileSystem {
  private config: IS3FileSystemConfig;

  constructor(s3Config: IS3FileSystemConfig) {
    this.config = s3Config;
  }

  /**
   * Returns true if the files in this file system are
   * stored locally.
   */
  public isLocalFileSystem(): boolean {
    return false;
  }

  /**
   * Creates a new folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public createFolder(path: string): Promise<any> {
    debug(`Creating AWS S3 folder ${path} in bucket ${this.config.bucket}.`);

    return s3Client
      .upload({
        Bucket: this.config.bucket,
        Key: `${path}/`,
        ACL: 'public-read',
        Body: ''
      })
      .promise()
      .then(() => null);
  }

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public deleteFolder(path: string): Promise<any> {
    debug(`Delete AWS S3 folder ${path} in bucket ${this.config.bucket}.`);

    // Get a list of all the items in the folder.
    return s3Client
      .listObjectsV2({
        Bucket: this.config.bucket,
        Prefix: `${path}/`
      })
      .promise()
      .then(listedObjects => {
        // If the folder is empty there's nothing to do.
        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
          return null;
        }

        // Create an array of object identifiers.
        const objects: AWS.S3.ObjectIdentifierList = [];
        listedObjects.Contents.forEach(child => {
          objects.push({ Key: child.Key! });
        });

        // Delete the objects in bulk.
        return s3Client
          .deleteObjects({
            Bucket: this.config.bucket,
            Delete: { Objects: objects }
          })
          .promise()
          .then(() => {
            // listObjectsV2 returns at most 1000 items.  So if we received
            // a count of 1000 there may be more items to delete.
            if (listedObjects.Contents!.length === 1000) {
              return this.deleteFolder(path);
            } else {
              return null;
            }
          });
      });
  }

  /**
   * Imports a file into a folder under the file system root.
   *
   * @param localPath Local path to the file to import.
   * @param targetPath Relative path for the imported file.
   */
  public importFile(localPath: string, targetPath: string) {
    debug(
      `Importing file ${localPath} into AWS S3 as ${targetPath} in bucket ${this.config.bucket}.`
    );

    const stream = fs.createReadStream(localPath);
    return s3Client
      .upload({
        Bucket: this.config.bucket,
        Key: targetPath,
        Body: stream
      })
      .promise()
      .then(() => {
        return;
      });
  }

  /**
   * Returns a read-only stream of a file in the file system.
   *
   * @param path Relative path to the file.
   */
  public getFileStream(path: string) {
    debug(
      `Retrieving a read-only stream of file ${path} from AWS S3 bucket ${this.config.bucket}.`
    );

    return s3Client
      .getObject({
        Bucket: this.config.bucket,
        Key: path
      })
      .createReadStream();
  }

  /**
   * Deletes a file in the AWS S3 bucket.
   *
   * @param path Relative path to the file.
   */
  public deleteFile(path: string) {
    debug(`Deleting file ${path} from AWS S3 bucket ${this.config.bucket}.`);

    return s3Client
      .deleteObject({
        Bucket: this.config.bucket,
        Key: path
      })
      .promise()
      .then(() => null);
  }

  /**
   * Copies a file in one location to another.
   *
   * @param sourcePath Relative path to the source file.
   * @param targetPath Relative path to the target file.
   */
  public copyFile(sourcePath: string, targetPath: string) {
    debug(
      `Copying file ${sourcePath} to ${targetPath} in bucket ${this.config.bucket}`
    );
    return s3Client
      .copyObject({
        Bucket: this.config.bucket,
        CopySource: sourcePath,
        Key: targetPath
      })
      .promise()
      .then(() => null);
  }

  /**
   * Returns the full local path to a file in the library.
   *
   * @param path Relative path to the file.
   *
   * @throws Error since this is not a local file system.
   */
  public getLocalFilePath(path: string): string {
    throw new Error('Local file paths are not supported.');
  }
}

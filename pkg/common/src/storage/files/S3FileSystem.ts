import AWS from 'aws-sdk';
import createDebug from 'debug';
import fs from 'fs';
import { IS3FileSystemConfig } from '../../IFileSystemConfig';
import { Paths } from '../../Paths';
import { IFileSystem } from './IFileSystem';

const fsPromises = fs.promises;
const debug = createDebug('storage:s3filesystem');

export class S3FileSystem implements IFileSystem {
  private config: IS3FileSystemConfig;

  constructor(s3Config: IS3FileSystemConfig) {
    this.config = s3Config;

    debug('Connecting to AWS S3...');
    const s3 = this.getS3Client();
    s3.listBuckets((err, data) => {
      if (err) {
        debug(`Error: Unable to list AWS S3 buckets: ${err}`);
        throw err;
      }

      if (data.Buckets!.findIndex(b => b.Name === this.config.bucket) === -1) {
        debug(`Error: Bucket ${this.config.bucket} not found.`);
        throw new Error('Configured bucket not found.');
      }

      debug(`Using bucket ${this.config.bucket}.`);
    });
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

    return this.getS3Client()
      .upload({
        Bucket: this.config.bucket,
        Key: `${path}/`,
        ACL: 'public-read',
        Body: ''
      })
      .promise();
  }

  /**
   * Deletes a folder under the file system root.
   *
   * @param path Relative path to the folder.
   */
  public deleteFolder(path: string): Promise<any> {
    debug(`Delete AWS S3 folder ${path} in bucket ${this.config.bucket}.`);

    const s3Client = this.getS3Client();

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
   *
   * NOTE: The source file at localPath will be deleted after
   * the file is imported or if an error occurs.
   */
  public importFile(localPath: string, targetPath: string) {
    debug(
      `Importing file ${localPath} into AWS S3 as ${targetPath} in bucket ${this.config.bucket}.`
    );

    const stream = fs.createReadStream(localPath);
    return this.getS3Client()
      .upload({
        Bucket: this.config.bucket,
        Key: targetPath,
        Body: stream
      })
      .promise()
      .then(() => {
        // After cleaning up, return the filename to the caller
        // so they know what file we ended up using.
        debug(`Import successful.  Deleting ${localPath}.`);
        fsPromises.unlink(localPath).catch(err => {
          debug(`Error deleting file that was just imported: ${err}.`);
        });
        return Paths.getLastSubpath(targetPath);
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

    return this.getS3Client()
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

    return this.getS3Client()
      .deleteObject({
        Bucket: this.config.bucket,
        Key: path
      })
      .promise();
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

  /**
   * Retrieve a properly configured S3 client object.
   */
  private getS3Client() {
    const credentials = new AWS.SharedIniFileCredentials({ profile: 'reimas' });
    AWS.config.credentials = credentials;
    AWS.config.update({ region: 'us-west-2' });
    return new AWS.S3({ apiVersion: '2006-03-01' });
  }
}

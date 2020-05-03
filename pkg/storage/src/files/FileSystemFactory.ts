import config from 'config';
import { FileSystemType, IFileSystemConfig } from '../config/IFileSystemConfig';
import { IFileSystem } from './IFileSystem';
import { LocalFileSystem } from './LocalFileSystem';
import { S3FileSystem } from './S3FileSystem';

export class FileSystemFactory {
  public static createInstance(): IFileSystem {
    const fileSystemConfig = config.get('FileSystem') as IFileSystemConfig;

    switch (fileSystemConfig.type) {
      case FileSystemType.Local:
        return new LocalFileSystem(fileSystemConfig.localFileSystem!);
      case FileSystemType.S3:
        return new S3FileSystem(fileSystemConfig.s3FileSystem!);
      default:
        throw new Error('Configured file system is not recognized.');
    }
  }
}

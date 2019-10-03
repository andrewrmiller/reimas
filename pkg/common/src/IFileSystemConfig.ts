export enum FileSystemType {
  Local = 'local',
  S3 = 'S3'
}

export interface ILocalFileSystemConfig {
  root: string;
}

export interface IS3FileSystemConfig {
  bucket: string;
}

/**
 * Configuration information for the file system.
 */
export interface IFileSystemConfig {
  type: FileSystemType;
  // Must be set if type === Local.
  localFileSystem?: ILocalFileSystemConfig;
  // Must be set if type === S3.
  s3FileSystem?: IS3FileSystemConfig;
}

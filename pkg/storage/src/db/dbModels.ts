import { Role } from '@picstrata/client';
import { DbErrorCode } from './DbError';

/**
 * Structure of the first result set returned from DML
 * procedures.  Provides information on the success or
 * failure of the DML operation.
 */
export interface IDmlResponse {
  err_code: DbErrorCode;
  err_context: string;
}

/**
 * Structure of a library as represented in the database.
 */
export interface IDbLibrary {
  library_id: string;
  name: string;
  description: string;
  time_zone: string;
  user_role: Role;
}

/**
 * Structure of a folder as represented in the database.
 */
export interface IDbFolder {
  library_id: string;
  folder_id: string;
  name: string;
  parent_id: string;
  root_id: string;
  path: string;
  file_count: number;
  file_size: number;
  file_size_sm: number;
  file_size_md: number;
  file_size_lg: number;
  file_size_cnv_video: number;
}

export interface IDbBreadcrumb {
  library_id: string;
  folder_id: string;
  name: string;
}

/**
 * Structure of a file as represented in the database.
 */
export interface IDbFile {
  library_id: string;
  folder_id: string;
  file_id: string;
  name: string;
  mime_type: string;
  is_video: boolean;
  height: number;
  width: number;
  imported_on: Date;
  taken_on?: Date;
  modified_on?: Date;
  rating?: number;
  title?: string;
  comments?: string;
  camera_make?: string;
  camera_model?: string;
  latitude?: string;
  longitude?: string;
  altitude?: string;
  file_size: number;
  file_size_sm?: number;
  file_size_md?: number;
  file_size_lg?: number;
  file_size_cnv_video?: number;
  file_size_backup?: number;
  is_processing: number;
  tags: string;
}

/**
 * Structure which contains information essential to
 * retrieving the contents of a file.
 */
export interface IDbFileContentInfo {
  library_id: string;
  folder_id: string;
  file_id: string;
  name: string;
  is_video: boolean;
  mime_type: string;
  path: string;
  is_processing: boolean;
  metadata_ex?: string;
}

export interface IDbAlbum {
  library_id: string;
  album_id: string;
  name: string;
  query: string;
  where: string;
  order_by: string;
}

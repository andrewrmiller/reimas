/**
 * @interface ILibrary
 *
 * Representation of a library.
 *
 * @prop libraryId - Unique ID of the library.
 * @prop name - Name of the library.
 * @prop description - Description of the library.
 */
export interface ILibrary {
  libraryId: string;
  name: string;
  description?: string;
}

/**
 * @interface ILibraryAdd
 *
 * Information passed to the API to create a new folder.
 *
 * @prop libraryId - Unique ID of the library as GUID (optional).
 * @prop name - Name of the library to create.
 * @prop description - Description of the library.
 */
export interface ILibraryAdd {
  libraryId?: string;
  name: string;
  description?: string;
}

/**
 * @interface ILibraryUpdate
 *
 * Information passed to the API to update an existing library.
 *
 * @prop name - The new name of the library.
 * @prop description - Updated description for the library.
 */
export interface ILibraryUpdate {
  name?: string;
  description?: string;
}

/**
 * Enumeration of the different types of folders.
 */
export enum FolderType {
  // Standard picture folder.  May contain pictures, videos and
  // child picture folders.
  Picture = 'picture',

  // Search folder parent.  Used to create a heirarchy of search
  // folders.  e.g.:
  //
  //   Search Folders
  //      Ratings
  //          ... search folders here...
  //      Keywords
  //          ... search folders here...
  //
  // May contain search folders and other search parent folders.
  SearchParent = 'search_parent',

  // Search folder which executes a query to return folder contents.
  // e.g. "Rating = 5", "Keywords = Family", etc.  May not contain
  // pictures, videos or child folders.
  Search = 'search'
}

/**
 * @interface IFolder
 *
 * Representation of a folder.
 *
 * @prop libraryId - Unique ID of the containing library.
 * @prop folderId - Unique ID of the folder.
 * @prop name - The name of the folder (e.g. 'Summer BBQ').
 * @prop parentId - Unique ID of the parent folder or null for root folders.
 * @prop type - The type of folder.
 * @prop path - Path to the folder in the file system.  Relative to file system root.
 * @prop fileCount - Number of pictures in the folder (excludes thumbnails).
 * @prop fileSize - Total size for the pictures in the folder (excludes thumbnails).
 * @prop fileSizeSm - Total size of small thumbnails.
 * @prop fileSizeMd - Total size of medium thumbnails.
 * @prop fileSizeLg - Total size of large thumbnails.
 * @prop data - Data associated with the folder.
 * @prop where - Where clause used to retrieve folder contents.
 * @prop orderBy - Order by clause used when retrieving folder contents.
 */
export interface IFolder {
  libraryId: string;
  folderId: string;
  name: string;
  parentId: string | null;
  type: FolderType;
  path: string;
  fileCount: number;
  fileSize: number;
  fileSizeSm: number;
  fileSizeMd: number;
  fileSizeLg: number;
  data: string;
  where: string;
  orderBy: string;
}

/**
 * @interface IFolderAdd
 *
 * Information passed to the API to create a new folder.
 *
 * @prop parentId - Unique ID of parent folder or null to create a new top level folder.
 * @prop name - Name of the folder (e.g. 'Summer BBQ').  Must be unique within the parent.
 * @prop type - The type of folder.
 */
export interface IFolderAdd {
  // Set parentId to null to create a top level folder.
  parentId: string | null;
  name: string;
  type: FolderType;
}

/**
 * @interface IFolderUpdate
 *
 * Information passed to the API to update an existing folder.
 *
 * @prop name - The new name of the folder.  Must be unique within the parent.
 */
export interface IFolderUpdate {
  name?: string;
}

/**
 * @interface IFile
 *
 * Representation of a file.
 *
 * @prop libraryId - Unique ID of the parent library.
 * @prop folderId - Unique ID of the parent folder.
 * @prop fileId - Unique ID of the file.
 * @prop name - Name of the file.
 * @prop mimeType - Type of file.
 * @prop isVideo - True if this is a video.
 * @prop height - Height of the picture in pixels.
 * @prop width - Width of the picture in pixels
 * @prop importedOn - Date that the file was imported.
 * @prop takenOn - Date when the picture was taken.
 * @prop modifiedOn - Date when the file was last modified.
 * @prop rating - Rating of the picture.
 * @prop title - Title of the picture.
 * @prop subject - Subject of the picture.
 * @prop comments - Comments about the picture.
 * @prop fileSize - Size of the picture in bytes.
 * @prop fileSizeSm - Size of the small thumbnail in bytes.
 * @prop fileSizeMd - Szie of the medium thumbnail in bytes.
 * @prop fileSizeLg - Size of the large thumbnail in bytes.
 * @prop fileSizeBackup - Szie of the backup picture in bytes.
 * @prop isProcessing - True if we are currently processing this picture.
 */
export interface IFile {
  libraryId: string;
  folderId: string;
  fileId: string;
  name: string;
  mimeType: string;
  isVideo: boolean;
  height: number;
  width: number;
  importedOn: string;
  takenOn?: string;
  modifiedOn?: string;
  rating?: number;
  title?: string;
  subject?: string;
  comments?: string;
  fileSize: number;
  fileSizeSm?: number;
  fileSizeMd?: number;
  fileSizeLg?: number;
  fileSizeCnvVideo?: number;
  fileSizeBackup?: number;
  isProcessing: number;
}

export interface IFileAdd {
  name: string;
  mimeType: string;
  isVideo: boolean;
  height: number;
  width: number;
  fileSize: number;
  isProcessing: boolean;
}

export interface IFileUpdate {
  name?: string;
  rating?: number;
  title?: string;
  subject?: string;
}

export interface IFileContentInfo {
  libraryId: string;
  folderId: string;
  fileId: string;
  name: string;
  isVideo: boolean;
  mimeType: string;
  path: string;
  isProcessing: boolean;
}

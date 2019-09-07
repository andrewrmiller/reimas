export interface INewLibrary {
  name: string;
  description?: string;
}

export interface ILibrary {
  libraryId: string;
  name: string;
  description?: string;
}

export interface ILibraryPatch {
  name?: string;
  description?: string;
}

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
 * @interface INewFolder
 *
 * Information passed to the API to create a new folder.
 *
 * @prop parentId - Unique ID of parent folder or null to create a new top level folder.
 * @prop name - Name of the folder (e.g. 'Summer BBQ').  Must be unique within the parent.
 * @prop type - The type of folder.
 */
export interface INewFolder {
  // Set parentId to null to create a top level folder.
  parentId: string | null;
  name: string;
  type: FolderType;
}

/**
 * @interface IFolderPatch
 *
 * Information passed to the API to update an existing folder.
 *
 * @prop name - The new name of the folder.  Must be unique within the parent.
 */
export interface IFolderPatch {
  name?: string;
}

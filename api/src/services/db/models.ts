export interface INewLibrary {
  name: string;
  description?: string;
}

export interface ILibrary {
  libraryId: number;
  name: string;
  description?: string;
}

export interface ILibraryPatch {
  name?: string;
  description?: string;
}

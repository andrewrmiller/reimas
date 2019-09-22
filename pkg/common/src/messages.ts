import { ThumbnailSize } from './thumbnails';

export interface IResizePictureMsg {
  libraryId: string;
  fileId: string;
  size: ThumbnailSize;
}

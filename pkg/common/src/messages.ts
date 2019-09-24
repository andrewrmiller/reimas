import { ThumbnailSize } from './thumbnails';

/**
 * Enumeration of the types of messages that can be posted to the queue.
 */
export enum MessageType {
  ResizePicture,
  RecalcFolder
}

/**
 * Base interface for a queued message.
 */
export interface IMessage {
  type: MessageType;
}

/**
 * Message posted when a thumbnail should be generated
 * for a picture in the store.
 */
export interface IResizePictureMsg extends IMessage {
  libraryId: string;
  fileId: string;
  size: ThumbnailSize;
}

/**
 * Message posted when a folder's metrics should be recalculated.
 */
export interface IRecalcFolderMsg extends IMessage {
  libraryId: string;
  folderId: string;
}

import { IExportJob } from '@picstrata/client';

/**
 * Enumeration of the types of messages that can be posted to the queue.
 */
export enum MessageType {
  ProcessPicture,
  ProcessVideo,
  RecalcFolder,
  ExportFiles
}

/**
 * Base interface for a queued message.
 */
export interface IMessage {
  type: MessageType;
}

/**
 * Message posted when an uploaded picture should be processed.
 */
export interface IProcessPictureMsg extends IMessage {
  libraryId: string;
  fileId: string;
}

/**
 * Message posted when an uplooaded video file should be processed.
 */
export interface IProcessVideoMsg extends IMessage {
  libraryId: string;
  fileId: string;
  convertToMp4: boolean;
}

/**
 * Message posted when a folder's metrics should be recalculated.
 */
export interface IRecalcFolderMsg extends IMessage {
  libraryId: string;
  folderId: string;
}

export interface IExportFilesMsg extends IMessage {
  exportJob: IExportJob;
}

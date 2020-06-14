import { IFile } from '@picstrata/client';

/**
 * Base interface used by both consumers and producers.
 */
export interface IQueueClient {
  getQueueLength(): Promise<number>;
}

/**
 * Interface implemented by queue producers.
 */
export interface IQueueProducer extends IQueueClient {
  enqueueRecalcFolderJob(libraryId: string, folderId: string): Promise<void>;
  enqueueProcessFileJob(file: IFile): Promise<void>;
}

import { IFile } from '@picstrata/client';

/**
 * Interface implemented by queue producers.
 */
export interface IQueueProducer {
  enqueueRecalcFolderJob(libraryId: string, folderId: string): Promise<void>;
  enqueueProcessFileJob(file: IFile): Promise<void>;
}

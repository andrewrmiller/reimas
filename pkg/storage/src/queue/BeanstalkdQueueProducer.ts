import { IExportJob, IFile } from '@picstrata/client';
import { Paths, VideoExtension } from 'common';
import createDebug from 'debug';
import {
  BeanstalkdConnection,
  NormalJobPriority
} from './BeanstalkdConnection';
import { IQueueProducer } from './IQueueClient';
import {
  IExportFilesMsg,
  IMessage,
  IProcessPictureMsg,
  IProcessVideoMsg,
  IRecalcFolderMsg,
  MessageType
} from './messages';
import { JobsChannelName } from './workers';

const debug = createDebug('storage:queueproducer');
const JobDelay = 0;
const JobLengthMaxSeconds = 60;

export class BeanstalkdQueueProducer
  extends BeanstalkdConnection
  implements IQueueProducer
{
  public enqueueRecalcFolderJob(
    libraryId: string,
    folderId: string
  ): Promise<void> {
    debug('Publishing recalc folder message.');
    return this.enqueue({
      type: MessageType.RecalcFolder,
      libraryId,
      folderId
    } as IRecalcFolderMsg);
  }

  public enqueueProcessFileJob(file: IFile) {
    if (!file.isVideo) {
      debug('Publishing thumbnail creation jobs.');
      return this.enqueue({
        type: MessageType.ProcessPicture,
        libraryId: file.libraryId,
        fileId: file.fileId
      } as IProcessPictureMsg);
    } else {
      debug('Publishing video conversion job.');
      return this.enqueue({
        type: MessageType.ProcessVideo,
        libraryId: file.libraryId,
        fileId: file.fileId,
        convertToMp4: Paths.getFileExtension(file.name) !== VideoExtension.MP4
      } as IProcessVideoMsg);
    }
  }

  public enqueueExportJob(exportJob: IExportJob) {
    debug(
      `Publishing export job ${exportJob.jobId} to create ${exportJob.filename}`
    );
    return this.enqueue({
      type: MessageType.ExportFiles,
      exportJob
    } as IExportFilesMsg);
  }

  private enqueue(message: IMessage) {
    const conn = this.connection;
    if (!conn) {
      debug(`Error: Unable to connect to Beanstalkd to enqueue message.`);
      throw new Error('Failed to enqueue message.');
    }

    debug(`Enqueueing the message to tube ${JobsChannelName}`);
    return conn.use(JobsChannelName).then(() => {
      conn.put(
        NormalJobPriority,
        JobDelay,
        JobLengthMaxSeconds,
        Buffer.from(JSON.stringify(message))
      );
    });
  }
}

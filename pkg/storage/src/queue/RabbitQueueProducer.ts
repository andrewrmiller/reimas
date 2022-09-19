import { IExportJob, IFile } from '@picstrata/client';
import amqp from 'amqplib';
import Promise from 'bluebird';
import { Paths, VideoExtension } from 'common';
import createDebug from 'debug';
import { AmqpConnection } from './AmqpConnection';
import { IQueueProducer } from './IQueueClient';
import {
  IExportFilesMsg,
  IProcessPictureMsg,
  IProcessVideoMsg,
  IRecalcFolderMsg,
  MessageType
} from './messages';
import { JobsChannelName } from './workers';

const debug = createDebug('storage:queueproducer');

export class RabbitQueueProducer
  extends AmqpConnection
  implements IQueueProducer
{
  public enqueueRecalcFolderJob(
    libraryId: string,
    folderId: string
  ): Promise<void> {
    return this.enqueue(ch => {
      debug('Publishing recalc folder message.');
      const message: IRecalcFolderMsg = {
        type: MessageType.RecalcFolder,
        libraryId,
        folderId
      };
      if (
        !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
      ) {
        throw new Error('Failed to enqueue recalc folder message.');
      }
    });
  }

  public enqueueProcessFileJob(file: IFile) {
    let message: IProcessPictureMsg | IProcessVideoMsg;
    return this.enqueue(ch => {
      if (!file.isVideo) {
        debug('Publishing thumbnail creation jobs.');
        message = {
          type: MessageType.ProcessPicture,
          libraryId: file.libraryId,
          fileId: file.fileId
        } as IProcessPictureMsg;
      } else {
        debug('Publishing video conversion job.');
        message = {
          type: MessageType.ProcessVideo,
          libraryId: file.libraryId,
          fileId: file.fileId,
          convertToMp4: Paths.getFileExtension(file.name) !== VideoExtension.MP4
        } as IProcessVideoMsg;
      }

      if (
        !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
      ) {
        throw new Error('Failed to enqueue process picture/video message.');
      }
    });
  }

  public enqueueExportJob(exportJob: IExportJob) {
    return this.enqueue(ch => {
      debug('Publishing export files job.');
      const message = {
        type: MessageType.ExportFiles,
        exportJob
      } as IExportFilesMsg;
      if (
        !ch.sendToQueue(JobsChannelName, Buffer.from(JSON.stringify(message)))
      ) {
        throw new Error('Failed to enqueue export files message.');
      }
    });
  }

  private enqueue(callback: (ch: amqp.Channel) => void) {
    const conn = this.connection;
    if (!conn) {
      debug(`Error: Unable to connect to RabbitMQ to enqueue message.`);
      throw new Error('Failed to enqueue message.');
    }

    debug('Creating RabbitMQ channel and enqueing message...');
    return conn.createChannel().then(ch => {
      return ch
        .assertQueue(JobsChannelName)
        .then(() => {
          const result = callback(ch);
          ch.close();
          return result;
        })
        .catch(err => {
          debug(`Error while communicating with RabbitMQ: ${err}`);
          throw err;
        });
    });
  }
}

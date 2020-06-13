import createDebug from 'debug';
import {
  IMessage,
  IProcessPictureMsg,
  IProcessVideoMsg,
  IRecalcFolderMsg,
  MessageType,
  QueueFactory
} from 'storage';
import { processPicture } from './processPicture';
import { processVideo } from './processVideo';
import { recalcFolder } from './recalcFolder';

const debug = createDebug('workers:consumer');
const queue = QueueFactory.createConsumerInstance(processMessage);

/**
 * Processes a message received from the queue.
 *
 * @param message The message to process.
 * @param tag Identifying string associated with the message.
 */
function processMessage(message: IMessage, tag: string): Promise<boolean> {
  let p: Promise<boolean>;

  switch (message.type) {
    case MessageType.ProcessPicture:
      debug(`Tag ${tag}: Processing picture.`);
      p = processPicture(message as IProcessPictureMsg);
      break;

    case MessageType.ProcessVideo:
      debug(`Tag ${tag}: Processing video.`);
      p = processVideo(message as IProcessVideoMsg);
      break;

    case MessageType.RecalcFolder:
      debug(`Tag ${tag}: Recalculating folder.`);
      p = recalcFolder(message as IRecalcFolderMsg);
      break;

    default:
      throw new Error('Uknown message type found in queue.');
  }

  return p
    .then(success => {
      debug(`Tag ${tag} processing result: ${success}.`);
      return success;
    })
    .catch(err => {
      debug(`Error caught while processing message: ${err.message}`);
      return false;
    });
}

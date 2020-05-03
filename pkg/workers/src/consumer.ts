import amqp from 'amqplib';
import createDebug from 'debug';
import {
  AmqpConnectionWrapper,
  IMessage,
  IProcessPictureMsg,
  IProcessVideoMsg,
  IRecalcFolderMsg,
  JobsChannelName,
  MessageType
} from 'storage';
import { processPicture } from './processPicture';
import { processVideo } from './processVideo';
import { recalcFolder } from './recalcFolder';

const debug = createDebug('workers:consumer');

const amqpWrapper = new AmqpConnectionWrapper(startWorker);
let amqpChan: amqp.Channel | undefined;

/**
 * Creates the RabbitMQ channel and initializes the queue consumer.
 */
function startWorker() {
  const conn = amqpWrapper.getConnection();
  if (!conn) {
    debug(`Error: Unable to connect to RabbitMQ to start worker.`);
    return;
  }

  conn!
    .createChannel()
    .then(ch => {
      amqpChan = ch;

      ch.on('error', err => {
        debug('RabbitMQ channel error: ' + err.message);
      });

      ch.on('close', () => {
        debug('RabbitMQ channel closed.');
      });

      // We process up to three async jobs at a time.
      ch.prefetch(1);

      return ch.assertQueue(JobsChannelName, { durable: true }).then(ok => {
        return ch
          .consume(JobsChannelName, handleMessageReceived, { noAck: false })
          .then(() => {
            debug('Worker initialized successfully.');
          });
      });
    })
    .catch(errorHandler);
}

/**
 * Handles the receipt of an incoming message from the queue.
 *
 * @param msg Message to process.
 */
function handleMessageReceived(msg: amqp.ConsumeMessage | null) {
  if (msg) {
    processMessage(msg, (ok: boolean) => {
      try {
        // Channel may have gone down while the message was
        // being processed.  In this case the message will
        // be requeued.
        if (!amqpChan) {
          return;
        }

        if (ok) {
          amqpChan.ack(msg);
        } else {
          // We retry once on failure.
          amqpChan.nack(msg, true, !msg.fields.redelivered);
        }
      } catch (err) {
        errorHandler(err);
      }
    });
  }
}

/**
 * Processes a message received from the queue.
 *
 * @param msg The message to process.
 * @param callback Invoked when processing is complete.
 */
async function processMessage(
  msg: amqp.ConsumeMessage,
  callback: (ok: boolean) => void
) {
  const message = JSON.parse(msg.content.toString()) as IMessage;
  let p: Promise<boolean>;

  switch (message.type) {
    case MessageType.ProcessPicture:
      debug(`Delivery tag ${msg.fields.deliveryTag}: Processing picture.`);
      p = processPicture(message as IProcessPictureMsg);
      break;

    case MessageType.ProcessVideo:
      debug(`Delivery tag ${msg.fields.deliveryTag}: Processing video.`);
      p = processVideo(message as IProcessVideoMsg);
      break;

    case MessageType.RecalcFolder:
      debug(`Delivery tag ${msg.fields.deliveryTag}: Recalculating folder.`);
      p = recalcFolder(message as IRecalcFolderMsg);
      break;

    default:
      throw new Error('Uknown message type found in queue.');
  }

  // Wait for the processing to complete and then continue.
  await p
    .then(result => {
      debug(
        `Delivery tag ${msg.fields.deliveryTag} processing result: ${result}.`
      );
      callback(result);
    })
    .catch(err => {
      debug(`Error caught while processing message: ${err.message}`);
      callback(false);
    });
}

/**
 * Handles errors received from AMQP.
 *
 * @param err Error received from AMQP.
 */
function errorHandler(err: Error) {
  debug('RabbitMQ error: ' + err);

  if (amqpChan) {
    amqpChan.close();
    amqpChan = undefined;
  }

  if (amqpWrapper) {
    amqpWrapper.close();
  }

  return true;
}

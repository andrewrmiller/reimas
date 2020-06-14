import createDebug from 'debug';
import {
  BeanstalkdConnection,
  BuriedJobPriority,
  NormalJobPriority
} from './BeanstalkdConnection';
import { IQueueClient } from './IQueueClient';
import { IMessage } from './messages';
import { JobsChannelName } from './workers';

const debug = createDebug('storage:queueconsumer');

export class BeanstalkdQueueConsumer extends BeanstalkdConnection
  implements IQueueClient {
  private messageHandler: (message: IMessage, tag: string) => Promise<boolean>;

  constructor(
    host: string,
    messageHandler: (message: IMessage, tag: string) => Promise<boolean>
  ) {
    super(host);
    this.handleMessageReceived = this.handleMessageReceived.bind(this);
    this.messageHandler = messageHandler;
  }

  /**
   * Initializes the Beanstalkd queue consumer.
   */
  protected async onConnected() {
    let conn = this.connection;
    if (!conn) {
      debug(`Error: Unable to connect to Beanstalkd to start worker.`);
      return;
    }

    // Type definition for watch seems to be incorrect.  It is expecting
    // a number whereas the docs and comments require a string.
    await conn.watch(JobsChannelName as any);

    while (conn) {
      await conn
        .reserve()
        .then((value: [string, Buffer]) => {
          const jobId = parseInt(value[0], 10);
          const jobData = value[1].toString();
          const message = JSON.parse(jobData) as IMessage;
          return this.handleMessageReceived(jobId, message);
        })
        .catch(this.handleError);
      conn = this.connection;
    }

    debug('Beanstalkd connection lost.  Aborting reserve loop.');
  }

  /**
   * Handles the receipt of an incoming message from the queue.
   *
   * @param jobId Beanstalkd identifier for the job.
   * @param msg Message to process.
   */
  private handleMessageReceived(jobId: number, message: IMessage) {
    debug(`Received jobId ${jobId}.  Message=${JSON.stringify(message)}`);
    return this.messageHandler!(message, `${jobId}`)
      .then(success => {
        const conn = this.connection;
        // Connection may have gone down while the message was
        // being processed.  In this case the message will
        // be requeued.
        if (!conn) {
          return;
        }

        if (success) {
          conn.destroy(jobId);
        } else {
          // The operation failed.  Look at the priority of the job to
          // determine if this is the first time we've run it.  If so then
          // requeue with a lower priority.  Otherwise destroy the job.
          conn.statsJob(jobId).then(stats => {
            if (stats.pri === NormalJobPriority) {
              debug(`Job ${jobId} failed.  Requeueing with lower priority...`);
              conn.bury(jobId, BuriedJobPriority).then(() => {
                conn.kick(jobId);
              });
            } else {
              debug(`Job ${jobId} failed on retry.  Deleting...`);
              conn.destroy(jobId);
            }
          });
        }
      })
      .catch(err => {
        debug(
          `Uncaught error occurred while processing message: ${message.type}.`
        );
        this.handleError(err);
      });
  }

  /**
   * Handles errors received from Beanstalkd.
   *
   * @param err Error received from Beanstalkd.
   */
  private handleError(err: Error) {
    debug('Beanstalkd error: $O', err);

    // Close the connection.  The base class will detect the closure
    // and try to reconnect after a short delay.
    this.close();
  }
}

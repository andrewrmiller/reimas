import amqp from 'amqplib';
import createDebug from 'debug';
import { AmqpConnection } from './AmqpConnection';
import { IQueueClient } from './IQueueClient';
import { IMessage } from './messages';
import { JobsChannelName } from './workers';

const debug = createDebug('storage:queueconsumer');

export class RabbitQueueConsumer
  extends AmqpConnection
  implements IQueueClient
{
  private messageHandler: (message: IMessage, tag: string) => Promise<boolean>;
  private consumerChannel?: amqp.Channel;

  constructor(
    host: string,
    messageHandler: (message: IMessage, tag: string) => Promise<boolean>
  ) {
    super(host);
    this.handleMessageReceived = this.handleMessageReceived.bind(this);
    this.messageHandler = messageHandler;
  }

  /**
   * Creates the RabbitMQ channel and initializes the queue consumer.
   */
  protected onConnected() {
    const conn = this.connection;
    if (!conn) {
      debug(`Error: Unable to connect to RabbitMQ to start worker.`);
      return;
    }

    conn!
      .createChannel()
      .then(ch => {
        this.consumerChannel = ch;

        ch.on('error', err => {
          debug('RabbitMQ channel error: ' + err.message);
        });

        ch.on('close', () => {
          debug('RabbitMQ channel closed.');
        });

        ch.prefetch(1);

        return ch.assertQueue(JobsChannelName, { durable: true }).then(() => {
          return ch
            .consume(JobsChannelName, this.handleMessageReceived, {
              noAck: false
            })
            .then(() => {
              debug('Worker initialized successfully.');
            });
        });
      })
      .catch(this.handleError);
  }

  /**
   * Handles the receipt of an incoming message from the queue.
   *
   * @param msg Message to process.
   */
  private handleMessageReceived(msg: amqp.ConsumeMessage | null) {
    if (msg) {
      const message = JSON.parse(msg.content.toString()) as IMessage;
      this.messageHandler(message, `${msg.fields.deliveryTag}`)
        .then(success => {
          // Channel may have gone down while the message was
          // being processed.  In this case the message will
          // be requeued.
          if (!this.consumerChannel) {
            return;
          }

          if (success) {
            this.consumerChannel.ack(msg);
          } else {
            // We retry once on failure.
            this.consumerChannel.nack(msg, true, !msg.fields.redelivered);
          }
        })
        .catch(err => {
          debug(
            `Uncaught error occurred while processing message: ${message.type}.`
          );
          this.handleError(err);
        });
    }
  }

  /**
   * Handles errors received from AMQP.
   *
   * @param err Error received from AMQP.
   */
  private handleError(err: Error) {
    debug('RabbitMQ error: ' + err);

    if (this.consumerChannel) {
      this.consumerChannel.close();
      this.consumerChannel = undefined;
    }

    // Close the connection.  The base class will detect the closure
    // and try to reconnect after a short delay.
    this.close();
  }
}

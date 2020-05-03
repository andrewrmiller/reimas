import amqp from 'amqplib';
import config from 'config';
import createDebug from 'debug';
import { IMessageQueueConfig } from './config/IMessageQueueConfig';

const debug = createDebug('storage:messagequeue');
const RetryConnectDelayMs = 1000;
const messageQueueConfig: IMessageQueueConfig = config.get('MessageQueue');

/**
 * Wrapper class for an AMQP connection instance.  Ensures that the connection
 * is established even if the MQ server is not available initially.  Also
 * reestablishes connections that are closed unexpectedly.
 */
export class AmqpConnectionWrapper {
  private onConnect?: () => void;
  private connection: amqp.Connection | undefined;

  public constructor(onConnect?: () => void) {
    debug(`Connecting to RabbitMQ server at ${messageQueueConfig.url}`);
    this.onConnect = onConnect;
    this.connect = this.connect.bind(this);
    this.connect();
  }

  public getConnection() {
    return this.connection;
  }

  public close() {
    if (this.connection) {
      this.connection.close();
      this.connection = undefined;
    }
  }

  private connect() {
    amqp
      .connect(`${messageQueueConfig.url}?heartbeat=60`)
      .then(conn => {
        conn.on('error', err => {
          if (err.message !== 'Connection closing') {
            debug(`Error communicating with RabbitMQ: ${err.message}`);
          }
        });

        conn.on('close', () => {
          debug('RabbitMQ connection closed.  Reconnecting...');
          this.connection = undefined;
          return setTimeout(this.connect, RetryConnectDelayMs);
        });

        debug('RabbitMQ connection established.');
        this.connection = conn;

        if (this.onConnect) {
          this.onConnect();
        }
      })
      .catch(err => {
        debug('Unexpected RabbitMQ error: ' + err.message);
        return setTimeout(this.connect, RetryConnectDelayMs);
      });
  }
}

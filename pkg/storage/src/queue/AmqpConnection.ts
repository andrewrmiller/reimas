import amqp from 'amqplib';
import createDebug from 'debug';

const debug = createDebug('storage:queue');
const RetryConnectDelayMs = 1000;

/**
 * Wrapper class for an AMQP connection instance.  Ensures that the connection
 * is established even if the MQ server is not available initially.  Also
 * reestablishes connections that are closed unexpectedly.
 */
export class AmqpConnection {
  protected connection: amqp.Connection | undefined;
  private host: string;

  public constructor(host: string) {
    debug(`Connecting to RabbitMQ server at amqp://${host}`);
    this.host = host;
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

  protected onConnected() {
    // Override in derived classes as necessary.
  }

  private connect() {
    amqp
      .connect(`amqp://${this.host}?heartbeat=60`)
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

        this.onConnected();
      })
      .catch(err => {
        debug('Unexpected RabbitMQ error: ' + err.message);
        return setTimeout(this.connect, RetryConnectDelayMs);
      });
  }
}

import amqp from 'amqplib';
import createDebug from 'debug';
import fetch, { Headers } from 'node-fetch';

const debug = createDebug('storage:queue');
const RetryConnectDelayMs = 1000;

// In order to retrieve the queue length from the RabbitMQ management server
// we need to provide authorization information.  We currently use basic auth
// and the default 'guest' login with 'guest' password.  Probably should pull
// this from the config at some point.
const AuthorizationHeader = 'Authorization';
const RabbitAuthHeaderValue = 'Basic Z3Vlc3Q6Z3Vlc3Q=';

/**
 * Wrapper class for an AMQP connection instance.  Ensures that the connection
 * is established even if the MQ server is not available initially.  Also
 * reestablishes connections that are closed unexpectedly.
 */
export class AmqpConnection {
  protected connection?: amqp.Connection;
  private host: string;

  public constructor(host: string) {
    debug(`Connecting to RabbitMQ server at amqp://${host}`);
    this.host = host;
    this.connect = this.connect.bind(this);
    this.connect();
  }

  public close() {
    if (this.connection) {
      this.connection.close();
      this.connection = undefined;
    }
  }

  public getQueueLength() {
    const conn = this.connection;
    if (!conn) {
      debug(`Error: Unable to connect to RabbitMQ to determine queue length.`);
      throw new Error('Failed to get queue length.');
    }

    const headers = new Headers();
    headers.append(AuthorizationHeader, RabbitAuthHeaderValue);

    return fetch(`http://${this.host}:15672/api/queues`, { headers }).then(
      response => {
        if (!response.ok) {
          throw new Error(
            `Received ${response.status} trying to get queue length`
          );
        }
        return response.json().then(queues => {
          return queues[0].messages as number;
        });
      }
    );
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
          debug('RabbitMQ connection closed.');
          this.connection = undefined;
          debug('Reconnecting...');
          return setTimeout(this.connect, RetryConnectDelayMs);
        });

        debug('RabbitMQ connection established.');
        this.connection = conn;

        this.onConnected();
      })
      .catch(err => {
        debug('Unexpected RabbitMQ error: %O', err);
        debug('Reconnecting...');
        return setTimeout(this.connect, RetryConnectDelayMs);
      });
  }
}

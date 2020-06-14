import Beanstalkd from 'beanstalkd';
import createDebug from 'debug';

export const NormalJobPriority = 0;
export const BuriedJobPriority = 5;

const debug = createDebug('storage:queue');
const RetryConnectDelayMs = 1000;
const BeanstalkdPort = 11300;

export class BeanstalkdConnection {
  protected connection?: Beanstalkd;
  private host: string;

  constructor(host: string) {
    debug(`Connecting to Beanstalkd server on ${host}`);
    this.host = host;
    this.connect = this.connect.bind(this);
    this.connect();
  }

  public close() {
    if (this.connection) {
      this.connection.quit();
      this.connection = undefined;
    }
  }

  public getQueueLength() {
    const conn = this.connection;
    if (!conn) {
      debug(
        `Error: Unable to connect to Beanstalkd to determine queue length.`
      );
      throw new Error('Failed to get queue length.');
    }

    return conn.stats().then(stats => {
      return stats['current-jobs-ready'] + stats['current-jobs-reserved'];
    });
  }

  protected onConnected() {
    // Override in derived classes as necessary.
  }

  private connect() {
    const beanstalkd = new Beanstalkd(this.host, BeanstalkdPort);
    beanstalkd
      .connect()
      .then(conn => {
        conn.on('error', (err: Error) => {
          debug(`Error communicating with Beanstalkd: ${err.message}`);
        });
        conn.on('close', (hadError: boolean) => {
          debug(`Beanstalkd connection closed (hadError=${hadError}).`);
          this.connection = undefined;
          debug(`Reconnecting...`);
          return setTimeout(this.connect, RetryConnectDelayMs);
        });

        debug('Beanstalkd connection established.');
        this.connection = conn;

        this.onConnected();
      })
      .catch(err => {
        debug('Unexpected Beanstalkd error: $O', err);
        debug(`Reconnecting...`);
        return setTimeout(this.connect, RetryConnectDelayMs);
      });
  }
}

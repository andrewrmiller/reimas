import config from 'config';
import { IQueueConfig, QueueType } from '../config/IQueueConfig';
import { IQueueProducer } from './IQueueProducer';
import { IMessage } from './messages';
import { RabbitQueueConsumer } from './RabbitQueueConsumer';
import { RabbitQueueProducer } from './RabbitQueueProducer';

export class QueueFactory {
  public static createProducerInstance(): IQueueProducer {
    const queueConfig = config.get('Queue') as IQueueConfig;

    switch (queueConfig.type) {
      case QueueType.Beanstalkd:
        // return new LocalFileSystem(queueConfig.host);
        throw new Error('Not yet implemented!');
      case QueueType.RabbitMQ:
        return new RabbitQueueProducer(queueConfig.host);
      default:
        throw new Error('Configured queue is not recognized.');
    }
  }

  public static createConsumerInstance(
    messageHandler?: (message: IMessage, tag: string) => Promise<boolean>
  ): any {
    const queueConfig = config.get('Queue') as IQueueConfig;

    switch (queueConfig.type) {
      case QueueType.Beanstalkd:
        // return new LocalFileSystem(queueConfig.host);
        throw new Error('Not yet implemented!');
      case QueueType.RabbitMQ:
        return new RabbitQueueConsumer(queueConfig.host, messageHandler);
      default:
        throw new Error('Configured queue is not recognized.');
    }
  }
}

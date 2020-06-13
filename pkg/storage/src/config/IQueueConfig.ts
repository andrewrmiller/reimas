export enum QueueType {
  Beanstalkd = 'beanstalkd',
  RabbitMQ = 'rabbitmq'
}

export interface IQueueConfig {
  type: QueueType;
  host: string;
}

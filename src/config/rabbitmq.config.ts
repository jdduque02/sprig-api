import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

export const getRabbitMQConfig = (
  configService: ConfigService,
): MicroserviceOptions => {
  const durableQueue =
    configService.get<string>('RABBITMQ_QUEUE_DURABLE', 'true') === 'true';

  return {
    transport: Transport.RMQ,
    options: {
      urls: [
        configService.get<string>(
          'RABBITMQ_URL',
          'amqp://guest:guest@localhost:5672',
        ),
      ],
      queue: configService.get<string>('RABBITMQ_QUEUE', 'cost_manager_queue'),
      queueOptions: {
        durable: durableQueue,
      },
      noAck: false,
    },
  };
};

import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { getRabbitMQConfig } from '@config/rabbitmq.config';

describe('getRabbitMQConfig', () => {
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    };
  });

  it('debe construir la configuración de RMQ con valores del entorno', () => {
    (mockConfigService.get as jest.Mock).mockImplementation(
      (key: string, defaultValue?: unknown) => {
        const env: Record<string, unknown> = {
          RABBITMQ_URL: 'amqp://app:secret@localhost:5672',
          RABBITMQ_QUEUE: 'cost_manager_events',
          RABBITMQ_QUEUE_DURABLE: 'false',
        };
        return env[key] ?? defaultValue;
      },
    );

    const config = getRabbitMQConfig(mockConfigService as ConfigService);

    expect(config).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://app:secret@localhost:5672'],
        queue: 'cost_manager_events',
        queueOptions: { durable: false },
        noAck: false,
      },
    });
  });

  it('debe aplicar valores por defecto cuando no hay variables de entorno', () => {
    (mockConfigService.get as jest.Mock).mockImplementation(
      (_: string, defaultValue?: unknown) => defaultValue,
    );

    const config = getRabbitMQConfig(mockConfigService as ConfigService);

    expect(config).toEqual({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://guest:guest@localhost:5672'],
        queue: 'cost_manager_queue',
        queueOptions: { durable: true },
        noAck: false,
      },
    });
  });
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RmqOptions } from '@nestjs/microservices';
import {
  DiskHealthIndicator,
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { getRabbitMQConfig } from '@config/rabbitmq.config';
import { RedisHealthIndicator } from '@admin/indicators/redis-health.indicator';

/**
 * Orquesta los health indicators de las dependencias externas del servicio
 * (Postgres, Redis, RabbitMQ, Keycloak) y del propio proceso (memoria, disco).
 *
 * Reutiliza la configuración ya existente para cada dependencia
 * (`rabbitmq.config.ts`, `redis.config.ts` vía `CACHE_MANAGER`, `DataSource`
 * global de TypeORM) en vez de crear conexiones nuevas.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly microservice: MicroserviceHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  private get memoryHeapThresholdBytes(): number {
    return (
      this.configService.get<number>('HEALTH_MEMORY_HEAP_MB', 300) * 1024 * 1024
    );
  }

  private get memoryRssThresholdBytes(): number {
    return (
      this.configService.get<number>('HEALTH_MEMORY_RSS_MB', 300) * 1024 * 1024
    );
  }

  private get diskPath(): string {
    const configured = this.configService.get<string>('HEALTH_DISK_PATH');
    if (configured) return configured;
    return process.platform === 'win32' ? 'C:\\' : '/';
  }

  private get diskThresholdPercent(): number {
    return this.configService.get<number>('HEALTH_DISK_THRESHOLD_PERCENT', 0.9);
  }

  private get keycloakUrl(): string | undefined {
    const baseUrl = this.configService.get<string>('KEYCLOAK_URL');
    const realm = this.configService.get<string>('KEYCLOAK_REALM');
    if (!baseUrl || !realm) return undefined;
    return `${baseUrl.replace(/\/$/, '')}/realms/${realm}`;
  }

  /**
   * Ejecuta todos los health indicators registrados. Pensado para exponerse
   * en un endpoint público (probe de infraestructura), sin datos sensibles.
   */
  async check(): Promise<HealthCheckResult> {
    const keycloakUrl = this.keycloakUrl;

    return this.healthCheckService.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => {
        const rmqConfig = getRabbitMQConfig(this.configService) as RmqOptions;
        return this.microservice.pingCheck('rabbitmq', {
          transport: rmqConfig.transport,
          options: rmqConfig.options,
          // Antes usaba el timeout por defecto de Terminus (1000ms); una
          // conexión RMQ real tarda más que eso en confirmarse y la promesa
          // perdedora del connect() quedaba sin capturar, apareciendo luego
          // como unhandledRejection. Se alinea con el timeout de keycloak.
          timeout: 3000,
        });
      },
      () => this.memory.checkHeap('memory_heap', this.memoryHeapThresholdBytes),
      () => this.memory.checkRSS('memory_rss', this.memoryRssThresholdBytes),
      () =>
        this.disk.checkStorage('disk', {
          path: this.diskPath,
          thresholdPercent: this.diskThresholdPercent,
        }),
      ...(keycloakUrl
        ? [
            () =>
              this.http.pingCheck('keycloak', keycloakUrl, { timeout: 3000 }),
          ]
        : []),
    ]);
  }
}

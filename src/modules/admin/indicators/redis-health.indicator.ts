import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Cache } from 'cache-manager';

/**
 * Health indicator custom para Redis, reutilizando el `CACHE_MANAGER` ya
 * configurado en `SharedModule`/`redis.config.ts` (mismo patrón que
 * `PresenceService`/`IpBlockService`) en vez de abrir una conexión nueva.
 *
 * Hace un round-trip real (SET + GET) sobre una clave de sondeo con TTL corto,
 * en vez de solo verificar que el cliente esté "conectado".
 */
@Injectable()
export class RedisHealthIndicator {
  private static readonly PROBE_KEY = 'health:redis:probe';
  private static readonly PROBE_VALUE = 'ok';
  private static readonly PROBE_TTL_MS = 5_000;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Verifica que Redis responde a un ciclo set/get dentro del timeout dado.
   * @param key Clave que identifica el indicador en el resultado del health check.
   * @param timeoutMs Timeout máximo permitido para el round-trip (ms).
   */
  async pingCheck<Key extends string>(
    key: Key,
    timeoutMs = 2_000,
  ): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.withTimeout(this.roundTrip(), timeoutMs);
      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return indicator.down(message);
    }
  }

  private async roundTrip(): Promise<void> {
    await this.cacheManager.set(
      RedisHealthIndicator.PROBE_KEY,
      RedisHealthIndicator.PROBE_VALUE,
      RedisHealthIndicator.PROBE_TTL_MS,
    );
    const value = await this.cacheManager.get<string>(
      RedisHealthIndicator.PROBE_KEY,
    );
    if (value !== RedisHealthIndicator.PROBE_VALUE) {
      throw new Error('Redis round-trip mismatch');
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Redis ping timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }
}

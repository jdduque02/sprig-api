import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Storage de rate-limit respaldado por Redis (multi-instancia seguro).
 * Implementa la interfaz ThrottlerStorage de @nestjs/throttler v6.
 */
@Injectable()
export class ThrottlerStorageRedisService
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'throttle:';

  constructor(configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis throttler error: ${err.message}`);
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `${this.keyPrefix}${throttlerName}:${key}`;
    const blockKey = `${redisKey}:block`;

    const blocked = await this.redis.get(blockKey);
    if (blocked) {
      const blockTtl = await this.redis.pttl(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: ttl,
        isBlocked: true,
        timeToBlockExpire: blockTtl > 0 ? blockTtl : blockDuration,
      };
    }

    const multi = this.redis.multi();
    multi.incr(redisKey);
    multi.pexpire(redisKey, ttl);
    const results = await multi.exec();
    const totalHits = Number(results?.[0]?.[1] ?? 1);
    const timeToExpire = await this.redis.pttl(redisKey);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit && blockDuration > 0) {
      isBlocked = true;
      await this.redis.set(blockKey, '1', 'PX', blockDuration);
      timeToBlockExpire = blockDuration;
    }

    return {
      totalHits,
      timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
      isBlocked,
      timeToBlockExpire,
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}

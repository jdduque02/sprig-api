import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpBlockService {
  private readonly logger = new Logger(IpBlockService.name);

  private readonly maxAttempts: number;
  private readonly blockDurationMs: number;
  private readonly windowMs: number;

  private static readonly KEY_PREFIX = 'ip_block:';
  private static readonly ATTEMPTS_PREFIX = 'ip_attempts:';

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.maxAttempts = this.configService.get<number>(
      'IP_BLOCK_MAX_ATTEMPTS',
      5,
    );
    this.blockDurationMs = this.configService.get<number>(
      'IP_BLOCK_DURATION_MS',
      900_000,
    ); // 15 min
    this.windowMs = this.configService.get<number>(
      'IP_BLOCK_WINDOW_MS',
      600_000,
    ); // 10 min
  }

  async isBlocked(ip: string): Promise<boolean> {
    const key = `${IpBlockService.KEY_PREFIX}${ip}`;
    const blocked = await this.cacheManager.get<string>(key);
    return !!blocked;
  }

  async recordFailedAttempt(
    ip: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    const attemptsKey = `${IpBlockService.ATTEMPTS_PREFIX}${ip}`;
    const current = await this.cacheManager.get<number>(attemptsKey);
    const attempts = (current ?? 0) + 1;

    await this.cacheManager.set(attemptsKey, attempts, this.windowMs);

    if (attempts >= this.maxAttempts) {
      await this.blockIp(ip);
      return { blocked: true, remainingAttempts: 0 };
    }

    return { blocked: false, remainingAttempts: this.maxAttempts - attempts };
  }

  async resetAttempts(ip: string): Promise<void> {
    const attemptsKey = `${IpBlockService.ATTEMPTS_PREFIX}${ip}`;
    await this.cacheManager.del(attemptsKey);
    this.logger.log(`Intentos fallidos reiniciados para IP: ${ip}`);
  }

  async blockIp(ip: string): Promise<void> {
    const key = `${IpBlockService.KEY_PREFIX}${ip}`;
    await this.cacheManager.set(key, 'blocked', this.blockDurationMs);
    this.logger.warn(
      `IP bloqueada: ${ip} por ${this.blockDurationMs / 1000}s (máximo ${this.maxAttempts} intentos)`,
    );
  }

  async getRemainingBlockTime(ip: string): Promise<number> {
    const key = `${IpBlockService.KEY_PREFIX}${ip}`;
    const ttl = await this.cacheManager.get<string>(key);
    return ttl ? this.blockDurationMs : 0;
  }

  getLimits() {
    return {
      maxAttempts: this.maxAttempts,
      blockDurationMs: this.blockDurationMs,
      windowMs: this.windowMs,
    };
  }
}

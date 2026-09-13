import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private static readonly KEY_PREFIX = 'online:';
  private readonly ttlMs: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.ttlMs = this.configService.get<number>('PRESENCE_TTL_MS', 120_000);
  }

  private key(userId: string | number): string {
    return `${PresenceService.KEY_PREFIX}${userId}`;
  }

  async markOnline(userId: string | number): Promise<void> {
    await this.cacheManager.set(this.key(userId), '1', this.ttlMs);
  }

  async markOffline(userId: string | number): Promise<void> {
    await this.cacheManager.del(this.key(userId));
  }

  async isOnline(userId: string | number): Promise<boolean> {
    const v = await this.cacheManager.get<string>(this.key(userId));
    return !!v;
  }

  async getOnlineMap(userIds: Array<string | number>): Promise<Set<string>> {
    const online = new Set<string>();
    await Promise.all(
      userIds.map(async (id) => {
        if (await this.isOnline(id)) online.add(String(id));
      }),
    );
    return online;
  }

  async heartbeat(userId: string | number): Promise<void> {
    await this.markOnline(userId);
  }
}

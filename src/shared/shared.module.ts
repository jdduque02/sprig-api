import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisConfig } from '@config/redis.config';
import { LoggingService } from './services/logging.service';
import { IpBlockService } from './services/ip-block.service';
import { PresenceService } from './services/presence.service';

@Global()
@Module({
  imports: [CacheModule.registerAsync(redisConfig)],
  providers: [LoggingService, IpBlockService, PresenceService],
  exports: [CacheModule, LoggingService, IpBlockService, PresenceService],
})
export class SharedModule {}

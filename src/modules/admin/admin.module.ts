import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AuthModule } from '@auth/auth.module';
import { AdminLogController } from '@admin/controller/admin-log.controller';
import { AdminLogService } from '@admin/service/admin-log.service';
import { HealthController } from '@admin/controller/health.controller';
import { PerformanceController } from '@admin/controller/performance.controller';
import { HealthService } from '@admin/service/health.service';
import { PerformanceService } from '@admin/service/performance.service';
import { RedisHealthIndicator } from '@admin/indicators/redis-health.indicator';

@Module({
  imports: [AuthModule, TerminusModule],
  controllers: [AdminLogController, HealthController, PerformanceController],
  providers: [
    AdminLogService,
    HealthService,
    PerformanceService,
    RedisHealthIndicator,
  ],
  exports: [AdminLogService],
})
export class AdminModule {}

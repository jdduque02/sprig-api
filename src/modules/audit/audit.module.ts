import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@auth/auth.module';
import { AuditLog } from '@audit/entities/audit-log.entity';
import { AuditLogController } from '@audit/controller/audit-log.controller';
import { AuditLogService } from '@audit/service/audit-log.service';
import { AuditLogRepository } from '@audit/repositories/audit-log.repository';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogRepository],
  exports: [AuditLogService],
})
export class AuditModule {}

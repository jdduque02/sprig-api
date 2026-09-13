import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository } from '@audit/repositories/audit-log.repository';
import { AuditLogQueryDto } from '@audit/dto/audit-log-query.dto';
import { WriteAuditLogDto } from '@audit/dto/write-audit-log.dto';
import { LoggingService } from '@shared/services/logging.service';
import { AuditActionEnum } from '@shared/enums';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly loggingService: LoggingService,
  ) {}

  async findAll(query: AuditLogQueryDto) {
    return this.auditLogRepository.findAll(query);
  }

  async findByUser(userId: number, query: AuditLogQueryDto) {
    return this.auditLogRepository.findByUser(userId, query);
  }

  /**
   * Persiste un audit log en BD y lo reenvía al sistema de logging global.
   * Los errores internos son silenciados para no interrumpir el flujo de negocio.
   */
  async write(dto: WriteAuditLogDto): Promise<void> {
    // 1. Persistir en BD
    const saved = await this.auditLogRepository.write(dto);

    // 2. Reenviar al sistema de logging global (remote → local fallback)
    const severity = dto.action === AuditActionEnum.DELETE ? 'WARN' : 'INFO';
    const context = `[AUDIT] ${dto.action} ${dto.schema_name}.${dto.table_name}#${dto.record_id}`;

    await this.loggingService
      .sendLog(
        {
          audit_id: saved?.id ?? null,
          schema_name: dto.schema_name,
          table_name: dto.table_name,
          record_id: dto.record_id,
          action: dto.action,
          changed_by: dto.changed_by ?? null,
          old_data: dto.old_data ?? null,
          new_data: dto.new_data ?? null,
        },
        severity,
        context,
      )
      .catch((err: Error) => {
        // El error del log remoto/local nunca debe propagarse
        this.logger.warn(
          `No se pudo reenviar audit log al sistema global: ${err.message}`,
        );
      });
  }
}

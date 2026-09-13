import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@audit/entities/audit-log.entity';
import { AuditLogQueryDto } from '@audit/dto/audit-log-query.dto';
import { WriteAuditLogDto } from '@audit/dto/write-audit-log.dto';

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Persiste un registro de auditoría en BD.
   * Los errores se capturan y logean pero NO se propagan:
   * la auditoría nunca debe interrumpir el flujo de negocio.
   */
  async write(dto: WriteAuditLogDto): Promise<AuditLog | null> {
    try {
      const entry = this.repo.create(dto);
      return await this.repo.save(entry);
    } catch (error) {
      this.logger.error(
        `Error persistiendo audit log [${dto.action} ${dto.schema_name}.${dto.table_name}#${dto.record_id}]: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async findAll(
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const {
      schema_name,
      table_name,
      record_id,
      changed_by,
      action,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.repo
      .createQueryBuilder('al')
      .orderBy('al.created_at', 'DESC');

    if (schema_name)
      qb.andWhere('al.schema_name = :schema_name', { schema_name });
    if (table_name) qb.andWhere('al.table_name = :table_name', { table_name });
    if (record_id) qb.andWhere('al.record_id = :record_id', { record_id });
    if (changed_by) qb.andWhere('al.changed_by = :changed_by', { changed_by });
    if (action) qb.andWhere('al.action = :action', { action });

    qb.take(limit).skip((page - 1) * limit);

    const [data, total] = await qb.getManyAndCount();
    this.logger.debug(`Audit logs encontrados: ${total}`);
    return { data, total };
  }

  async findByUser(
    userId: number,
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    return this.findAll({ ...query, changed_by: userId });
  }
}

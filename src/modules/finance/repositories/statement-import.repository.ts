import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import {
  StatementImport,
  StatementImportStatusEnum,
} from '@finance/entities/statement-import.entity';
import {
  StatementImportFile,
  StatementImportFileStatusEnum,
} from '@finance/entities/statement-import-file.entity';
import { CreateStatementImportDto } from '@finance/dto/statement-import/create-statement-import.dto';

export interface StatementFileInput {
  filename: string;
  mimetype: string;
  size: number;
  storagePath: string;
}

export interface ImportFileTotals {
  records_parsed: number;
  records_created: number;
  records_skipped: number;
  records_uncategorized: number;
}

@Injectable()
export class StatementImportRepository {
  private readonly logger = new Logger(StatementImportRepository.name);

  constructor(
    @InjectRepository(StatementImport)
    private readonly importRepo: Repository<StatementImport>,
    @InjectRepository(StatementImportFile)
    private readonly fileRepo: Repository<StatementImportFile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async createJob(
    userId: number,
    files: StatementFileInput[],
    options: CreateStatementImportDto,
  ): Promise<StatementImport> {
    return this.dataSource.transaction(async (manager) => {
      const job = manager.getRepository(StatementImport).create({
        user_id: userId,
        status: StatementImportStatusEnum.PENDING,
        total_files: files.length,
        options: {
          default_category_id: options.default_category_id,
          account_id: options.account_id,
          liability_id: options.liability_id,
          currency: options.currency ?? 'COP',
          skip_duplicates: options.skip_duplicates !== 'false',
          default_type: options.default_type,
          assign_categories: options.assign_categories !== 'false',
          capture_companies: options.capture_companies === 'true',
          default_company_id: options.default_company_id,
        },
      });
      const savedJob = await manager.getRepository(StatementImport).save(job);
      const fileRows = files.map((f) =>
        manager.getRepository(StatementImportFile).create({
          import_id: savedJob.id,
          filename: f.filename,
          mimetype: f.mimetype,
          size_bytes: f.size,
          storage_path: f.storagePath,
          status: StatementImportFileStatusEnum.PENDING,
        }),
      );
      await manager.getRepository(StatementImportFile).save(fileRows);
      this.logger.log(
        `Lote de importación #${savedJob.id} creado para usuario ${userId} (${files.length} archivos)`,
      );
      return savedJob;
    });
  }

  async findJobById(id: number, userId: number): Promise<StatementImport> {
    const job = await this.importRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!job)
      throw new NotFoundException(
        this.i18n.t('finance.STATEMENT_IMPORT_NOT_FOUND', { args: { id } }),
      );
    return job;
  }

  async findJobsByUser(
    userId: number,
    limit = 10,
    offset = 0,
  ): Promise<{ data: StatementImport[]; total: number }> {
    const [data, total] = await this.importRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: Math.min(limit, 50),
      skip: offset,
    });
    return { data, total };
  }

  async findFilesByImport(importId: number): Promise<StatementImportFile[]> {
    return this.fileRepo.find({
      where: { import_id: importId },
      order: { id: 'ASC' },
    });
  }

  async markProcessing(jobId: number): Promise<void> {
    await this.importRepo.update(jobId, {
      status: StatementImportStatusEnum.PROCESSING,
      updated_at: new Date(),
    });
  }

  async markFileProcessing(fileId: number): Promise<void> {
    await this.fileRepo.update(fileId, {
      status: StatementImportFileStatusEnum.PROCESSING,
      updated_at: new Date(),
    });
  }

  async markFileSuccess(
    fileId: number,
    totals: ImportFileTotals,
  ): Promise<void> {
    await this.fileRepo.update(fileId, {
      status: StatementImportFileStatusEnum.SUCCESS,
      records_parsed: totals.records_parsed,
      records_created: totals.records_created,
      records_skipped: totals.records_skipped,
      records_uncategorized: totals.records_uncategorized,
      error_code: null,
      error_message: null,
      processed_at: new Date(),
      updated_at: new Date(),
    });
  }

  async markFileFailed(
    fileId: number,
    code: string,
    message: string,
  ): Promise<void> {
    await this.fileRepo.update(fileId, {
      status: StatementImportFileStatusEnum.FAILED,
      error_code: code,
      error_message: message.slice(0, 2000),
      processed_at: new Date(),
      updated_at: new Date(),
    });
  }

  async finishJob(
    jobId: number,
    totals: {
      processed_files: number;
      success_files: number;
      failed_files: number;
      total_records_parsed: number;
      total_records_created: number;
      total_records_skipped: number;
      total_records_failed: number;
      total_records_uncategorized: number;
      error?: Record<string, unknown> | null;
    },
  ): Promise<StatementImport> {
    let status: StatementImportStatusEnum;
    if (totals.success_files === 0) {
      status = StatementImportStatusEnum.FAILED;
    } else if (totals.failed_files > 0) {
      status = StatementImportStatusEnum.PARTIAL;
    } else {
      status = StatementImportStatusEnum.COMPLETED;
    }
    await this.importRepo.update(jobId, {
      status,
      processed_files: totals.processed_files,
      success_files: totals.success_files,
      failed_files: totals.failed_files,
      total_records_parsed: totals.total_records_parsed,
      total_records_created: totals.total_records_created,
      total_records_skipped: totals.total_records_skipped,
      total_records_failed: totals.total_records_failed,
      total_records_uncategorized: totals.total_records_uncategorized,
      error: (totals.error ?? null) as never,
      updated_at: new Date(),
    });
    const userId = await this.getJobUserId(jobId);
    return this.findJobById(jobId, userId);
  }

  async findFileById(fileId: number): Promise<StatementImportFile | null> {
    return this.fileRepo.findOne({ where: { id: fileId } });
  }

  async findFailedFilesWithStorage(
    importId: number,
  ): Promise<StatementImportFile[]> {
    return this.fileRepo.find({
      where: {
        import_id: importId,
        status: StatementImportFileStatusEnum.FAILED,
      },
      order: { id: 'ASC' },
    });
  }

  async resetFailedFilesForRetry(importId: number): Promise<void> {
    await this.fileRepo.update(
      {
        import_id: importId,
        status: StatementImportFileStatusEnum.FAILED,
      },
      {
        status: StatementImportFileStatusEnum.PENDING,
        error_code: null,
        error_message: null,
        records_parsed: 0,
        records_created: 0,
        records_skipped: 0,
        records_uncategorized: 0,
        processed_at: null,
        updated_at: new Date(),
      },
    );
    await this.importRepo.update(importId, {
      status: StatementImportStatusEnum.PENDING,
      processed_files: 0,
      failed_files: 0,
      error: null,
      updated_at: new Date(),
    });
  }

  async clearStoragePath(fileId: number): Promise<void> {
    await this.fileRepo.update(fileId, { storage_path: null });
  }

  private async getJobUserId(jobId: number): Promise<number> {
    const job = await this.importRepo.findOne({
      select: { id: true, user_id: true },
      where: { id: jobId },
    });
    return job?.user_id ?? 0;
  }
}

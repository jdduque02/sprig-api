import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StatementImportRepository } from '@finance/repositories/statement-import.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { EmpresaRepository } from '@finance/repositories/empresa.repository';
import {
  StatementImport,
  StatementImportStatusEnum,
} from '@finance/entities/statement-import.entity';
import {
  StatementImportFile,
  StatementImportFileStatusEnum,
} from '@finance/entities/statement-import-file.entity';
import { CreateStatementImportDto } from '@finance/dto/statement-import/create-statement-import.dto';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { NotificationService } from '@notification/service/notification.service';
import { BankingEntityService } from '@support/service/banking-entity.service';
import { TransactionTypeEnum } from '@shared/enums';
import {
  parsePdfStatement,
  ParsedStatementTransaction,
  BankingEntityDetection,
} from './bank-statement-parser';

export const MAX_IMPORT_FILES = 10;
export const MAX_IMPORT_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const SINCE_DATE = new Date(2020, 0, 1);

/**
 * Opciones persistidas en `statement_import.options`. `skip_duplicates`
 * y `assign_categories` ya vienen normalizados a booleano por el repositorio.
 */
export interface StatementImportJobOptions {
  default_category_id?: number;
  account_id?: number;
  liability_id?: number;
  currency?: string;
  skip_duplicates: boolean;
  default_type?: TransactionTypeEnum;
  assign_categories?: boolean;
  capture_companies?: boolean;
  default_company_id?: number;
}

interface StatementImportProgressPayload extends Record<
  string,
  unknown
> {
  id: number;
  status: StatementImportStatusEnum;
  total_files: number;
  processed_files: number;
  success_files: number;
  failed_files: number;
  total_records_parsed: number;
  total_records_created: number;
  total_records_skipped: number;
  total_records_failed: number;
  total_records_uncategorized: number;
  files: Array<{
    id: number;
    filename: string;
    status: StatementImportFileStatusEnum;
    records_parsed: number;
    records_created: number;
    records_skipped: number;
    records_uncategorized: number;
    error_code: string | null;
    error_message: string | null;
  }>;
  created_at: Date;
  updated_at: Date | null;
}

interface ProcessFileOutcome {
  records_parsed: number;
  records_created: number;
  records_skipped: number;
  records_failed: number;
  records_uncategorized: number;
}

@Injectable()
export class StatementImportService {
  private readonly logger = new Logger(StatementImportService.name);
  /** Serializa el procesamiento de lotes en el proceso (evita carreras). */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly statementImportRepository: StatementImportRepository,
    private readonly transactionRecordRepository: TransactionRecordRepository,
    private readonly empresaRepository: EmpresaRepository,
    private readonly notificationService: NotificationService,
    private readonly bankingEntityService: BankingEntityService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  // ── API pública ─────────────────────────────────────────────

  async createJob(
    userId: number,
    files: Express.Multer.File[],
    dto: CreateStatementImportDto,
  ): Promise<StatementImport> {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        this.i18n.t('finance.STATEMENT_IMPORT_NO_FILES'),
      );
    }

    const pdfFiles = files.filter(
      (f) =>
        f.mimetype === 'application/pdf' ||
        /\.pdf$/i.test(f.originalname ?? ''),
    );
    if (pdfFiles.length === 0) {
      throw new BadRequestException(
        this.i18n.t('finance.STATEMENT_IMPORT_UNSUPPORTED_FILE'),
      );
    }

    const tempDir = join(tmpdir(), `cm-import-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const stored: {
      filename: string;
      mimetype: string;
      size: number;
      storagePath: string;
    }[] = [];
    try {
      for (const file of pdfFiles) {
        const target = join(tempDir, `${randomUUID()}.pdf`);
        await writeFile(target, file.buffer);
        stored.push({
          filename: file.originalname ?? 'extracto.pdf',
          mimetype: file.mimetype || 'application/pdf',
          size: file.size,
          storagePath: target,
        });
      }

      const job = await this.statementImportRepository.createJob(
        userId,
        stored,
        dto,
      );

      // Proceso asíncrono: no bloquea la respuesta HTTP.
      const password = dto.password;
      this.chain = this.chain
        .then(() => this.processJob(job.id, userId, password))
        .catch((error: unknown) =>
          this.logger.error(`Error procesando lote #${job.id}`, error as Error),
        );

      return job;
    } catch (error) {
      await rm(tempDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async findAll(
    userId: number,
    limit = 10,
    offset = 0,
  ): Promise<{ data: StatementImport[]; total: number }> {
    const page = await this.statementImportRepository.findJobsByUser(
      userId,
      limit,
      offset,
    );
    return page;
  }

  async findOne(
    id: number,
    userId: number,
  ): Promise<StatementImport & { files: StatementImportFile[] }> {
    const job = await this.statementImportRepository.findJobById(id, userId);
    const files = await this.statementImportRepository.findFilesByImport(id);
    return { ...job, files };
  }

  async retryJob(
    id: number,
    userId: number,
    password?: string,
  ): Promise<StatementImport> {
    const job = await this.statementImportRepository.findJobById(id, userId);

    const failedFiles =
      await this.statementImportRepository.findFailedFilesWithStorage(id);
    if (failedFiles.length === 0) {
      throw new BadRequestException(
        this.i18n.t('finance.STATEMENT_IMPORT_NO_RETRYABLE'),
      );
    }

    const filesWithoutStorage = failedFiles.filter((f) => !f.storage_path);
    if (filesWithoutStorage.length > 0) {
      throw new BadRequestException(
        this.i18n.t('finance.STATEMENT_IMPORT_STORAGE_MISSING_RETRY', {
          args: {
            files: filesWithoutStorage.map((f) => f.filename).join(', '),
          },
        }),
      );
    }

    await this.statementImportRepository.resetFailedFilesForRetry(id);

    const bankingEntities = await this.bankingEntityService
      .getActiveDetections()
      .catch(() => []);

    const options = job.options as unknown as StatementImportJobOptions;

    this.chain = this.chain
      .then(() =>
        this.processRetryJob(id, userId, password, options, bankingEntities),
      )
      .catch((error: unknown) =>
        this.logger.error(`Error reintentando lote #${id}`, error as Error),
      );

    return this.statementImportRepository.findJobById(id, userId);
  }

  // ── Procesamiento asíncrono ─────────────────────────────────

  private async processJob(
    jobId: number,
    userId: number,
    password?: string,
  ): Promise<void> {
    const job = await this.statementImportRepository.findJobById(jobId, userId);
    if (job.status !== StatementImportStatusEnum.PENDING) return;

    await this.statementImportRepository.markProcessing(jobId);
    await this.emitProgress(jobId, userId);

    const files = await this.statementImportRepository.findFilesByImport(jobId);

    let processed = 0;
    let successFiles = 0;
    let failedFiles = 0;
    let totalParsed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalUncategorized = 0;
    let firstError: string | null = null;

    const options = job.options as unknown as StatementImportJobOptions;

    // Entidades bancarias activas configuradas por soporte: alimentan la
    // detección del parser (además de las construidas Nu/Bancolombia/RappiCard).
    const bankingEntities = await this.bankingEntityService
      .getActiveDetections()
      .catch(() => []);

    for (const file of files) {
      await this.statementImportRepository.markFileProcessing(file.id);
      await this.emitProgress(jobId, userId);

      try {
        const outcome = await this.processFile(
          userId,
          file,
          options,
          password,
          bankingEntities,
        );
        await this.statementImportRepository.markFileSuccess(file.id, {
          records_parsed: outcome.records_parsed,
          records_created: outcome.records_created,
          records_skipped: outcome.records_skipped,
          records_uncategorized: outcome.records_uncategorized,
        });
        totalParsed += outcome.records_parsed;
        totalCreated += outcome.records_created;
        totalSkipped += outcome.records_skipped;
        totalFailed += outcome.records_failed;
        totalUncategorized += outcome.records_uncategorized;
        successFiles++;
      } catch (error) {
        const { code, message } = this.classifyError(error, file.filename);
        await this.statementImportRepository.markFileFailed(
          file.id,
          code,
          message,
        );
        failedFiles++;
        firstError = firstError ?? message;
        this.logger.warn(
          `Archivo "${file.filename}" del lote #${jobId} falló: ${code} — ${message}`,
        );
      } finally {
        processed++;
        await this.cleanupFile(file);
      }
      await this.emitProgress(jobId, userId);
    }

    await this.statementImportRepository.finishJob(jobId, {
      processed_files: processed,
      success_files: successFiles,
      failed_files: failedFiles,
      total_records_parsed: totalParsed,
      total_records_created: totalCreated,
      total_records_skipped: totalSkipped,
      total_records_failed: totalFailed,
      total_records_uncategorized: totalUncategorized,
      error:
        failedFiles > 0
          ? {
              code: 'PARTIAL_FAILURES',
              message: firstError,
              failed_files: failedFiles,
            }
          : null,
    });

    await this.emitProgress(jobId, userId);
    await this.notifyCompletion(userId, jobId, {
      successFiles,
      failedFiles,
      totalCreated,
      totalUncategorized,
    });

    const lastFile = files[files.length - 1];
    if (lastFile) await this.cleanupJobDir(lastFile);
  }

  private async processRetryJob(
    jobId: number,
    userId: number,
    password: string | undefined,
    options: StatementImportJobOptions,
    bankingEntities: BankingEntityDetection[],
  ): Promise<void> {
    await this.statementImportRepository.markProcessing(jobId);
    await this.emitProgress(jobId, userId);

    const files = await this.statementImportRepository.findFilesByImport(jobId);
    const pendingFiles = files.filter(
      (f) => f.status === StatementImportFileStatusEnum.PENDING,
    );

    let processed = 0;
    let successFiles = 0;
    let failedFiles = 0;
    let totalParsed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalUncategorized = 0;
    let firstError: string | null = null;

    for (const file of pendingFiles) {
      await this.statementImportRepository.markFileProcessing(file.id);
      await this.emitProgress(jobId, userId);

      try {
        const outcome = await this.processFile(
          userId,
          file,
          options,
          password,
          bankingEntities,
        );
        await this.statementImportRepository.markFileSuccess(file.id, {
          records_parsed: outcome.records_parsed,
          records_created: outcome.records_created,
          records_skipped: outcome.records_skipped,
          records_uncategorized: outcome.records_uncategorized,
        });
        totalParsed += outcome.records_parsed;
        totalCreated += outcome.records_created;
        totalSkipped += outcome.records_skipped;
        totalFailed += outcome.records_failed;
        totalUncategorized += outcome.records_uncategorized;
        successFiles++;
      } catch (error) {
        const { code, message } = this.classifyError(error, file.filename);
        await this.statementImportRepository.markFileFailed(
          file.id,
          code,
          message,
        );
        failedFiles++;
        firstError = firstError ?? message;
        this.logger.warn(
          `Archivo "${file.filename}" del reintent lote #${jobId} falló: ${code} — ${message}`,
        );
      } finally {
        processed++;
        await this.cleanupFile(file);
      }
      await this.emitProgress(jobId, userId);
    }

    await this.statementImportRepository.finishJob(jobId, {
      processed_files: processed,
      success_files: successFiles,
      failed_files: failedFiles,
      total_records_parsed: totalParsed,
      total_records_created: totalCreated,
      total_records_skipped: totalSkipped,
      total_records_failed: totalFailed,
      total_records_uncategorized: totalUncategorized,
      error:
        failedFiles > 0
          ? {
              code: 'PARTIAL_FAILURES',
              message: firstError,
              failed_files: failedFiles,
            }
          : null,
    });

    await this.emitProgress(jobId, userId);
    await this.notifyCompletion(userId, jobId, {
      successFiles,
      failedFiles,
      totalCreated,
      totalUncategorized,
    });

    const lastFile = pendingFiles[pendingFiles.length - 1];
    if (lastFile) await this.cleanupJobDir(lastFile);
  }

  private async processFile(
    userId: number,
    file: StatementImportFile,
    options: StatementImportJobOptions,
    password?: string,
    bankingEntities: BankingEntityDetection[] = [],
  ): Promise<ProcessFileOutcome> {
    if (!file.storage_path) {
      throw new Error('STORAGE_MISSING');
    }
    const buffer = await readFile(file.storage_path);

    // Validación estricta de cabecera PDF (los filtros de multer son laxos).
    const magic = buffer.subarray(0, 5).toString('latin1');
    if (magic !== '%PDF-') {
      throw new Error('UNSUPPORTED_FILE');
    }

    const result = await parsePdfStatement(
      buffer,
      password,
      options.default_type,
      bankingEntities,
    );
    if (result.transactions.length === 0) {
      throw new Error('NO_TRANSACTIONS');
    }

    const categoryId = options.default_category_id ?? null;
    const assignCategories = options.assign_categories !== false;
    const captureCompanies = options.capture_companies === true;

    // Pre-cargar empresas del usuario para fuzzy match
    let empresas: { id: number; name: string }[] = [];
    if (captureCompanies) {
      empresas = await this.empresaRepository.findAll(userId);
    }

    const dtos: CreateTransactionRecordDto[] = [];
    let records_skipped = 0;
    let records_uncategorized = 0;

    const parsed = result.transactions;
    const dates = parsed.map((t) => t.transaction_date);
    const existing =
      options.skip_duplicates === false
        ? new Set<string>()
        : await this.transactionRecordRepository.findExistingFingerprints(
            userId,
            dates,
            SINCE_DATE,
          );
    const seenInBatch = new Set<string>();

    for (const tx of parsed) {
      const fp = TransactionRecordRepository.fingerprint(
        tx.transaction_date,
        tx.amount,
        tx.description,
      );
      if (existing.has(fp) || seenInBatch.has(fp)) {
        records_skipped++;
        continue;
      }
      seenInBatch.add(fp);

      // Resolver company_id por fuzzy match (addressee o descripción vs nombres de empresa)
      let companyId = options.default_company_id;
      if (captureCompanies && !companyId && empresas.length > 0) {
        const searchTerm = tx.description ?? '';
        const match = empresas.find(
          (e) =>
            searchTerm.toLowerCase().includes(e.name.toLowerCase()) ||
            e.name.toLowerCase().includes(searchTerm.toLowerCase()),
        );
        if (match) companyId = match.id;
      }

      const dto = this.toTransactionDto(
        tx,
        categoryId,
        options.account_id,
        companyId,
        options.currency,
        options.liability_id,
      );
      // Si no hay categoría explícita ni auto-categorización, la transacción
      // queda pendiente por editar.
      if (dto.category_id == null && !assignCategories) records_uncategorized++;
      dtos.push(dto);
    }

    if (dtos.length === 0) {
      return {
        records_parsed: parsed.length,
        records_created: 0,
        records_skipped: records_skipped,
        records_failed: 0,
        records_uncategorized: 0,
      };
    }

    // createMany auto-categoriza por descripción (reglas aprendidas) cuando
    // no hay categoría explícita. Si el usuario no activó la auto-
    // categorización, se dejan todas sin categoría.
    const created = await this.transactionRecordRepository.createMany(
      userId,
      dtos,
      {
        assignCategories,
      },
    );
    records_uncategorized += created.filter(
      (t) => t.category_id == null,
    ).length;

    return {
      records_parsed: parsed.length,
      records_created: created.length,
      records_skipped: records_skipped,
      records_failed: 0,
      records_uncategorized,
    };
  }

  private toTransactionDto(
    tx: ParsedStatementTransaction,
    categoryId: number | null,
    accountId?: number,
    companyId?: number,
    currency?: string,
    liabilityId?: number,
  ): CreateTransactionRecordDto {
    const dto: CreateTransactionRecordDto = {
      type: tx.type,
      amount: tx.amount,
      currency: currency ?? 'COP',
      description: tx.description,
      transaction_date: tx.transaction_date,
      source: 'import',
    };
    if (categoryId != null) dto.category_id = categoryId;
    if (accountId) dto.account_id = accountId;
    if (liabilityId) dto.liability_id = liabilityId;
    if (companyId) dto.company_id = companyId;
    if (tx.reference) dto.reference_code = tx.reference;
    if (tx.installments !== undefined) dto.installments = tx.installments;
    if (tx.installment_value !== undefined)
      dto.installment_value = tx.installment_value;
    return dto;
  }

  private classifyError(
    error: unknown,
    filename: string,
  ): { code: string; message: string } {
    const err = error as Error;
    const name = err?.name ?? '';
    const msg = String(err?.message ?? error);

    this.logger.warn(
      `Error clasificando archivo "${filename}": name=${name} msg=${msg}`,
      err?.stack,
    );

    if (name === 'PasswordException' || /password|clave|encrypt/i.test(msg)) {
      if (/incorrect|inv[aá]lida|incorrecta|wrong/i.test(msg)) {
        return {
          code: 'PDF_WRONG_PASSWORD',
          message: this.i18n.t('finance.STATEMENT_IMPORT_WRONG_PASSWORD', {
            args: { file: filename },
          }),
        };
      }
      return {
        code: 'PDF_PASSWORD_REQUIRED',
        message: this.i18n.t('finance.STATEMENT_IMPORT_PASSWORD_REQUIRED', {
          args: { file: filename },
        }),
      };
    }

    if (msg === 'UNSUPPORTED_FILE') {
      return {
        code: 'UNSUPPORTED_FILE',
        message: this.i18n.t('finance.STATEMENT_IMPORT_UNSUPPORTED_FILE', {
          args: { file: filename },
        }),
      };
    }
    if (msg === 'NO_TRANSACTIONS') {
      return {
        code: 'NO_TRANSACTIONS',
        message: this.i18n.t('finance.STATEMENT_IMPORT_NO_TRANSACTIONS', {
          args: { file: filename },
        }),
      };
    }

    if (/InvalidPDF|MissingData|Password/i.test(name)) {
      return {
        code: 'PDF_INVALID',
        message: this.i18n.t('finance.STATEMENT_IMPORT_INVALID_PDF', {
          args: { file: filename },
        }),
      };
    }

    return {
      code: 'PDF_INVALID',
      message: this.i18n.t('finance.STATEMENT_IMPORT_INVALID_PDF', {
        args: { file: filename },
      }),
    };
  }

  private async cleanupFile(file: StatementImportFile): Promise<void> {
    if (!file.storage_path) return;
    await rm(file.storage_path, { force: true }).catch(() => undefined);
    await this.statementImportRepository.clearStoragePath(file.id);
  }

  private async cleanupJobDir(file: StatementImportFile): Promise<void> {
    if (!file.storage_path) return;
    const dir = join(file.storage_path, '..');
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  private async notifyCompletion(
    userId: number,
    jobId: number,
    summary: {
      successFiles: number;
      failedFiles: number;
      totalCreated: number;
      totalUncategorized: number;
    },
  ): Promise<void> {
    try {
      await this.notificationService.create(userId, {
        title: this.i18n.t('notification.IMPORT_COMPLETED_TITLE'),
        description: this.i18n.t('notification.IMPORT_COMPLETED_DESCRIPTION', {
          args: {
            created: summary.totalCreated,
            files: summary.successFiles + summary.failedFiles,
            failed: summary.failedFiles,
            uncategorized: summary.totalUncategorized,
          },
        }),
        reference: `statement-import:${jobId}`,
      });
    } catch (error) {
      this.logger.warn(
        'No se pudo crear la notificación de importación',
        error,
      );
    }
  }

  // ── Progreso en tiempo real ────────────────────────────────

  private async emitProgress(jobId: number, userId: number): Promise<void> {
    try {
      const job = await this.statementImportRepository.findJobById(
        jobId,
        userId,
      );
      const files =
        await this.statementImportRepository.findFilesByImport(jobId);
      const payload: StatementImportProgressPayload = {
        id: job.id,
        status: job.status,
        total_files: job.total_files,
        processed_files: job.processed_files,
        success_files: job.success_files,
        failed_files: job.failed_files,
        total_records_parsed: job.total_records_parsed,
        total_records_created: job.total_records_created,
        total_records_skipped: job.total_records_skipped,
        total_records_failed: job.total_records_failed,
        total_records_uncategorized: job.total_records_uncategorized,
        files: files.map((f) => ({
          id: f.id,
          filename: f.filename,
          status: f.status,
          records_parsed: f.records_parsed,
          records_created: f.records_created,
          records_skipped: f.records_skipped,
          records_uncategorized: f.records_uncategorized,
          error_code: f.error_code,
          error_message: f.error_message,
        })),
        created_at: job.created_at,
        updated_at: job.updated_at,
      };
      this.notificationService.sendStatementImportProgress(userId, payload);
    } catch (error) {
      this.logger.debug(
        `No se pudo emitir progreso del lote #${jobId}`,
        error as Error,
      );
    }
  }
}

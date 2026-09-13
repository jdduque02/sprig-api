import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';
import { StatementImportRepository } from '@finance/repositories/statement-import.repository';
import {
  StatementImport,
  StatementImportStatusEnum,
} from '@finance/entities/statement-import.entity';
import { StatementImportFileStatusEnum } from '@finance/entities/statement-import-file.entity';

const buildJob = (overrides: Partial<StatementImport> = {}) =>
  ({
    id: 1,
    user_id: 10,
    status: StatementImportStatusEnum.PENDING,
    ...overrides,
  }) as StatementImport;

const mockImportRepo = {
  create: jest.fn((e: Partial<StatementImport>) => e),
  save: jest.fn((e: Partial<StatementImport>) => ({ id: 1, ...e })),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
};

const mockFileRepo = {
  create: jest.fn((e: Partial<any>) => e),
  save: jest.fn((e: Partial<any>) => e),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const buildManager = () => ({
  getRepository: jest.fn((entity: unknown) =>
    entity === StatementImport ? mockImportRepo : mockFileRepo,
  ),
});

describe('StatementImportRepository', () => {
  let repo: StatementImportRepository;
  const mockDataSource = {
    transaction: jest.fn(
      (fn: (m: ReturnType<typeof buildManager>) => unknown) =>
        fn(buildManager()),
    ),
  };
  const mockI18n = { t: jest.fn((key: string) => key) };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new StatementImportRepository(
      mockImportRepo as never,
      mockFileRepo as never,
      mockDataSource as unknown as DataSource,
      mockI18n as unknown as I18nService,
    );
  });

  describe('createJob', () => {
    it('crea el lote y los archivos en una transacción', async () => {
      const files = [
        {
          filename: 'a.pdf',
          mimetype: 'application/pdf',
          size: 10,
          storagePath: '/tmp/a',
        },
        {
          filename: 'b.pdf',
          mimetype: 'application/pdf',
          size: 20,
          storagePath: '/tmp/b',
        },
      ];
      const result = await repo.createJob(10, files, {
        default_category_id: 3,
        skip_duplicates: 'true',
        assign_categories: 'true',
      });
      expect(mockDataSource.transaction as jest.Mock).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(mockFileRepo.create).toHaveBeenCalledTimes(2);
    });

    it('normaliza opciones booleanas', async () => {
      await repo.createJob(10, [], {
        skip_duplicates: 'false',
        assign_categories: 'false',
      });
      const created = mockImportRepo.create.mock.calls[0][0];
      expect(created.options).toEqual({
        default_category_id: undefined,
        account_id: undefined,
        liability_id: undefined,
        currency: 'COP',
        skip_duplicates: false,
        default_type: undefined,
        assign_categories: false,
        capture_companies: false,
        default_company_id: undefined,
      });
    });
  });

  describe('findJobById', () => {
    it('lanza NotFoundException si no existe', async () => {
      mockImportRepo.findOne.mockResolvedValue(null);
      await expect(repo.findJobById(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('retorna el lote', async () => {
      mockImportRepo.findOne.mockResolvedValue(buildJob());
      await expect(repo.findJobById(1, 10)).resolves.toMatchObject({ id: 1 });
    });
  });

  describe('findJobsByUser', () => {
    it('retorna datos y total', async () => {
      mockImportRepo.findAndCount.mockResolvedValue([[buildJob()], 1]);
      const result = await repo.findJobsByUser(10, 5, 0);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('limita a 50', async () => {
      mockImportRepo.findAndCount.mockResolvedValue([[], 0]);
      await repo.findJobsByUser(10, 999, 0);
      expect(mockImportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('usa limit y offset por defecto', async () => {
      mockImportRepo.findAndCount.mockResolvedValue([[], 0]);
      await repo.findJobsByUser(10);
      expect(mockImportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 0 }),
      );
    });
  });

  describe('findFilesByImport / findFileById / findFailedFilesWithStorage', () => {
    it('findFilesByImport ordena por id', async () => {
      mockFileRepo.find.mockResolvedValue([]);
      await repo.findFilesByImport(1);
      expect(mockFileRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { import_id: 1 } }),
      );
    });

    it('findFileById consulta por id', async () => {
      mockFileRepo.findOne.mockResolvedValue({ id: 5 });
      await expect(repo.findFileById(5)).resolves.toEqual({ id: 5 });
    });

    it('findFailedFilesWithStorage filtra por FAILED', async () => {
      mockFileRepo.find.mockResolvedValue([]);
      await repo.findFailedFilesWithStorage(1);
      expect(mockFileRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { import_id: 1, status: StatementImportFileStatusEnum.FAILED },
        }),
      );
    });
  });

  describe('markers', () => {
    it('markProcessing actualiza el lote', async () => {
      await repo.markProcessing(1);
      expect(mockImportRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: StatementImportStatusEnum.PROCESSING,
        }),
      );
    });

    it('markFileProcessing actualiza el archivo', async () => {
      await repo.markFileProcessing(7);
      expect(mockFileRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          status: StatementImportFileStatusEnum.PROCESSING,
        }),
      );
    });

    it('markFileSuccess guarda totales', async () => {
      const totals = {
        records_parsed: 10,
        records_created: 8,
        records_skipped: 2,
        records_uncategorized: 1,
      };
      await repo.markFileSuccess(7, totals);
      expect(mockFileRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          status: StatementImportFileStatusEnum.SUCCESS,
          records_parsed: 10,
          records_created: 8,
          error_code: null,
        }),
      );
    });

    it('markFileFailed trunca el mensaje', async () => {
      await repo.markFileFailed(7, 'PARSE_ERROR', 'x'.repeat(3000));
      expect(mockFileRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          status: StatementImportFileStatusEnum.FAILED,
          error_message: 'x'.repeat(2000),
        }),
      );
    });

    it('clearStoragePath limpia el path', async () => {
      await repo.clearStoragePath(7);
      expect(mockFileRepo.update).toHaveBeenCalledWith(7, {
        storage_path: null,
      });
    });
  });

  describe('finishJob', () => {
    const totals = {
      processed_files: 2,
      success_files: 2,
      failed_files: 0,
      total_records_parsed: 10,
      total_records_created: 8,
      total_records_skipped: 2,
      total_records_failed: 0,
      total_records_uncategorized: 1,
    };

    it('marca COMPLETED cuando todos tienen éxito', async () => {
      mockImportRepo.findOne.mockResolvedValue(buildJob({ user_id: 10 }));
      await repo.finishJob(1, totals);
      expect(mockImportRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: StatementImportStatusEnum.COMPLETED,
        }),
      );
    });

    it('marca PARTIAL cuando hay fallidos', async () => {
      mockImportRepo.findOne.mockResolvedValue(buildJob({ user_id: 10 }));
      await repo.finishJob(1, { ...totals, success_files: 1, failed_files: 1 });
      expect(mockImportRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: StatementImportStatusEnum.PARTIAL,
        }),
      );
    });

    it('marca FAILED cuando no hay éxitos', async () => {
      mockImportRepo.findOne.mockResolvedValue(buildJob({ user_id: 10 }));
      await repo.finishJob(1, { ...totals, success_files: 0, failed_files: 2 });
      expect(mockImportRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: StatementImportStatusEnum.FAILED,
        }),
      );
    });

    it('falla cuando el lote no se encuentra al finalizar', async () => {
      mockImportRepo.findOne.mockResolvedValue(null);
      await expect(repo.finishJob(1, totals)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetFailedFilesForRetry', () => {
    it('reinicia archivos fallidos y el lote', async () => {
      await repo.resetFailedFilesForRetry(1);
      expect(mockFileRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StatementImportFileStatusEnum.FAILED,
        }),
        expect.objectContaining({
          status: StatementImportFileStatusEnum.PENDING,
        }),
      );
      expect(mockImportRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: StatementImportStatusEnum.PENDING,
        }),
      );
    });
  });
});

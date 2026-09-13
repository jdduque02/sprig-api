import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { StatementImportService } from '@finance/service/statement-import.service';
import { StatementImportRepository } from '@finance/repositories/statement-import.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { EmpresaRepository } from '@finance/repositories/empresa.repository';
import { NotificationService } from '@notification/service/notification.service';
import { CategoryService } from '@catalog/service/category.service';
import { BankingEntityService } from '@support/service/banking-entity.service';
import {
  StatementImport,
  StatementImportStatusEnum,
} from '@finance/entities/statement-import.entity';
import {
  StatementImportFile,
  StatementImportFileStatusEnum,
} from '@finance/entities/statement-import-file.entity';
import { TransactionTypeEnum } from '@shared/enums';
import {
  parsePdfStatement,
  ParsedStatementTransaction,
} from '@finance/service/bank-statement-parser';

jest.mock('@finance/service/bank-statement-parser');

jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises') as unknown as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    rm: jest.fn().mockResolvedValue(undefined),
  };
});

const mockParsePdfStatement = parsePdfStatement as jest.MockedFunction<
  typeof parsePdfStatement
>;

const mockStatementImportRepository = {
  createJob: jest.fn(),
  findJobsByUser: jest.fn(),
  findJobById: jest.fn(),
  findFilesByImport: jest.fn(),
  markProcessing: jest.fn(),
  markFileProcessing: jest.fn(),
  markFileSuccess: jest.fn(),
  markFileFailed: jest.fn(),
  finishJob: jest.fn(),
  clearStoragePath: jest.fn(),
  findFailedFilesWithStorage: jest.fn(),
  resetFailedFilesForRetry: jest.fn(),
};

const mockTransactionRecordRepository = {
  findExistingFingerprints: jest.fn(),
  createMany: jest.fn(),
};

const mockNotificationService = {
  create: jest.fn(),
  sendStatementImportProgress: jest.fn(),
};

const mockCategoryService = {
  findAll: jest.fn(),
};

const mockBankingEntityService = {
  getActiveDetections: jest.fn(),
};

const mockEmpresaRepository = {
  findAll: jest.fn(),
};

const mockI18n = {
  t: jest.fn((key: string) => key),
};

const buildJob = (overrides: Partial<StatementImport> = {}): StatementImport =>
  ({
    id: 1,
    user_id: 10,
    status: StatementImportStatusEnum.PENDING,
    total_files: 1,
    processed_files: 0,
    success_files: 0,
    failed_files: 0,
    total_records_parsed: 0,
    total_records_created: 0,
    total_records_skipped: 0,
    total_records_failed: 0,
    options: { skip_duplicates: true },
    error: null,
    created_at: new Date('2026-07-01T00:00:00.000Z'),
    updated_at: null,
    ...overrides,
  }) as StatementImport;

const buildFile = (
  overrides: Partial<StatementImportFile> = {},
): StatementImportFile =>
  ({
    id: 1,
    import_id: 1,
    filename: 'extracto.pdf',
    mimetype: 'application/pdf',
    size_bytes: 1234,
    storage_path: '/tmp/cm-import-test/extracto.pdf',
    status: StatementImportFileStatusEnum.PENDING,
    records_parsed: 0,
    records_created: 0,
    records_skipped: 0,
    error_code: null,
    error_message: null,
    processed_at: null,
    created_at: new Date('2026-07-01T00:00:00.000Z'),
    updated_at: null,
    ...overrides,
  }) as StatementImportFile;

const buildParsedTx = (
  overrides: Partial<ParsedStatementTransaction> = {},
): ParsedStatementTransaction => ({
  transaction_date: '2026-07-15',
  description: 'ABONO SUCURSAL VIRTUAL',
  amount: 1547390,
  type: TransactionTypeEnum.INCOME,
  ...overrides,
});

const pdfBuffer = Buffer.from('%PDF-1.4 extracto de prueba');

const pdfFile = {
  originalname: 'extracto.pdf',
  mimetype: 'application/pdf',
  size: 1234,
  buffer: pdfBuffer,
};

/** Descarga la cola de procesamiento asíncrono encadenada en el servicio. */
const flushChain = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('StatementImportService', () => {
  let service: StatementImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementImportService,
        {
          provide: StatementImportRepository,
          useValue: mockStatementImportRepository,
        },
        {
          provide: TransactionRecordRepository,
          useValue: mockTransactionRecordRepository,
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EmpresaRepository, useValue: mockEmpresaRepository },
        { provide: CategoryService, useValue: mockCategoryService },
        {
          provide: BankingEntityService,
          useValue: mockBankingEntityService,
        },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<StatementImportService>(StatementImportService);
    jest.resetAllMocks();
    (mockI18n.t as jest.Mock).mockImplementation((key: string) => key);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (readFile as jest.Mock).mockResolvedValue(pdfBuffer);
    (rm as jest.Mock).mockResolvedValue(undefined);
    mockCategoryService.findAll.mockResolvedValue([{ id: 2, name: 'General' }]);
    mockBankingEntityService.getActiveDetections.mockResolvedValue([]);
    mockEmpresaRepository.findAll.mockResolvedValue([]);
    mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
    mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
    mockStatementImportRepository.findFilesByImport.mockResolvedValue([
      buildFile(),
    ]);
    mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
      [],
    );
    mockStatementImportRepository.resetFailedFilesForRetry.mockResolvedValue(
      undefined,
    );
    mockStatementImportRepository.clearStoragePath.mockResolvedValue(undefined);
    mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
      new Set(),
    );
    mockTransactionRecordRepository.createMany.mockResolvedValue([]);
  });

  describe('createJob', () => {
    it('lanza BadRequestException si no recibe archivos', async () => {
      await expect(
        service.createJob(10, [], { skip_duplicates: 'true' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockStatementImportRepository.createJob).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si ningún archivo es PDF', async () => {
      const txt = {
        originalname: 'nota.txt',
        mimetype: 'text/plain',
        size: 10,
        buffer: Buffer.from('hola'),
      };
      await expect(
        service.createJob(10, [txt], { skip_duplicates: 'true' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no exige una categoría por defecto al crear el lote (el catálogo no se consulta)', async () => {
      mockCategoryService.findAll.mockResolvedValue([]);

      const result = await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });

      expect(result).toEqual(buildJob());
      expect(mockStatementImportRepository.createJob).toHaveBeenCalled();
      expect(mockCategoryService.findAll).not.toHaveBeenCalled();
    });

    it('escribe los PDFs en un directorio temporal y crea el lote', async () => {
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);
      const job = buildJob();
      mockStatementImportRepository.createJob.mockResolvedValue(job);

      const result = await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });

      expect(result).toBe(job);
      const [, stored] = mockStatementImportRepository.createJob.mock
        .calls[0] as [
        number,
        Array<{ filename: string; storagePath: string }>,
        Record<string, unknown>,
      ];
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        filename: 'extracto.pdf',
        mimetype: 'application/pdf',
        size: 1234,
      });
      expect(stored[0].storagePath).toContain('cm-import-');
      expect(stored[0].storagePath).toMatch(/\.pdf$/);
      expect(mockStatementImportRepository.createJob).toHaveBeenCalledWith(
        10,
        stored,
        expect.objectContaining({ skip_duplicates: 'true' }),
      );
      // La limpieza del directorio temporal no ocurre si el lote se creó bien.
      expect(rm).not.toHaveBeenCalled();
    });

    it('usa la categoría explícita sin consultar el catálogo', async () => {
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockCategoryService.findAll.mockResolvedValue([]);

      const dto = {
        skip_duplicates: 'true',
        default_category_id: 7,
      };
      await service.createJob(10, [pdfFile], dto);

      expect(mockCategoryService.findAll).not.toHaveBeenCalled();
      expect(mockStatementImportRepository.createJob).toHaveBeenCalledWith(
        10,
        expect.any(Array),
        expect.objectContaining({ default_category_id: 7 }),
      );
    });

    it('acepta un archivo cuyo mimetype no es PDF pero su nombre termina en .pdf', async () => {
      const file = {
        originalname: 'extracto.pdf',
        mimetype: 'text/plain',
        size: 10,
        buffer: pdfBuffer,
      };

      await service.createJob(10, [file], { skip_duplicates: 'true' });

      const [, stored] = mockStatementImportRepository.createJob.mock
        .calls[0] as [
        number,
        Array<{ filename: string; mimetype: string }>,
        Record<string, unknown>,
      ];
      expect(stored[0]).toMatchObject({
        filename: 'extracto.pdf',
        mimetype: 'text/plain',
      });
    });

    it('usa nombres y mimetypes por defecto cuando el archivo no los trae', async () => {
      const file = { mimetype: 'application/pdf', size: 10, buffer: pdfBuffer };
      const fileConMimetypeVacio = {
        originalname: 'nota.pdf',
        mimetype: '',
        size: 10,
        buffer: pdfBuffer,
      };

      await service.createJob(10, [file, fileConMimetypeVacio], {
        skip_duplicates: 'true',
      });

      const [, stored] = mockStatementImportRepository.createJob.mock
        .calls[0] as [
        number,
        Array<{ filename: string; mimetype: string }>,
        Record<string, unknown>,
      ];
      expect(stored[0]).toMatchObject({
        filename: 'extracto.pdf',
        mimetype: 'application/pdf',
      });
      expect(stored[1]).toMatchObject({
        filename: 'nota.pdf',
        mimetype: 'application/pdf',
      });
    });

    it('limpia el directorio temporal y relanza el error si falla la escritura', async () => {
      (writeFile as jest.Mock).mockRejectedValue(new Error('disco lleno'));
      (rm as jest.Mock).mockRejectedValueOnce(new Error('rm falló'));

      await expect(
        service.createJob(10, [pdfFile], { skip_duplicates: 'true' }),
      ).rejects.toThrow('disco lleno');
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('cm-import-'),
        expect.objectContaining({ recursive: true, force: true }),
      );
      expect(mockStatementImportRepository.createJob).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('delega la búsqueda paginada al repositorio', async () => {
      const payload = { data: [buildJob()], total: 1 };
      mockStatementImportRepository.findJobsByUser.mockResolvedValue(payload);

      const result = await service.findAll(10, 20, 40);

      expect(mockStatementImportRepository.findJobsByUser).toHaveBeenCalledWith(
        10,
        20,
        40,
      );
      expect(result).toEqual(payload);
    });

    it('usa límite y offset por defecto', async () => {
      const payload = { data: [], total: 0 };
      mockStatementImportRepository.findJobsByUser.mockResolvedValue(payload);

      await service.findAll(10);

      expect(mockStatementImportRepository.findJobsByUser).toHaveBeenCalledWith(
        10,
        10,
        0,
      );
    });
  });

  describe('findOne', () => {
    it('retorna el lote con sus archivos', async () => {
      const job = buildJob();
      const files = [buildFile()];
      mockStatementImportRepository.findJobById.mockResolvedValue(job);
      mockStatementImportRepository.findFilesByImport.mockResolvedValue(files);

      const result = await service.findOne(1, 10);

      expect(result).toEqual({ ...job, files });
    });
  });

  describe('procesamiento asíncrono', () => {
    it('procesa un lote exitoso y crea las transacciones', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
        period: 'jun - jul',
      });
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set(),
      );
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markProcessing).toHaveBeenCalledWith(
        1,
      );
      expect(mockParsePdfStatement).toHaveBeenCalledWith(
        pdfBuffer,
        undefined,
        undefined,
        [],
      );
      expect(
        mockTransactionRecordRepository.findExistingFingerprints,
      ).toHaveBeenCalledWith(10, ['2026-07-15'], expect.any(Date));
      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [
          expect.objectContaining({
            type: TransactionTypeEnum.INCOME,
            amount: 1547390,
            description: 'ABONO SUCURSAL VIRTUAL',
            transaction_date: '2026-07-15',
          }),
        ],
        { assignCategories: true },
      );
      expect(
        mockStatementImportRepository.markFileSuccess,
      ).toHaveBeenCalledWith(1, {
        records_parsed: 1,
        records_created: 1,
        records_skipped: 0,
        records_uncategorized: 0,
      });
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          success_files: 1,
          failed_files: 0,
          total_records_parsed: 1,
          total_records_created: 1,
          error: null,
        }),
      );
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(
        mockNotificationService.sendStatementImportProgress,
      ).toHaveBeenCalled();
      expect(
        mockStatementImportRepository.clearStoragePath,
      ).toHaveBeenCalledWith(1);
    });

    it('pasa las entidades bancarias configuradas al parser', async () => {
      const entities = [
        {
          code: 'daviplata',
          detect_patterns: ['Movimientos de Daviplata'],
        },
      ];
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'daviplata',
      });
      mockBankingEntityService.getActiveDetections.mockResolvedValue(entities);
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set(),
      );

      await service.createJob(10, [pdfFile], { skip_duplicates: 'true' });
      await flushChain();
      await flushChain();

      expect(mockBankingEntityService.getActiveDetections).toHaveBeenCalled();
      expect(mockParsePdfStatement).toHaveBeenCalledWith(
        pdfBuffer,
        undefined,
        undefined,
        entities,
      );
    });

    it('omite movimientos que ya existen (skip_duplicates=true)', async () => {
      const tx = buildParsedTx();
      mockParsePdfStatement.mockResolvedValue({ transactions: [tx] });
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set([
          TransactionRecordRepository.fingerprint(
            tx.transaction_date,
            tx.amount,
            tx.description,
          ),
        ]),
      );

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).not.toHaveBeenCalled();
      expect(
        mockStatementImportRepository.markFileSuccess,
      ).toHaveBeenCalledWith(1, {
        records_parsed: 1,
        records_created: 0,
        records_skipped: 1,
        records_uncategorized: 0,
      });
    });

    it('omite duplicados dentro del mismo lote', async () => {
      const tx = buildParsedTx();
      mockParsePdfStatement.mockResolvedValue({
        transactions: [tx, { ...tx }],
      });
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set(),
      );
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [expect.objectContaining({ amount: 1547390 })],
        { assignCategories: true },
      );
      expect(
        mockStatementImportRepository.markFileSuccess,
      ).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ records_skipped: 1, records_created: 1 }),
      );
    });

    it('no consulta duplicados si skip_duplicates=false', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
      });
      mockStatementImportRepository.createJob.mockResolvedValue(
        buildJob({ options: { skip_duplicates: false } }),
      );
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({ options: { skip_duplicates: false } }),
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'false',
      });
      await flushChain();
      await flushChain();

      expect(
        mockTransactionRecordRepository.findExistingFingerprints,
      ).not.toHaveBeenCalled();
      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [expect.objectContaining({ amount: 1547390 })],
        { assignCategories: true },
      );
    });

    it('incluye la cuenta bancaria, referencia y categoría del lote', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx({ reference: 'C78699' })],
      });
      mockStatementImportRepository.createJob.mockResolvedValue(
        buildJob({
          options: {
            skip_duplicates: true,
            account_id: 5,
            default_category_id: 2,
          },
        }),
      );
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({
          options: {
            skip_duplicates: true,
            account_id: 5,
            default_category_id: 2,
          },
        }),
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set(),
      );

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
        account_id: 5,
        default_category_id: 2,
      });
      await flushChain();
      await flushChain();

      expect(mockCategoryService.findAll).not.toHaveBeenCalled();
      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [
          expect.objectContaining({
            category_id: 2,
            account_id: 5,
            reference_code: 'C78699',
          }),
        ],
        { assignCategories: true },
      );
    });

    it('marca el archivo como fallido si la contraseña es incorrecta', async () => {
      mockParsePdfStatement.mockRejectedValue(
        Object.assign(new Error('Incorrect password'), {
          name: 'PasswordException',
        }),
      );
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_WRONG_PASSWORD',
        expect.any(String),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          success_files: 0,
          failed_files: 1,
        }),
      );
      const [, totals] = mockStatementImportRepository.finishJob.mock
        .calls[0] as [number, { error?: { code: string } }];
      expect(totals.error?.code).toBe('PARTIAL_FAILURES');
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('marca el archivo como fallido si no detecta movimientos', async () => {
      mockParsePdfStatement.mockResolvedValue({ transactions: [] });
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'NO_TRANSACTIONS',
        expect.any(String),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ failed_files: 1 }),
      );
    });

    it('marca el archivo como fallido si el binario no es un PDF', async () => {
      (readFile as jest.Mock).mockResolvedValue(Buffer.from('no es un pdf'));
      mockStatementImportRepository.createJob.mockResolvedValue(buildJob());
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockParsePdfStatement).not.toHaveBeenCalled();
      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'UNSUPPORTED_FILE',
        expect.any(String),
      );
    });

    it('procesa varios archivos y reporta resultados parciales', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
      });
      mockStatementImportRepository.createJob.mockResolvedValue(
        buildJob({ total_files: 2 }),
      );
      mockStatementImportRepository.findJobById.mockResolvedValue(buildJob());
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ id: 1, filename: 'ok.pdf', storage_path: '/tmp/ok.pdf' }),
        buildFile({ id: 2, filename: 'bad.pdf', storage_path: '/tmp/bad.pdf' }),
      ]);
      mockCategoryService.findAll.mockResolvedValue([
        { id: 2, name: 'General' },
      ]);
      mockTransactionRecordRepository.findExistingFingerprints.mockResolvedValue(
        new Set(),
      );
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);
      (readFile as jest.Mock).mockImplementation((path: string) =>
        path.endsWith('bad.pdf')
          ? Promise.resolve(Buffer.from('no es un pdf'))
          : Promise.resolve(pdfBuffer),
      );

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(
        mockStatementImportRepository.markFileSuccess,
      ).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ records_created: 1 }),
      );
      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        2,
        'UNSUPPORTED_FILE',
        expect.any(String),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          processed_files: 2,
          success_files: 1,
          failed_files: 1,
        }),
      );
      const [, totals] = mockStatementImportRepository.finishJob.mock
        .calls[0] as [number, { error?: { code: string } }];
      expect(totals.error?.code).toBe('PARTIAL_FAILURES');
    });

    it('no procesa si el lote ya no está pendiente', async () => {
      mockStatementImportRepository.createJob.mockResolvedValue(
        buildJob({ status: StatementImportStatusEnum.PROCESSING }),
      );
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({ status: StatementImportStatusEnum.PROCESSING }),
      );

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(
        mockStatementImportRepository.markProcessing,
      ).not.toHaveBeenCalled();
      expect(
        mockStatementImportRepository.findFilesByImport,
      ).not.toHaveBeenCalled();
    });

    it('registra el error si la cadena de procesamiento falla', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mockStatementImportRepository.findJobById.mockRejectedValue(
        new Error('boom'),
      );

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error procesando lote'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it('continúa procesando si no se pueden cargar las detecciones bancarias', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockBankingEntityService.getActiveDetections.mockRejectedValue(
        new Error('db caído'),
      );
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalled();
      expect(mockStatementImportRepository.markFileSuccess).toHaveBeenCalled();
    });

    it('marca el archivo como fallido si no tiene storage_path', async () => {
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ storage_path: null }),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_INVALID',
        expect.any(String),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ failed_files: 1 }),
      );
    });

    it('clasifica el archivo como contraseña requerida', async () => {
      mockParsePdfStatement.mockRejectedValue(
        Object.assign(new Error('se requiere la clave'), {
          name: 'PasswordException',
        }),
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_PASSWORD_REQUIRED',
        expect.any(String),
      );
    });

    it('clasifica el archivo como PDF inválido por el nombre del error', async () => {
      mockParsePdfStatement.mockRejectedValue(
        Object.assign(new Error('estructura ilegible'), {
          name: 'InvalidPDFError',
        }),
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_INVALID',
        expect.any(String),
      );
    });

    it('cuenta no categorizadas cuando assign_categories=false', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({
          options: { skip_duplicates: false, assign_categories: false },
        }),
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: null },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'false',
        assign_categories: 'false',
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [expect.objectContaining({ amount: 1547390 })],
        { assignCategories: false },
      );
      expect(
        mockStatementImportRepository.markFileSuccess,
      ).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ records_uncategorized: 2 }),
      );
    });

    it('incluye cuotas e installment_value en el DTO', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [
          buildParsedTx({ installments: 3, installment_value: 500000 }),
        ],
        bank: 'bancolombia',
      });
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [
          expect.objectContaining({
            installments: 3,
            installment_value: 500000,
          }),
        ],
        expect.any(Object),
      );
    });

    it('usa el primer error como mensaje cuando varios archivos fallan', async () => {
      mockParsePdfStatement
        .mockRejectedValueOnce(new Error('primera falla'))
        .mockRejectedValueOnce(new Error('segunda falla'));
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ id: 1, storage_path: '/tmp/one.pdf' }),
        buildFile({ id: 2, storage_path: '/tmp/two.pdf' }),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(
        mockStatementImportRepository.markFileFailed,
      ).toHaveBeenCalledTimes(2);
      const [, totals] = mockStatementImportRepository.finishJob.mock
        .calls[0] as [number, { error?: { code: string; message: string } }];
      expect(totals.error?.code).toBe('PARTIAL_FAILURES');
      expect(totals.error?.message).toBe(
        mockI18n.t('finance.STATEMENT_IMPORT_INVALID_PDF', {
          args: { file: '/tmp/one.pdf' },
        }),
      );
    });

    it('no interrumpe el lote si falla la notificación de finalización', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockNotificationService.create.mockRejectedValue(new Error('queue down'));
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.finishJob).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo crear la notificación'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('continúa si no se puede emitir el progreso del lote', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      const job = buildJob();
      mockStatementImportRepository.findJobById
        .mockResolvedValueOnce(job)
        .mockRejectedValueOnce(new Error('emit fail'))
        .mockResolvedValue(job);
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);
      const debugSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo emitir progreso'),
        expect.any(Error),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalled();
      debugSpy.mockRestore();
    });

    it('finaliza el lote sin archivos sin limpiar ningún directorio', async () => {
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          processed_files: 0,
          success_files: 0,
          failed_files: 0,
          error: null,
        }),
      );
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('clasifica errores lanzados sin objeto Error', async () => {
      mockParsePdfStatement.mockRejectedValue(null);
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile(),
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_INVALID',
        expect.any(String),
      );
    });
  });

  describe('retryJob', () => {
    it('lanza BadRequestException si no hay archivos reintentables', async () => {
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [],
      );

      await expect(service.retryJob(1, 10)).rejects.toThrow(
        BadRequestException,
      );
      expect(
        mockStatementImportRepository.resetFailedFilesForRetry,
      ).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si hay archivos fallidos sin storage_path', async () => {
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile({ id: 7, filename: 'roto.pdf', storage_path: null })],
      );

      await expect(service.retryJob(1, 10)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockI18n.t).toHaveBeenCalledWith(
        'finance.STATEMENT_IMPORT_STORAGE_MISSING_RETRY',
        { args: { files: 'roto.pdf' } },
      );
      expect(
        mockStatementImportRepository.resetFailedFilesForRetry,
      ).not.toHaveBeenCalled();
    });

    it('re-procesa los archivos fallidos con la contraseña y las entidades', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile()],
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ status: StatementImportFileStatusEnum.PENDING }),
      ]);
      const entities = [{ code: 'daviplata', detect_patterns: ['x'] }];
      mockBankingEntityService.getActiveDetections.mockResolvedValue(entities);
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      const result = await service.retryJob(1, 10, 'clave');

      expect(result).toEqual(buildJob());
      expect(
        mockStatementImportRepository.resetFailedFilesForRetry,
      ).toHaveBeenCalledWith(1);
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markProcessing).toHaveBeenCalledWith(
        1,
      );
      expect(mockParsePdfStatement).toHaveBeenCalledWith(
        pdfBuffer,
        'clave',
        undefined,
        entities,
      );
      expect(mockStatementImportRepository.markFileSuccess).toHaveBeenCalled();
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ success_files: 1, failed_files: 0 }),
      );
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(
        mockStatementImportRepository.clearStoragePath,
      ).toHaveBeenCalledWith(1);
    });

    it('usa detecciones vacías si la consulta falla durante el reintento', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile()],
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ status: StatementImportFileStatusEnum.PENDING }),
      ]);
      mockBankingEntityService.getActiveDetections.mockRejectedValue(
        new Error('db caído'),
      );
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.retryJob(1, 10);
      await flushChain();
      await flushChain();

      expect(mockParsePdfStatement).toHaveBeenCalledWith(
        pdfBuffer,
        undefined,
        undefined,
        [],
      );
    });

    it('marca el archivo como fallido si el reintento falla', async () => {
      mockParsePdfStatement.mockRejectedValue(
        Object.assign(new Error('Incorrect password'), {
          name: 'PasswordException',
        }),
      );
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile()],
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ status: StatementImportFileStatusEnum.PENDING }),
      ]);

      await service.retryJob(1, 10, 'clave');
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.markFileFailed).toHaveBeenCalledWith(
        1,
        'PDF_WRONG_PASSWORD',
        expect.any(String),
      );
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ failed_files: 1 }),
      );
    });

    it('no limpia el directorio ni reporta errores si no quedan archivos pendientes', async () => {
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile()],
      );
      mockStatementImportRepository.findFilesByImport.mockResolvedValue([
        buildFile({ status: StatementImportFileStatusEnum.SUCCESS }),
      ]);

      await service.retryJob(1, 10);
      await flushChain();
      await flushChain();

      expect(mockStatementImportRepository.finishJob).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          processed_files: 0,
          success_files: 0,
          failed_files: 0,
          error: null,
        }),
      );
      expect(
        mockStatementImportRepository.markFileSuccess,
      ).not.toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('resuelve la empresa por coincidencia difusa cuando capture_companies está activo', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [
          buildParsedTx({ description: 'PAGO EN ECOPETROL ESTACION' }),
        ],
        bank: 'bancolombia',
      });
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({
          options: { skip_duplicates: false, capture_companies: true },
        }),
      );
      mockEmpresaRepository.findAll.mockResolvedValue([
        { id: 7, name: 'Ecopetrol' },
      ]);
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'false',
        capture_companies: 'true',
      });
      await flushChain();
      await flushChain();

      expect(mockEmpresaRepository.findAll).toHaveBeenCalledWith(10);
      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [expect.objectContaining({ company_id: 7 })],
        expect.any(Object),
      );
    });

    it('no busca empresa por coincidencia difusa si ya hay default_company_id', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [
          buildParsedTx({ description: 'PAGO EN ECOPETROL ESTACION' }),
        ],
      });
      mockStatementImportRepository.findJobById.mockResolvedValue(
        buildJob({
          options: {
            skip_duplicates: false,
            capture_companies: true,
            default_company_id: 3,
          },
        }),
      );
      mockEmpresaRepository.findAll.mockResolvedValue([
        { id: 7, name: 'Ecopetrol' },
      ]);
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'false',
        capture_companies: 'true',
        default_company_id: 3,
      });
      await flushChain();
      await flushChain();

      expect(mockTransactionRecordRepository.createMany).toHaveBeenCalledWith(
        10,
        [expect.objectContaining({ company_id: 3 })],
        expect.any(Object),
      );
    });

    it('no falla si rm rechaza al limpiar el archivo procesado', async () => {
      mockParsePdfStatement.mockResolvedValue({
        transactions: [buildParsedTx()],
        bank: 'bancolombia',
      });
      mockTransactionRecordRepository.createMany.mockResolvedValue([
        { id: 99, category_id: 2 },
      ]);
      (rm as jest.Mock).mockRejectedValue(new Error('fs error'));

      await service.createJob(10, [pdfFile], {
        skip_duplicates: 'true',
      });
      await flushChain();
      await flushChain();

      expect(
        mockStatementImportRepository.clearStoragePath,
      ).toHaveBeenCalledWith(1);
      expect(mockStatementImportRepository.finishJob).toHaveBeenCalled();
    });

    it('registra el error si la cadena de reintento falla', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mockStatementImportRepository.findFailedFilesWithStorage.mockResolvedValue(
        [buildFile()],
      );
      mockStatementImportRepository.markProcessing.mockRejectedValue(
        new Error('update falló'),
      );

      const result = await service.retryJob(1, 10);

      expect(result).toEqual(buildJob());
      await flushChain();
      await flushChain();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reintentando lote'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });
});

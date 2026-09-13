import { Test, TestingModule } from '@nestjs/testing';
import { AdminLogService } from '@admin/service/admin-log.service';
import * as fs from 'node:fs';
import {
  SystemLogQueryDto,
  SystemLogSource,
} from '@admin/dto/system-log-query.dto';

jest.mock('node:fs');

const mockedFs = jest.mocked(fs);

const fallbackContent = [
  JSON.stringify({
    severity: 'INFO',
    data: 'App started',
    context: 'Bootstrap',
    source: 'app',
    timestamp: '2025-01-01T10:00:00Z',
  }),
  JSON.stringify({
    severity: 'ERROR',
    data: { err: 'timeout' },
    context: 'HttpModule',
    source: 'app',
    timestamp: '2025-01-01T12:00:00Z',
  }),
  JSON.stringify({
    severity: 'WARN',
    data: 'Deprecated call',
    context: 'PaymentService',
    source: 'app',
    timestamp: '2025-01-01T11:00:00Z',
  }),
].join('\n');

const nestContent = [
  JSON.stringify({
    pid: 1234,
    timestamp: '2025-01-01T09:00:00Z',
    level: 'info',
    context: 'NestApplication',
    message: 'Nest application started',
  }),
  JSON.stringify({
    pid: 1234,
    timestamp: '2025-01-01T13:00:00Z',
    level: 'debug',
    context: 'QueryRunner',
    message: 'SELECT * FROM users',
  }),
].join('\n');

const auditContent = [
  JSON.stringify({
    action: 'INSERT',
    schema_name: 'finance',
    table_name: 'transaction',
    record_id: 1,
    created_at: '2025-01-01T08:00:00Z',
  }),
  JSON.stringify({
    action: 'DELETE',
    schema_name: 'finance',
    table_name: 'transaction',
    record_id: 2,
    created_at: '2025-01-01T14:00:00Z',
  }),
].join('\n');

const buildQuery = (
  overrides: Partial<SystemLogQueryDto> = {},
): SystemLogQueryDto => ({
  page: 1,
  limit: 50,
  sortOrder: 'DESC',
  ...overrides,
});

describe('AdminLogService', () => {
  let service: AdminLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminLogService],
    }).compile();

    service = module.get<AdminLogService>(AdminLogService);
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  describe('findAll', () => {
    it('con source=ALL debe combinar fallback + nest', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(result.total).toBe(5);
      expect(result.data.length).toBe(5);
    });

    it('con source=APP solo debe leer fallback + nest', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.APP }),
      );

      expect(result.total).toBe(5);
      expect(result.data.every((e) => e.source !== 'audit')).toBe(true);
    });

    it('con source=AUDIT solo debe leer audit', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValueOnce(auditContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.AUDIT }),
      );

      expect(result.total).toBe(2);
      expect(result.data.every((e) => e.source === 'audit')).toBe(true);
    });

    it('debe filtrar por severity', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL, severity: 'ERROR' as never }),
      );

      expect(result.data.every((e) => e.severity === 'ERROR')).toBe(true);
    });

    it('debe filtrar por context', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL, context: 'HttpModule' }),
      );

      expect(result.data.length).toBe(1);
      expect(result.data[0].context).toBe('HttpModule');
    });

    it('debe filtrar por search en mensaje, contexto y data', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL, search: 'timeout' }),
      );

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(
        result.data.some((e) => e.message.toLowerCase().includes('timeout')),
      ).toBe(true);
    });

    it('debe filtrar por startDate', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({
          source: SystemLogSource.ALL,
          startDate: '2025-01-01T11:00:00Z',
        }),
      );

      expect(
        result.data.every(
          (e) =>
            new Date(e.timestamp).getTime() >=
            new Date('2025-01-01T11:00:00Z').getTime(),
        ),
      ).toBe(true);
    });

    it('debe filtrar por endDate', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({
          source: SystemLogSource.ALL,
          endDate: '2025-01-01T11:00:00Z',
        }),
      );

      expect(
        result.data.every(
          (e) =>
            new Date(e.timestamp).getTime() <=
            new Date('2025-01-01T11:00:00Z').getTime(),
        ),
      ).toBe(true);
    });

    it('debe paginar correctamente', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL, page: 2, limit: 3 }),
      );

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(5);
    });

    it('debe ordenar ASC cuando sortOrder es ASC', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL, sortOrder: 'ASC' }),
      );

      for (let i = 1; i < result.data.length; i++) {
        expect(
          new Date(result.data[i].timestamp).getTime(),
        ).toBeGreaterThanOrEqual(
          new Date(result.data[i - 1].timestamp).getTime(),
        );
      }
    });

    it('debe ordenar DESC por defecto', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      for (let i = 1; i < result.data.length; i++) {
        expect(
          new Date(result.data[i].timestamp).getTime(),
        ).toBeLessThanOrEqual(new Date(result.data[i - 1].timestamp).getTime());
      }
    });
  });

  describe('getStats', () => {
    it('debe contar severidades correctamente', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent)
        .mockReturnValueOnce(auditContent);

      const stats = await service.getStats();

      expect(stats.total).toBe(7);
      expect(stats.info).toBeGreaterThanOrEqual(2);
      expect(stats.warn).toBeGreaterThanOrEqual(1);
      expect(stats.error).toBeGreaterThanOrEqual(1);
      expect(stats.debug).toBeGreaterThanOrEqual(1);
      expect(stats.newestEntry).toBeDefined();
      expect(stats.oldestEntry).toBeDefined();
    });

    it('debe retornar ceros cuando no hay logs', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 0,
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      });
    });
  });

  describe('streamLogs', () => {
    it('debe retornar fallback + nest ordenados DESC', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.streamLogs();

      expect(result.length).toBe(5);
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].timestamp).getTime()).toBeLessThanOrEqual(
          new Date(result[i - 1].timestamp).getTime(),
        );
      }
    });

    it('debe excluir audit logs', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(fallbackContent)
        .mockReturnValueOnce(nestContent);

      const result = await service.streamLogs();

      expect(result.every((e) => e.source !== 'audit')).toBe(true);
    });
  });

  describe('manejo de archivos ausentes', () => {
    it('debe retornar vacío cuando no existen los archivos', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('debe ignorar archivos ausentes individualmente en streamLogs', async () => {
      mockedFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockedFs.readFileSync.mockReturnValueOnce(fallbackContent);

      const result = await service.streamLogs();

      expect(result.length).toBe(3);
    });
  });

  describe('JSON malformado', () => {
    it('debe ignorar líneas inválidas en fallback-logs.json', async () => {
      const malformed = [
        fallbackContent.split('\n')[0],
        '{invalid json',
        fallbackContent.split('\n')[2],
      ].join('\n');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce(malformed)
        .mockReturnValueOnce('');

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(result.data.length).toBe(2);
    });

    it('debe ignorar líneas inválidas en nest-logs.log', async () => {
      const malformed =
        nestContent.split('\n')[0] +
        '\nnot json\n' +
        nestContent.split('\n')[1];
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce(malformed);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(result.data.length).toBe(2);
    });

    it('debe ignorar líneas inválidas en audit-logs.json', async () => {
      const malformed =
        auditContent.split('\n')[0] + '\n{bad}\n' + auditContent.split('\n')[1];
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValueOnce(malformed);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.AUDIT }),
      );

      expect(result.data.length).toBe(2);
    });
  });

  describe('errores de lectura de archivos', () => {
    it('debe capturar el error si falla la lectura de fallback-logs.json y continuar', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('EACCES fallback');
      });
      mockedFs.readFileSync.mockReturnValueOnce(nestContent);

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(
        result.data.every((e) => e.source !== 'app' || e.id.startsWith('nest')),
      ).toBe(true);
      expect(result.total).toBe(2);
    });

    it('debe capturar el error si falla la lectura de nest-logs.log y continuar', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValueOnce(fallbackContent);
      mockedFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('EACCES nest');
      });

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.ALL }),
      );

      expect(result.total).toBe(3);
    });

    it('debe capturar el error si falla la lectura de audit-logs.json y continuar', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('EACCES audit');
      });

      const result = await service.findAll(
        buildQuery({ source: SystemLogSource.AUDIT }),
      );

      expect(result).toEqual({ data: [], total: 0 });
    });
  });
});

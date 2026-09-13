import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '@audit/service/audit-log.service';
import { AuditLogRepository } from '@audit/repositories/audit-log.repository';
import { LoggingService } from '@shared/services/logging.service';
import { AuditLogQueryDto } from '@audit/dto/audit-log-query.dto';
import { WriteAuditLogDto } from '@audit/dto/write-audit-log.dto';
import { AuditActionEnum } from '@shared/enums';

const mockAuditLogRepository = {
  findAll: jest.fn(),
  findByUser: jest.fn(),
  write: jest.fn(),
};

const mockLoggingService = {
  sendLog: jest.fn((_data: unknown, _severity?: string, _context?: string) =>
    Promise.resolve(undefined),
  ),
};

const buildWriteDto = (
  overrides: Partial<WriteAuditLogDto> = {},
): WriteAuditLogDto => ({
  schema_name: 'finance',
  table_name: 'transaction_record',
  record_id: 1,
  action: AuditActionEnum.INSERT,
  changed_by: 5,
  new_data: { amount: 5000 },
  ...overrides,
});

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe delegar al repositorio y retornar el resultado', async () => {
      const payload = { data: [], total: 0 };
      mockAuditLogRepository.findAll.mockResolvedValue(payload);
      const query: AuditLogQueryDto = { page: 1, limit: 20 };

      const result = await service.findAll(query);

      expect(mockAuditLogRepository.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(payload);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findByUser
  // ─────────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('debe delegar al repositorio con userId y query', async () => {
      const payload = { data: [], total: 0 };
      mockAuditLogRepository.findByUser.mockResolvedValue(payload);

      const result = await service.findByUser(5, {});

      expect(mockAuditLogRepository.findByUser).toHaveBeenCalledWith(5, {});
      expect(result).toEqual(payload);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // write
  // ─────────────────────────────────────────────────────────────
  describe('write', () => {
    it('debe persistir el log y reenviarlo al sistema de logging', async () => {
      const dto = buildWriteDto();
      const saved = { id: 99, ...dto };
      mockAuditLogRepository.write.mockResolvedValue(saved);
      mockLoggingService.sendLog.mockResolvedValue(undefined);

      await service.write(dto);

      expect(mockAuditLogRepository.write).toHaveBeenCalledWith(dto);
      expect(mockLoggingService.sendLog).toHaveBeenCalledTimes(1);
    });

    it('debe usar severidad WARN para acciones DELETE', async () => {
      const dto = buildWriteDto({ action: AuditActionEnum.DELETE });
      mockAuditLogRepository.write.mockResolvedValue({ id: 1, ...dto });
      mockLoggingService.sendLog.mockResolvedValue(undefined);

      await service.write(dto);

      const [, severity] = mockLoggingService.sendLog.mock.calls[0];
      expect(severity).toBe('WARN');
    });

    it('debe usar severidad INFO para acciones INSERT/UPDATE', async () => {
      const dto = buildWriteDto({ action: AuditActionEnum.UPDATE });
      mockAuditLogRepository.write.mockResolvedValue({ id: 1, ...dto });
      mockLoggingService.sendLog.mockResolvedValue(undefined);

      await service.write(dto);

      const [, severity] = mockLoggingService.sendLog.mock.calls[0];
      expect(severity).toBe('INFO');
    });

    it('no debe propagar errores del sistema de logging remoto', async () => {
      const dto = buildWriteDto();
      mockAuditLogRepository.write.mockResolvedValue({ id: 1, ...dto });
      mockLoggingService.sendLog.mockRejectedValue(
        new Error('Servicio de logs caído'),
      );

      await expect(service.write(dto)).resolves.toBeUndefined();
    });

    it('debe manejar cuando el repositorio retorna null (error silenciado)', async () => {
      const dto = buildWriteDto();
      mockAuditLogRepository.write.mockResolvedValue(null);
      mockLoggingService.sendLog.mockResolvedValue(undefined);

      await expect(service.write(dto)).resolves.toBeUndefined();
      expect(mockLoggingService.sendLog).toHaveBeenCalledTimes(1);
    });
  });
});

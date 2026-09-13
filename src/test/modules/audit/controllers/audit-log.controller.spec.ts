import { NotFoundException } from '@nestjs/common';
import { AuditLogController } from '@audit/controller/audit-log.controller';
import { AuditLogService } from '@audit/service/audit-log.service';
import { AuditLogQueryDto } from '@audit/dto/audit-log-query.dto';
import { AuditActionEnum } from '@shared/enums';

const mockAuditLogService = {
  findAll: jest.fn(),
  findByUser: jest.fn(),
};

const buildEntry = (overrides = {}) => ({
  id: 1,
  schema_name: 'finance',
  table_name: 'transaction_record',
  record_id: 10,
  action: AuditActionEnum.INSERT,
  changed_by: 5,
  old_data: null,
  new_data: { amount: 5000 },
  created_at: new Date(),
  ...overrides,
});

describe('AuditLogController', () => {
  let controller: AuditLogController;

  beforeEach(() => {
    controller = new AuditLogController(
      mockAuditLogService as unknown as AuditLogService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar listado paginado de logs de auditoría', async () => {
      const payload = { data: [buildEntry()], total: 1 };
      mockAuditLogService.findAll.mockResolvedValue(payload);
      const query: AuditLogQueryDto = { page: 1, limit: 20 };

      const result = await controller.findAll(query);

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(payload);
    });

    it('debe retornar lista vacía cuando no hay registros', async () => {
      mockAuditLogService.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findAll({});

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('debe pasar filtros opcionales al servicio', async () => {
      const query: AuditLogQueryDto = {
        schema_name: 'finance',
        table_name: 'transaction_record',
        action: AuditActionEnum.DELETE,
        page: 2,
        limit: 10,
      };
      mockAuditLogService.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll(query);

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findByUser
  // ─────────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('debe retornar logs del usuario indicado', async () => {
      const payload = { data: [buildEntry({ changed_by: 7 })], total: 1 };
      mockAuditLogService.findByUser.mockResolvedValue(payload);

      const result = await controller.findByUser(7, {});

      expect(mockAuditLogService.findByUser).toHaveBeenCalledWith(7, {});
      expect(result).toEqual(payload);
    });

    it('debe propagar excepciones del servicio', async () => {
      mockAuditLogService.findByUser.mockRejectedValue(new NotFoundException());

      await expect(controller.findByUser(999, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

import { AdminLogController } from '@admin/controller/admin-log.controller';
import { AdminLogService } from '@admin/service/admin-log.service';
import { SystemLogQueryDto } from '@admin/dto/system-log-query.dto';

const mockAdminLogService = {
  findAll: jest.fn(),
  getStats: jest.fn(),
  streamLogs: jest.fn(),
};

describe('AdminLogController', () => {
  let controller: AdminLogController;

  beforeEach(() => {
    controller = new AdminLogController(
      mockAdminLogService as unknown as AdminLogService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe delegar al servicio y retornar el listado paginado', async () => {
      const payload = {
        data: [
          {
            id: 'app-0',
            severity: 'INFO',
            message: 'ok',
            source: 'app',
            timestamp: '2025-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };
      mockAdminLogService.findAll.mockResolvedValue(payload);
      const query: SystemLogQueryDto = { page: 1, limit: 20 };

      const result = await controller.findAll(query);

      expect(mockAdminLogService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(payload);
    });

    it('debe retornar lista vacía cuando no hay logs', async () => {
      mockAdminLogService.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findAll({});

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('debe pasar filtros opcionales al servicio', async () => {
      const query: SystemLogQueryDto = {
        severity: 'ERROR' as never,
        source: 'app' as never,
        search: 'timeout',
        context: 'HttpModule',
        page: 2,
        limit: 10,
        sortOrder: 'ASC',
      };
      mockAdminLogService.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll(query);

      expect(mockAdminLogService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getStats
  // ─────────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('debe delegar al servicio y retornar estadísticas', async () => {
      const stats = { total: 100, info: 60, warn: 20, error: 15, debug: 5 };
      mockAdminLogService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(mockAdminLogService.getStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(stats);
    });

    it('debe retornar estadísticas con ceros cuando no hay logs', async () => {
      mockAdminLogService.getStats.mockResolvedValue({
        total: 0,
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      });

      const result = await controller.getStats();

      expect(result).toEqual({
        total: 0,
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getRealtime
  // ─────────────────────────────────────────────────────────────
  describe('getRealtime', () => {
    it('debe llamar a streamLogs del servicio', async () => {
      const logs = [
        {
          id: 'app-0',
          severity: 'INFO',
          message: 'ok',
          source: 'app',
          timestamp: '2025-01-01T00:00:00Z',
        },
      ];
      mockAdminLogService.streamLogs.mockResolvedValue(logs);

      const result = await controller.getRealtime();

      expect(mockAdminLogService.streamLogs).toHaveBeenCalledTimes(1);
      expect(result).toEqual(logs);
    });

    it('debe retornar lista vacía cuando no hay logs en tiempo real', async () => {
      mockAdminLogService.streamLogs.mockResolvedValue([]);

      const result = await controller.getRealtime();

      expect(result).toEqual([]);
    });
  });
});

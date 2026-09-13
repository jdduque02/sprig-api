import { PerformanceController } from '@admin/controller/performance.controller';
import { PerformanceService } from '@admin/service/performance.service';
import { PerformanceResponseDto } from '@admin/dto/performance-response.dto';

describe('PerformanceController', () => {
  let controller: PerformanceController;
  const mockPerformanceService = {
    getSnapshot: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PerformanceController(
      mockPerformanceService as unknown as PerformanceService,
    );
  });

  it('debe delegar en PerformanceService.getSnapshot', async () => {
    const payload: PerformanceResponseDto = {
      uptimeSeconds: 120,
      memory: { rssMb: 1, heapTotalMb: 1, heapUsedMb: 1, externalMb: 1 },
      cpu: { usagePercent: 1, loadAverage: [0, 0, 0], cores: 4 },
      latency: { databaseMs: 5 },
      health: { status: 'ok' },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    mockPerformanceService.getSnapshot.mockResolvedValue(payload);

    const result = await controller.getPerformance();

    expect(mockPerformanceService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload);
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import { PerformanceService } from '@admin/service/performance.service';
import type { HealthService } from '@admin/service/health.service';
import type { DataSource } from 'typeorm';

describe('PerformanceService', () => {
  let service: PerformanceService;
  const mockHealthService = { check: jest.fn() };
  const mockDataSource = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHealthService.check.mockResolvedValue({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    service = new PerformanceService(
      mockHealthService as unknown as HealthService,
      mockDataSource as unknown as DataSource,
    );
  });

  it('debe retornar un snapshot con uptime, memoria, cpu, latencia y salud', async () => {
    const snapshot = await service.getSnapshot();

    expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');

    expect(typeof snapshot.uptimeSeconds).toBe('number');
    expect(typeof snapshot.memory.rssMb).toBe('number');
    expect(typeof snapshot.memory.heapTotalMb).toBe('number');
    expect(typeof snapshot.memory.heapUsedMb).toBe('number');
    expect(typeof snapshot.memory.externalMb).toBe('number');
    expect(typeof snapshot.cpu.usagePercent).toBe('number');
    expect(Array.isArray(snapshot.cpu.loadAverage)).toBe(true);
    expect(typeof snapshot.cpu.cores).toBe('number');
    expect(snapshot.latency.databaseMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.health).toEqual({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });
    expect(typeof snapshot.timestamp).toBe('string');
  });

  it('debe propagar el error si la consulta de latencia falla', async () => {
    mockDataSource.query.mockRejectedValue(new Error('DB unavailable'));

    await expect(service.getSnapshot()).rejects.toThrow('DB unavailable');
  });

  it('debe degradar el snapshot de salud en vez de fallar cuando una dependencia está down', async () => {
    const degradedBody = {
      status: 'error',
      info: {},
      error: { redis: { status: 'down', message: 'ECONNREFUSED' } },
      details: { redis: { status: 'down', message: 'ECONNREFUSED' } },
    };
    mockHealthService.check.mockRejectedValue(
      new ServiceUnavailableException(degradedBody),
    );

    const snapshot = await service.getSnapshot();

    expect(snapshot.health).toEqual(degradedBody);
    expect(typeof snapshot.uptimeSeconds).toBe('number');
  });

  it('debe propagar errores de HealthService que no sean ServiceUnavailableException', async () => {
    mockHealthService.check.mockRejectedValue(new Error('unexpected'));

    await expect(service.getSnapshot()).rejects.toThrow('unexpected');
  });
});

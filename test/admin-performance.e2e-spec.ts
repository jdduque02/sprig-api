import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PerformanceController } from '@admin/controller/performance.controller';
import { PerformanceService } from '@admin/service/performance.service';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';

/**
 * E2E del endpoint `GET /admin/performance`. Igual que en `health.e2e-spec.ts`,
 * se monta un módulo mínimo (controller real + service mockeado) para
 * verificar el contrato HTTP: requiere autenticación + rol admin y expone el
 * snapshot de métricas.
 */
describe('PerformanceController (e2e)', () => {
  let app: INestApplication;
  const mockPerformanceService = {
    getSnapshot: jest.fn(),
  };
  const mockAuthGuard = { canActivate: jest.fn() };
  const mockAdminGuard = { canActivate: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        { provide: PerformanceService, useValue: mockPerformanceService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /admin/performance responde 403 cuando el usuario no es admin', async () => {
    mockAuthGuard.canActivate.mockReturnValue(true);
    mockAdminGuard.canActivate.mockReturnValue(false);

    const response = await request(app.getHttpServer()).get(
      '/admin/performance',
    );

    expect(response.status).toBe(403);
    expect(mockPerformanceService.getSnapshot).not.toHaveBeenCalled();
  });

  it('GET /admin/performance responde 200 con el snapshot cuando el usuario es admin', async () => {
    mockAuthGuard.canActivate.mockReturnValue(true);
    mockAdminGuard.canActivate.mockReturnValue(true);
    mockPerformanceService.getSnapshot.mockResolvedValue({
      uptimeSeconds: 42,
      memory: { rssMb: 1, heapTotalMb: 1, heapUsedMb: 1, externalMb: 1 },
      cpu: { usagePercent: 1, loadAverage: [0, 0, 0], cores: 4 },
      latency: { databaseMs: 3 },
      health: { status: 'ok' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const response = await request(app.getHttpServer()).get(
      '/admin/performance',
    );

    expect(response.status).toBe(200);
    expect(mockPerformanceService.getSnapshot).toHaveBeenCalledTimes(1);
  });
});

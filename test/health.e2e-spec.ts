import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '@admin/controller/health.controller';
import { HealthService } from '@admin/service/health.service';

/**
 * E2E del endpoint público de health check (`GET /health`). Se construye un
 * módulo mínimo con `HealthController` + un `HealthService` mockeado en vez
 * de levantar toda la app (DB/Redis/RabbitMQ/Keycloak reales), ya que lo que
 * se valida aquí es el contrato HTTP (ruta pública, shape de la respuesta),
 * no la infraestructura real.
 */
describe('HealthController (e2e)', () => {
  let app: INestApplication;
  const mockHealthService = {
    check: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /health responde 200 sin autenticación cuando todo está up', async () => {
    mockHealthService.check.mockResolvedValue({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });

    const response = await request(app.getHttpServer()).get('/health');

    const body = response.body as { status: string };
    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('GET /health propaga el error cuando una dependencia falla', async () => {
    mockHealthService.check.mockRejectedValue(new Error('down'));

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(500);
  });
});

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { HealthService } from '@admin/service/health.service';

/**
 * Endpoint público de health check (probe de infraestructura, ej. Kubernetes
 * liveness/readiness). Intencionalmente NO requiere autenticación: no expone
 * datos sensibles, solo el estado `up`/`down` de cada dependencia.
 *
 * La respuesta pasa por el `TransformInterceptor`/`ResponseInterceptor`
 * global igual que el resto de endpoints, así que el shape resultante es
 * `{ status, message, data: [ { status, info, error, details } ], timestamp }`.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Health check del servicio (DB, Redis, RabbitMQ, Keycloak, memoria y disco)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Todas las dependencias están operativas. Envuelto por el TransformInterceptor global.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Al menos una dependencia no está disponible.',
  })
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}

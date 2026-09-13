import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';
import { PerformanceService } from '@admin/service/performance.service';
import { PerformanceResponseDto } from '@admin/dto/performance-response.dto';

/**
 * Endpoint de métricas/rendimiento del servicio, consumido por el dashboard
 * de `cost-manager-web`. Expone detalles internos del proceso (memoria, CPU,
 * salud de dependencias), por lo que requiere rol `admin` (a diferencia de
 * `/health`, que es un probe público sin datos sensibles).
 */
@ApiTags('admin / performance')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Métricas de rendimiento del servicio (uptime, memoria, CPU, latencia y salud de dependencias)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Snapshot de métricas de rendimiento del proceso.',
    type: PerformanceResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async getPerformance(): Promise<PerformanceResponseDto> {
    return this.performanceService.getSnapshot();
  }
}

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiExtraModels,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';
import { AdminLogService } from '@admin/service/admin-log.service';
import { SystemLogQueryDto } from '@admin/dto/system-log-query.dto';
import {
  SystemLogEntryDto,
  SystemLogStatsDto,
} from '@admin/dto/system-log-response.dto';
import { Observable, interval, switchMap, map } from 'rxjs';

@ApiTags('admin / logs')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/logs')
export class AdminLogController {
  constructor(private readonly adminLogService: AdminLogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiExtraModels(SystemLogEntryDto)
  @ApiOperation({ summary: 'Listar logs del sistema con filtros' })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['app', 'audit', 'all'],
    default: 'all',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar en mensaje/contexto',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    description: 'Filtrar por contexto (módulo)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Fecha inicio ISO 8601',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Fecha fin ISO 8601',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['timestamp', 'severity'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de logs del sistema.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(SystemLogEntryDto) },
        },
        total: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async findAll(@Query() query: SystemLogQueryDto) {
    return this.adminLogService.findAll(query);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estadísticas de logs del sistema' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas de severidad y rango temporal.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(SystemLogStatsDto) },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async getStats() {
    return this.adminLogService.getStats();
  }

  @Get('realtime')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logs en tiempo real (polling cada 5s)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Últimos logs del sistema (app + nest).',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(SystemLogEntryDto) },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async getRealtime() {
    return this.adminLogService.streamLogs();
  }
}

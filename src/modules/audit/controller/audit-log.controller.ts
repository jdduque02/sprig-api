import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { AuditLogService } from '@audit/service/audit-log.service';
import { AuditLogQueryDto } from '@audit/dto/audit-log-query.dto';
import { AuditLogResponseDto } from '@audit/dto/audit-log-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('audit')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@ApiForbiddenResponse({
  description: 'Requiere rol admin.',
  type: ErrorResponseDto,
})
@Controller('audit')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiExtraModels(AuditLogResponseDto)
  @ApiOperation({
    summary: 'Listar registros de auditoría con filtros opcionales',
  })
  @ApiQuery({ name: 'schema_name', required: false })
  @ApiQuery({ name: 'table_name', required: false })
  @ApiQuery({ name: 'record_id', required: false })
  @ApiQuery({ name: 'changed_by', required: false })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: ['INSERT', 'UPDATE', 'DELETE'],
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de logs de auditoría.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Operación exitosa' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(AuditLogResponseDto) },
        },
        total: { type: 'number', example: 100 },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token inválido o ausente.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
    type: ErrorResponseDto,
  })
  async findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar registros de auditoría de un usuario específico',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logs del usuario.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(AuditLogResponseDto) },
        },
        total: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async findByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditLogService.findByUser(userId, query);
  }
}

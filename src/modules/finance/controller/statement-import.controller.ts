import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { StatementImportService } from '@finance/service/statement-import.service';
import {
  MAX_IMPORT_FILES,
  MAX_IMPORT_FILE_SIZE,
} from '@finance/service/statement-import.service';
import { CreateStatementImportDto } from '@finance/dto/statement-import/create-statement-import.dto';
import { StatementImportResponseDto } from '@finance/dto/statement-import/statement-import-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiExtraModels(StatementImportResponseDto)
@ApiBearerAuth('bearer')
@Controller('users/:userId/statement-imports')
export class StatementImportController {
  constructor(
    private readonly statementImportService: StatementImportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMPORT_FILES, {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMPORT_FILE_SIZE,
        files: MAX_IMPORT_FILES,
      },
    }),
  )
  @ApiOperation({
    summary:
      'Crear carga de extractos bancarios (multipart). Procesa de forma asíncrona y reporta por archivo.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'PDFs del extracto (máx. 10, 15MB cada uno).',
        },
        password: {
          type: 'string',
          description: 'Contraseña del PDF (no se persiste).',
        },
        default_category_id: { type: 'number' },
        account_id: { type: 'number' },
        skip_duplicates: {
          type: 'string',
          enum: ['true', 'false'],
        },
        default_type: {
          type: 'string',
          enum: ['income', 'expense', 'investment'],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Lote creado y en cola de procesamiento.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(StatementImportResponseDto) },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Sin archivos, archivo no PDF o sin categoría por defecto.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el lote.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateStatementImportDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.statementImportService.createJob(userId, files ?? [], dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 300, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar cargas de extractos del usuario' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cargas del usuario.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(StatementImportResponseDto) },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    return this.statementImportService.findAll(
      userId,
      limitNum,
      (pageNum - 1) * limitNum,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 300, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Obtener carga por ID con detalle por archivo',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Carga encontrada.',
    type: StatementImportResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Carga no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.statementImportService.findOne(id, userId);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reintentar archivos fallidos de una carga de extractos existente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reintento iniciado.',
    type: StatementImportResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Carga no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'No hay archivos fallidos o no están disponibles.',
    type: ErrorResponseDto,
  })
  async retry(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password?: string },
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.statementImportService.retryJob(id, userId, body?.password);
  }
}

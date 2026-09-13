import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { BulkDeleteTransactionsDto } from '@finance/dto/transaction-record/bulk-delete-transactions.dto';
import { TransactionSummaryQueryDto } from '@finance/dto/transaction-record/transaction-summary-query.dto';
import { TransactionRecordResponseDto } from '@finance/dto/transaction-record/transaction-record-response.dto';
import { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import { UpcomingPaymentDto } from '@finance/dto/transaction-record/upcoming-payment.dto';
import { CloneTransactionDto } from '@finance/dto/transaction-record/clone-transaction.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiExtraModels(
  TransactionRecordResponseDto,
  TransactionSummaryResponseDto,
  UpcomingPaymentDto,
)
@ApiBearerAuth('bearer')
@Controller('users/:userId/transactions')
export class TransactionRecordController {
  constructor(
    private readonly transactionRecordService: TransactionRecordService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar transacción' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Transacción creada.',
    type: TransactionRecordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la transacción.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateTransactionRecordDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Listar transacciones del usuario (usar date_from/date_to por transaction_date)',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    description: 'Fecha inicio (ISO 8601). Filtra por transaction_date.',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    description: 'Fecha fin (ISO 8601).',
  })
  @ApiQuery({ name: 'category_id', required: false })
  @ApiQuery({ name: 'subcategory_id', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({
    name: 'category_status',
    required: false,
    enum: ['categorized', 'pending'],
  })
  @ApiQuery({
    name: 'uncategorized',
    required: false,
    description: 'Solo transacciones pendientes por categorizar (por editar).',
  })
  @ApiQuery({
    name: 'objective_id',
    required: false,
    description: 'Filtrar por meta asociada',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Filtrar por cuenta bancaria asociada',
  })
  @ApiQuery({
    name: 'asset_id',
    required: false,
    description: 'Filtrar por activo financiero asociado',
  })
  @ApiQuery({
    name: 'liability_id',
    required: false,
    description: 'Filtrar por pasivo asociado',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transacciones del usuario.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(TransactionRecordResponseDto) },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: TransactionRecordQueryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.findAll(userId, query);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resumen/resumen de transacciones por intervalo de tiempo (día/semana/mes)',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    description: 'Fecha inicio (ISO 8601). Filtra por transaction_date.',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    description: 'Fecha fin (ISO 8601).',
  })
  @ApiQuery({
    name: 'group_by',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Granularidad de la serie del resumen.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filtrar por tipo de transacción.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen de transacciones del intervalo.',
    type: TransactionSummaryResponseDto,
  })
  async summary(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: TransactionSummaryQueryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.getSummary(userId, query);
  }

  @Get('upcoming-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Próximos pagos de suscripciones (deducciones fijas) con fecha y días restantes',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Lista de suscripciones con su próximo pago calculado y ordenado por fecha.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(UpcomingPaymentDto) },
        },
      },
    },
  })
  async upcomingPayments(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    const data =
      await this.transactionRecordService.getUpcomingPayments(userId);
    return { data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener transacción por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transacción encontrada.',
    type: TransactionRecordResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.findOne(id, userId);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clonar transacción' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Transacción clonada.',
    type: TransactionRecordResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  async clone(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloneTransactionDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.clone(id, userId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar transacción' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transacción actualizada.',
    type: TransactionRecordResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionRecordDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.update(id, userId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminación masiva de transacciones (soft delete)',
    description:
      'Elimina (soft) las transacciones indicadas y recalcula los saldos vinculados de forma agregada.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cantidad de transacciones eliminadas.',
    schema: { properties: { deleted: { type: 'number' } } },
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async removeMany(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: BulkDeleteTransactionsDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    const deleted = await this.transactionRecordService.removeMany(
      dto.ids,
      userId,
    );
    return { deleted };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar transacción (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Transacción eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transactionRecordService.remove(id, userId);
  }
}

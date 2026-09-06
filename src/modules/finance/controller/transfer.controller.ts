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
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { TransferService } from '@finance/service/transfer.service';
import { CreateTransferDto } from '@finance/dto/transaction-record/create-transfer.dto';
import { UpdateTransferDto } from '@finance/dto/transaction-record/update-transfer.dto';
import { CloneTransferDto } from '@finance/dto/transaction-record/clone-transfer.dto';
import { TransferResponseDto } from '@finance/dto/transaction-record/transfer-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@Throttle({ global: { limit: 300, ttl: 60_000 } })
@ApiBearerAuth('bearer')
@Controller('users/:userId/transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar movimiento bancario (transferencia entre cuentas)',
    description:
      'Crea un par de movimientos ligados (origen y destino) en una sola transacción atómica: debita la cuenta origen y acredita la cuenta destino.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Transferencia creada.',
    type: TransferResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos (origen y destino deben diferir).',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la transferencia.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateTransferDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transferService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar movimientos bancarios (transferencias)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transferencias del usuario.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TransferResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? Math.max(1, Number(page)) : 1;
    const l = limit ? Math.min(Math.max(1, Number(limit)), 500) : 20;
    return this.transferService.findAll(userId, p, l);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener transferencia por ID (devuelve el par)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transferencia encontrada.',
    type: TransferResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transferencia no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transferService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 500, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Actualizar monto/fecha/descripción de una transferencia',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transferencia actualizada.',
    type: TransferResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transferencia no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransferDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transferService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar transferencia (soft delete de ambos movimientos)',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Transferencia eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Transferencia no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transferService.remove(id, userId);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Clonar una transferencia completa',
    description:
      'Crea un nuevo par de movimientos (origen + destino) copiando la transferencia original con un nuevo transfer_group_id.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Transferencia clonada.',
    type: TransferResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transferencia no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Transferencia inválida para clonar.',
    type: ErrorResponseDto,
  })
  async clone(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloneTransferDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.transferService.clone(id, userId, dto);
  }
}

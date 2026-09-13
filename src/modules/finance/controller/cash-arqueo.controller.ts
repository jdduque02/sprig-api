import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { CashArqueoService } from '@finance/service/cash-arqueo.service';
import { CreateCashArqueoDto } from '@finance/dto/cash-arqueo/create-cash-arqueo.dto';
import {
  CashArqueoResponseDto,
  CashReconciliationDto,
} from '@finance/dto/cash-arqueo/cash-arqueo-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/cash-arqueos')
export class CashArqueoController {
  constructor(
    private readonly cashArqueoService: CashArqueoService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  @Get('reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Conciliación del mes: registros del aplicativo vs extractos cargados',
    description:
      'Contrasta los registros/suscripciones del mes (source=manual) con los movimientos de los extractos cargados (source=import): totales, coincidencias y discrepancias.',
  })
  @ApiQuery({
    name: 'month',
    required: true,
    description: 'Mes en formato YYYY-MM (ej: 2026-08).',
    example: '2026-08',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conciliación del mes.',
    type: CashReconciliationDto,
  })
  @ApiBadRequestResponse({
    description: 'Mes inválido.',
    type: ErrorResponseDto,
  })
  async reconciliation(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('month') month: string,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    if (!month || !MONTH_FORMAT.test(month)) {
      throw new BadRequestException(
        this.i18n.t('finance.CASH_ARQUEO_INVALID_MONTH'),
      );
    }
    return this.cashArqueoService.getReconciliation(userId, month);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar arqueo de caja',
    description:
      'Guarda el efectivo físico contado y lo compara con el valor esperado reconciliado del mes (registros del app vs extractos).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Arqueo creado.',
    type: CashArqueoResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateCashArqueoDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.cashArqueoService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar arqueos de caja del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Arqueos del usuario.',
    type: [CashArqueoResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.cashArqueoService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener arqueo de caja por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Arqueo encontrado.',
    type: CashArqueoResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Arqueo no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.cashArqueoService.findOne(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar arqueo de caja (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Arqueo eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Arqueo no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.cashArqueoService.remove(id, userId);
  }
}

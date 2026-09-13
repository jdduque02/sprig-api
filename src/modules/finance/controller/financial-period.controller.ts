import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
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
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { FinancialPeriodService } from '@finance/service/financial-period.service';
import { CreateFinancialPeriodDto } from '@finance/dto/financial-period/create-financial-period.dto';
import { FinancialPeriodResponseDto } from '@finance/dto/financial-period/financial-period-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/financial-periods')
export class FinancialPeriodController {
  constructor(
    private readonly financialPeriodService: FinancialPeriodService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear período financiero mensual' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Período creado.',
    type: FinancialPeriodResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe un período para ese mes/año.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el período.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateFinancialPeriodDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialPeriodService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar períodos financieros del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Períodos del usuario.',
    type: [FinancialPeriodResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialPeriodService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener período financiero por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Período encontrado.',
    type: FinancialPeriodResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Período no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialPeriodService.findOne(id, userId);
  }

  @Patch(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar período financiero' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Período cerrado.',
    type: FinancialPeriodResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Período no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'El período ya está cerrado.',
    type: ErrorResponseDto,
  })
  async close(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialPeriodService.close(id, userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { FinancialObjectiveService } from '@finance/service/financial-objective.service';
import { CreateFinancialObjectiveDto } from '@finance/dto/financial-objective/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from '@finance/dto/financial-objective/update-financial-objective.dto';
import { CalculateQuotaDto } from '@finance/dto/financial-objective/calculate-quota.dto';
import { FinancialObjectiveResponseDto } from '@finance/dto/financial-objective/financial-objective-response.dto';
import { CalculateQuotaResponseDto } from '@finance/dto/financial-objective/calculate-quota-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/financial-objectives')
export class FinancialObjectiveController {
  constructor(
    private readonly financialObjectiveService: FinancialObjectiveService,
  ) {}

  @Post('calculate-quota')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calcular cuotas para alcanzar una meta de ahorro' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cuotas calculadas exitosamente.',
    type: CalculateQuotaResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al calcular las cuotas.',
    type: ErrorResponseDto,
  })
  async calculateQuota(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CalculateQuotaDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.calculateQuota(userId, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear objetivo financiero' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Objetivo creado.',
    type: FinancialObjectiveResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el objetivo.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateFinancialObjectiveDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar objetivos financieros del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Objetivos del usuario.',
    type: [FinancialObjectiveResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener objetivo financiero por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Objetivo encontrado.',
    type: FinancialObjectiveResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Objetivo no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar objetivo financiero' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Objetivo actualizado.',
    type: FinancialObjectiveResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Objetivo no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFinancialObjectiveDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar objetivo financiero (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Objetivo eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Objetivo no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialObjectiveService.remove(id, userId);
  }
}

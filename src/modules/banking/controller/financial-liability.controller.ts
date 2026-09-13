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
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';
import { UpdateFinancialLiabilityDto } from '@banking/dto/financial-liability/update-financial-liability.dto';
import { FinancialLiabilityResponseDto } from '@banking/dto/financial-liability/financial-liability-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('banking')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/financial-liabilities')
export class FinancialLiabilityController {
  constructor(
    private readonly financialLiabilityService: FinancialLiabilityService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo pasivo financiero' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Pasivo creado exitosamente.',
    type: FinancialLiabilityResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el pasivo.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateFinancialLiabilityDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialLiabilityService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar pasivos financieros del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pasivos del usuario.',
    type: [FinancialLiabilityResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialLiabilityService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener pasivo financiero por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pasivo encontrado.',
    type: FinancialLiabilityResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Pasivo no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialLiabilityService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar pasivo financiero' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pasivo actualizado.',
    type: FinancialLiabilityResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Pasivo no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFinancialLiabilityDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialLiabilityService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar pasivo financiero (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Pasivo eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Pasivo no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialLiabilityService.remove(id, userId);
  }
}

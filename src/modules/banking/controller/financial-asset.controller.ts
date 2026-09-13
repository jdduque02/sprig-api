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
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';
import { UpdateFinancialAssetDto } from '@banking/dto/financial-asset/update-financial-asset.dto';
import { FinancialAssetResponseDto } from '@banking/dto/financial-asset/financial-asset-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('banking')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/financial-assets')
export class FinancialAssetController {
  constructor(private readonly financialAssetService: FinancialAssetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo activo financiero' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Activo creado exitosamente.',
    type: FinancialAssetResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el activo.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateFinancialAssetDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar activos financieros del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activos del usuario.',
    type: [FinancialAssetResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.findAll(userId);
  }

  @Get('quotes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar valor en línea de acciones/divisas registradas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cotizaciones en vivo de los activos con símbolo registrado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al consultar cotizaciones.',
    type: ErrorResponseDto,
  })
  async getQuotes(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.refreshQuotes(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener activo financiero por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activo encontrado.',
    type: FinancialAssetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Activo no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar activo financiero' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activo actualizado.',
    type: FinancialAssetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Activo no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFinancialAssetDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar activo financiero (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Activo eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Activo no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.financialAssetService.remove(id, userId);
  }
}

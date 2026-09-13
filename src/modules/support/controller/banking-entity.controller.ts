import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { BankingEntityService } from '@support/service/banking-entity.service';
import { CreateBankingEntityDto } from '@support/dto/banking-entity/create-banking-entity.dto';
import { UpdateBankingEntityDto } from '@support/dto/banking-entity/update-banking-entity.dto';
import { BankingEntityResponseDto } from '@support/dto/banking-entity/banking-entity-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('support (admin)')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/banking-entities')
export class BankingEntityController {
  constructor(private readonly bankingEntityService: BankingEntityService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar entidad bancaria para detección de extractos',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Entidad creada.',
    type: BankingEntityResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe una entidad con ese código.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la entidad.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateBankingEntityDto) {
    return this.bankingEntityService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar todas las entidades bancarias configuradas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de entidades.',
    type: [BankingEntityResponseDto],
  })
  async findAll() {
    return this.bankingEntityService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener entidad bancaria por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entidad encontrada.',
    type: BankingEntityResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Entidad no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bankingEntityService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar entidad bancaria' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entidad actualizada.',
    type: BankingEntityResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Entidad no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankingEntityDto,
  ) {
    return this.bankingEntityService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar entidad bancaria' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Entidad desactivada.',
  })
  @ApiNotFoundResponse({
    description: 'Entidad no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.bankingEntityService.remove(id);
  }
}

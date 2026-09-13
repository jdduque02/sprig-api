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
  getSchemaPath,
  ApiExtraModels,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { EmpresaService } from '@finance/service/empresa.service';
import { CreateEmpresaDto } from '@finance/dto/empresa/create-empresa.dto';
import { UpdateEmpresaDto } from '@finance/dto/empresa/update-empresa.dto';
import { EmpresaResponseDto } from '@finance/dto/empresa/empresa-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiExtraModels(EmpresaResponseDto)
@ApiBearerAuth('bearer')
@Controller('users/:userId/empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear empresa/comercio' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Empresa creada.',
    type: EmpresaResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la empresa.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateEmpresaDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.empresaService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar empresas del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Empresas del usuario.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(EmpresaResponseDto) },
        },
      },
    },
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.empresaService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener empresa por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Empresa encontrada.',
    type: EmpresaResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Empresa no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.empresaService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar empresa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Empresa actualizada.',
    type: EmpresaResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Empresa no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmpresaDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.empresaService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar empresa (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Empresa eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Empresa no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.empresaService.remove(id, userId);
  }
}

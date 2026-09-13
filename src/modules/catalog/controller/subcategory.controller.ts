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
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { SubcategoryService } from '@catalog/service/subcategory.service';
import { CreateSubcategoryDto } from '@catalog/dto/subcategory/create-subcategory.dto';
import { UpdateSubcategoryDto } from '@catalog/dto/subcategory/update-subcategory.dto';
import { SubcategoryResponseDto } from '@catalog/dto/subcategory/subcategory-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('catalog')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/catalog/subcategories')
export class SubcategoryController {
  constructor(private readonly subcategoryService: SubcategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear subcategoría personalizada del usuario' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subcategoría creada.',
    type: SubcategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe una subcategoría con ese nombre en esta categoría.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la subcategoría.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateSubcategoryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.subcategoryService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar subcategorías del usuario' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtrar por categoría padre.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subcategorías del usuario.',
    type: [SubcategoryResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('categoryId', new ParseIntPipe({ optional: true }))
    categoryId?: number,
    @CurrentUser() _currentUser?: IntrospectResponse,
  ) {
    return this.subcategoryService.findAll(userId, categoryId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener subcategoría por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subcategoría encontrada.',
    type: SubcategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Subcategoría no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.subcategoryService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar subcategoría del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subcategoría actualizada.',
    type: SubcategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Subcategoría no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.subcategoryService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar subcategoría del usuario' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Subcategoría desactivada.',
  })
  @ApiNotFoundResponse({
    description: 'Subcategoría no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.subcategoryService.remove(id, userId);
  }
}

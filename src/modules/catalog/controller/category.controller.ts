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
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CategoryService } from '@catalog/service/category.service';
import { CreateCategoryDto } from '@catalog/dto/category/create-category.dto';
import { UpdateCategoryDto } from '@catalog/dto/category/update-category.dto';
import { CategoryResponseDto } from '@catalog/dto/category/category-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('catalog')
@UseGuards(AuthGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('catalog/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear categoría del sistema' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Categoría creada.',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la categoría.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar todas las categorías activas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de categorías.',
    type: [CategoryResponseDto],
  })
  async findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoría encontrada.',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Categoría no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar categoría del sistema' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoría actualizada.',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Categoría no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar categoría del sistema' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Categoría desactivada.',
  })
  @ApiNotFoundResponse({
    description: 'Categoría no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}

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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { CategoryBudgetService } from '@finance/service/category-budget.service';
import { CreateCategoryBudgetDto } from '@finance/dto/category-budget/create-category-budget.dto';
import { UpdateCategoryBudgetDto } from '@finance/dto/category-budget/update-category-budget.dto';
import { CategoryBudgetQueryDto } from '@finance/dto/category-budget/category-budget-query.dto';
import { CategoryBudgetResponseDto } from '@finance/dto/category-budget/category-budget-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/category-budgets')
export class CategoryBudgetController {
  constructor(private readonly categoryBudgetService: CategoryBudgetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear presupuesto manual por categoría' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Presupuesto creado.',
    type: CategoryBudgetResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Categoría o subcategoría no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Ya existe un presupuesto para esa categoría/subcategoría en el periodo.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el presupuesto.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateCategoryBudgetDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.categoryBudgetService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar presupuestos por categoría del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presupuestos del usuario.',
    type: [CategoryBudgetResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: CategoryBudgetQueryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.categoryBudgetService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener presupuesto por ID (incluye % de uso)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presupuesto encontrado.',
    type: CategoryBudgetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Presupuesto no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.categoryBudgetService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar presupuesto por categoría' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presupuesto actualizado.',
    type: CategoryBudgetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Presupuesto, categoría o subcategoría no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryBudgetDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.categoryBudgetService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar presupuesto por categoría (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Presupuesto eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Presupuesto no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.categoryBudgetService.remove(id, userId);
  }
}

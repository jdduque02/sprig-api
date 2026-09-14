import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import { CategoryBudget } from '@finance/entities/category-budget.entity';
import { CreateCategoryBudgetDto } from '@finance/dto/category-budget/create-category-budget.dto';
import { UpdateCategoryBudgetDto } from '@finance/dto/category-budget/update-category-budget.dto';
import { CategoryBudgetQueryDto } from '@finance/dto/category-budget/category-budget-query.dto';

@Injectable()
export class CategoryBudgetRepository {
  private readonly logger = new Logger(CategoryBudgetRepository.name);

  constructor(
    @InjectRepository(CategoryBudget)
    private readonly repo: Repository<CategoryBudget>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateCategoryBudgetDto,
  ): Promise<CategoryBudget> {
    const subcategoryId = dto.subcategory_id ?? null;
    // La constraint UNIQUE de la tabla no protege este caso: en Postgres dos
    // filas con subcategory_id = NULL nunca se consideran duplicadas (NULL
    // no es igual a NULL), así que la deduplicación real se hace aquí.
    const existing = await this.repo.findOne({
      where: {
        user_id: userId,
        category_id: dto.category_id,
        subcategory_id: subcategoryId === null ? IsNull() : subcategoryId,
        year: dto.year,
        month: dto.month,
        deleted_at: IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException(
        this.i18n.t('finance.CATEGORY_BUDGET_DUPLICATE'),
      );
    }

    const budget = this.repo.create({
      ...dto,
      user_id: userId,
      subcategory_id: subcategoryId,
      currency: dto.currency ?? 'COP',
      alert_threshold_percent: dto.alert_threshold_percent ?? 80,
    });
    const saved = await this.repo.save(budget);
    this.logger.log(
      `Presupuesto de categoría creado (ID ${saved.id}) para usuario ID: ${userId}`,
    );
    return saved;
  }

  async findAll(
    userId: number,
    query: CategoryBudgetQueryDto,
  ): Promise<CategoryBudget[]> {
    const where: Record<string, unknown> = {
      user_id: userId,
      deleted_at: IsNull(),
    };
    if (query.year != null) where.year = query.year;
    if (query.month != null) where.month = query.month;
    if (query.category_id != null) where.category_id = query.category_id;
    return this.repo.find({ where, order: { year: 'DESC', month: 'DESC' } });
  }

  /** Presupuestos activos de todos los usuarios (uso del scheduler de alertas). */
  async findAllActive(): Promise<CategoryBudget[]> {
    return this.repo.find({
      where: { is_active: true, deleted_at: IsNull() },
    });
  }

  async findById(id: number, userId: number): Promise<CategoryBudget> {
    const budget = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!budget)
      throw new NotFoundException(
        this.i18n.t('finance.CATEGORY_BUDGET_NOT_FOUND', { args: { id } }),
      );
    return budget;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateCategoryBudgetDto,
  ): Promise<CategoryBudget> {
    const budget = await this.findById(id, userId);
    const merged = this.repo.merge(budget, dto);
    const saved = await this.repo.save(merged);
    this.logger.log(
      `Presupuesto de categoría ID ${id} actualizado para usuario ID: ${userId}`,
    );
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const budget = await this.findById(id, userId);
    await this.repo.softRemove(budget);
    this.logger.log(
      `Presupuesto de categoría ID ${id} eliminado (soft) para usuario ID: ${userId}`,
    );
  }
}

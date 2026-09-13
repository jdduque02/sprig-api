import { Injectable, Logger } from '@nestjs/common';
import { CategoryBudgetRepository } from '@finance/repositories/category-budget.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CreateCategoryBudgetDto } from '@finance/dto/category-budget/create-category-budget.dto';
import { UpdateCategoryBudgetDto } from '@finance/dto/category-budget/update-category-budget.dto';
import { CategoryBudgetQueryDto } from '@finance/dto/category-budget/category-budget-query.dto';
import { CategoryBudgetResponseDto } from '@finance/dto/category-budget/category-budget-response.dto';
import { CategoryBudget } from '@finance/entities/category-budget.entity';
import { CategoryService } from '@catalog/service/category.service';
import { SubcategoryService } from '@catalog/service/subcategory.service';
import { daysInMonth } from '@finance/service/fixed-reminder.scheduler';

const DAY_MS = 24 * 60 * 60 * 1000;
// Reactivar `SummaryCategoryBreakdown` (intelligence, huérfana/sin dueño
// claro) habría acoplado `finance` a otro módulo solo para una lectura;
// el % de uso se calcula aquí directamente sobre `transaction_record`
// (dueño de finance), reutilizando `getExpenseTotalByCategory`.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function periodDateRange(
  year: number,
  month: number,
): {
  dateFrom: string;
  dateTo: string;
} {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFrom = `${year}-${pad(month)}-01`;
  const dateTo = `${year}-${pad(month)}-${pad(daysInMonth(year, month - 1))}`;
  return { dateFrom, dateTo };
}

export function budgetStatus(
  percentUsed: number,
  thresholdPercent: number,
): 'ok' | 'warning' | 'exceeded' {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= thresholdPercent) return 'warning';
  return 'ok';
}

@Injectable()
export class CategoryBudgetService {
  private readonly logger = new Logger(CategoryBudgetService.name);

  constructor(
    private readonly categoryBudgetRepository: CategoryBudgetRepository,
    private readonly transactionRecordRepository: TransactionRecordRepository,
    private readonly categoryService: CategoryService,
    private readonly subcategoryService: SubcategoryService,
  ) {}

  async create(
    userId: number,
    dto: CreateCategoryBudgetDto,
  ): Promise<CategoryBudgetResponseDto> {
    await this.categoryService.findOne(dto.category_id);
    if (dto.subcategory_id != null) {
      await this.subcategoryService.findOne(dto.subcategory_id, userId);
    }
    const created = await this.categoryBudgetRepository.create(userId, dto);
    return this.toResponseDto(userId, created);
  }

  async findAll(
    userId: number,
    query: CategoryBudgetQueryDto,
  ): Promise<CategoryBudgetResponseDto[]> {
    const budgets = await this.categoryBudgetRepository.findAll(userId, query);
    return Promise.all(budgets.map((b) => this.toResponseDto(userId, b)));
  }

  async findOne(
    id: number,
    userId: number,
  ): Promise<CategoryBudgetResponseDto> {
    const budget = await this.categoryBudgetRepository.findById(id, userId);
    return this.toResponseDto(userId, budget);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateCategoryBudgetDto,
  ): Promise<CategoryBudgetResponseDto> {
    if (dto.category_id != null) {
      await this.categoryService.findOne(dto.category_id);
    }
    if (dto.subcategory_id != null) {
      await this.subcategoryService.findOne(dto.subcategory_id, userId);
    }
    const updated = await this.categoryBudgetRepository.update(id, userId, dto);
    return this.toResponseDto(userId, updated);
  }

  async remove(id: number, userId: number): Promise<void> {
    return this.categoryBudgetRepository.softDelete(id, userId);
  }

  /**
   * Gasto acumulado en la categoría/periodo del presupuesto, filtrando
   * `transaction_record` por `created_at` (partition pruning) además de
   * `transaction_date`. Piso de `created_at` amplio (400 días) para no
   * excluir movimientos importados/registrados con retraso.
   */
  private async computeUsage(
    userId: number,
    budget: CategoryBudget,
  ): Promise<{
    spent: number;
    percent: number;
    status: 'ok' | 'warning' | 'exceeded';
  }> {
    const { dateFrom, dateTo } = periodDateRange(budget.year, budget.month);
    const createdSince = new Date(new Date(dateFrom).getTime() - 400 * DAY_MS);
    const spent =
      await this.transactionRecordRepository.getExpenseTotalByCategory(
        userId,
        budget.category_id,
        budget.subcategory_id,
        dateFrom,
        dateTo,
        createdSince,
      );
    const limit = Number(budget.limit_amount ?? 0);
    const percent = limit > 0 ? round2((spent / limit) * 100) : 0;
    const status = budgetStatus(
      percent,
      Number(budget.alert_threshold_percent ?? 80),
    );
    return { spent: round2(spent), percent, status };
  }

  private async toResponseDto(
    userId: number,
    budget: CategoryBudget,
  ): Promise<CategoryBudgetResponseDto> {
    const usage = await this.computeUsage(userId, budget);
    return {
      id: budget.id,
      user_id: budget.user_id,
      category_id: budget.category_id,
      subcategory_id: budget.subcategory_id,
      year: budget.year,
      month: budget.month,
      limit_amount: Number(budget.limit_amount),
      currency: budget.currency,
      alert_threshold_percent: Number(budget.alert_threshold_percent),
      is_active: budget.is_active,
      spent_amount: usage.spent,
      percent_used: usage.percent,
      status: usage.status,
      created_at: budget.created_at,
      updated_at: budget.updated_at ?? null,
    };
  }
}

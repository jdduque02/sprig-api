import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CategoryBudgetRepository } from '@finance/repositories/category-budget.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CategoryBudget } from '@finance/entities/category-budget.entity';
import { NotificationService } from '@notification/service/notification.service';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { todayInTimeZone } from '@shared/helpers/financial-objective.helper';
import {
  periodDateRange,
  budgetStatus,
} from '@finance/service/category-budget.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Alertas de presupuesto por categoría: revisa periódicamente los
 * presupuestos activos del periodo (año/mes) vigente en la zona horaria de
 * cada usuario y, si el gasto acumulado se acerca (>= alert_threshold_percent)
 * o supera (>= 100%) el límite, crea una notificación. Sigue el mismo patrón
 * de dedup por `reference` único que `FixedReminderScheduler`
 * (`createIfMissing`), para no repetir la misma alerta en cada corrida.
 */
@Injectable()
export class CategoryBudgetScheduler {
  private readonly logger = new Logger(CategoryBudgetScheduler.name);

  constructor(
    private readonly categoryBudgetRepository: CategoryBudgetRepository,
    private readonly transactionRecordRepository: TransactionRecordRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'category-budget-alerts' })
  async handleBudgetAlerts(): Promise<void> {
    let budgets: CategoryBudget[];
    try {
      budgets = await this.categoryBudgetRepository.findAllActive();
    } catch (error) {
      this.logger.error(
        'Error al consultar presupuestos activos para alertas',
        error,
      );
      return;
    }

    const timezoneCache = new Map<number, string>();
    for (const budget of budgets) {
      const timezone = await this.resolveTimezone(
        budget.user_id,
        timezoneCache,
      );
      const today = todayInTimeZone(timezone);
      const [year, month] = today.split('-').map(Number);
      if (budget.year !== year || budget.month !== month) continue;

      try {
        await this.evaluateBudget(budget);
      } catch (error) {
        this.logger.warn(
          `No se pudo evaluar el presupuesto ID ${budget.id}`,
          error,
        );
      }
    }

    this.logger.log(
      `Alertas de presupuesto evaluadas para ${budgets.length} presupuestos activos.`,
    );
  }

  private async resolveTimezone(
    userId: number,
    cache: Map<number, string>,
  ): Promise<string> {
    const cached = cache.get(userId);
    if (cached) return cached;
    let timezone = 'America/Bogota';
    try {
      const user = await this.userRepository.findById(String(userId));
      timezone = user.timezone || 'America/Bogota';
    } catch {
      this.logger.debug(
        `Usuario ${userId} no encontrado; se usa zona horaria por defecto.`,
      );
    }
    cache.set(userId, timezone);
    return timezone;
  }

  private async evaluateBudget(budget: CategoryBudget): Promise<void> {
    const { dateFrom, dateTo } = periodDateRange(budget.year, budget.month);
    const createdSince = new Date(new Date(dateFrom).getTime() - 400 * DAY_MS);

    const spent =
      await this.transactionRecordRepository.getExpenseTotalByCategory(
        budget.user_id,
        budget.category_id,
        budget.subcategory_id,
        dateFrom,
        dateTo,
        createdSince,
      );
    const limit = Number(budget.limit_amount ?? 0);
    if (limit <= 0) return;
    const percent = Math.round((spent / limit) * 10000) / 100;
    const threshold = Number(budget.alert_threshold_percent ?? 80);
    const status = budgetStatus(percent, threshold);
    if (status === 'ok') return;

    const period = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    const reference = `budget:alert:${budget.id}:${period}:${status}`;
    const { title, description } = this.buildMessage(budget, percent, status);

    await this.notificationService.createIfMissing(
      budget.user_id,
      { title, description },
      reference,
    );
  }

  private buildMessage(
    budget: CategoryBudget,
    percent: number,
    status: 'warning' | 'exceeded',
  ): { title: string; description: string } {
    const formattedPercent = percent.toFixed(0);
    const limit = Number(budget.limit_amount ?? 0).toLocaleString('es-CO', {
      maximumFractionDigits: 0,
    });
    if (status === 'exceeded') {
      return {
        title: 'Presupuesto superado',
        description:
          `Superaste el presupuesto de la categoría (${formattedPercent}% de $${limit}) ` +
          `en ${budget.year}-${String(budget.month).padStart(2, '0')}.`,
      };
    }
    return {
      title: 'Presupuesto por agotarse',
      description:
        `Vas en ${formattedPercent}% de tu presupuesto de $${limit} para la ` +
        `categoría en ${budget.year}-${String(budget.month).padStart(2, '0')}.`,
    };
  }
}

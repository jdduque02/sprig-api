import { Injectable } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { FinancialAiAnalysisService } from '@intelligence/service/financial-ai-analysis.service';
import { resolvePeriodDateRange } from '@intelligence/util/period-range.util';
import {
  CategoryYearlyReviewRow,
  FinancialProfileReportDocument,
} from '@intelligence/templates/financial-profile-report.template';
import { FinancialPeriodService } from '@finance/service/financial-period.service';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { FinancialObjectiveService } from '@finance/service/financial-objective.service';
import { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import { BankAccountService } from '@banking/service/bank-account.service';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { FinancialProfileService } from '@identity/service/financial-profile.service';
import { UserService } from '@identity/service/user.service';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { CategoryService } from '@catalog/service/category.service';
import { Category } from '@catalog/entities/category.entity';
import { ProfileBucketEnum, TransactionTypeEnum } from '@shared/enums';
import { todayInTimeZone } from '@shared/helpers/financial-objective.helper';

const RECENT_DAYS = 30;
// Umbral del heurístico de "categoría a revisar": no especificado por el
// usuario. Se marca una categoría de gasto discrecional (bucket "wants" o
// sin clasificar en el catálogo) cuando concentra >=10% del gasto anual.
const REVIEW_SHARE_THRESHOLD_PERCENT = 10;
const MAX_RECENT_TRANSACTIONS = 500; // tope real de TransactionRecordRepository.findAll

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Ancla el cálculo en la fecha del usuario (ya resuelta vía todayInTimeZone,
// mismo patrón que FinancialPeriodService.findOrCreateCurrent) y hace la
// aritmética en UTC para no depender de la zona horaria del proceso Node.
function isoDateNDaysBefore(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDateOneYearBefore(todayIso: string): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class FinancialProfileReportService {
  constructor(
    private readonly financialAiAnalysisService: FinancialAiAnalysisService,
    private readonly financialPeriodService: FinancialPeriodService,
    private readonly transactionRecordService: TransactionRecordService,
    private readonly financialObjectiveService: FinancialObjectiveService,
    private readonly bankAccountService: BankAccountService,
    private readonly financialAssetService: FinancialAssetService,
    private readonly financialLiabilityService: FinancialLiabilityService,
    private readonly financialProfileService: FinancialProfileService,
    private readonly userService: UserService,
    private readonly categoryService: CategoryService,
  ) {}

  async generate(
    userId: number,
    options?: { periodId?: number },
  ): Promise<Buffer> {
    // Se resuelven primero (el período y el usuario) porque el resto de
    // consultas depende de su resultado: el rango de fechas de "últimos 30
    // días"/"último año" debe anclarse en el día de hoy EN LA ZONA HORARIA
    // DEL USUARIO, no en la del proceso Node/servidor.
    const [period, user] = await Promise.all([
      options?.periodId
        ? this.financialPeriodService.findOne(options.periodId, userId)
        : this.financialPeriodService.findOrCreateCurrent(userId),
      this.userService.findUser(String(userId)) as Promise<UserResponseDto>,
    ]);

    const { date_from, date_to } = resolvePeriodDateRange(
      period.year,
      period.month,
    );
    const today = todayInTimeZone(user.timezone || 'America/Bogota');

    const [
      analysis,
      profile,
      accounts,
      assets,
      liabilities,
      objectives,
      txSummary,
      yearlySummary,
      recentTransactions,
      categories,
    ] = await Promise.all([
      this.financialAiAnalysisService.analyze(userId, { periodId: period.id }),
      this.financialProfileService.findByUserId(String(userId)),
      this.bankAccountService.findAll(userId),
      this.financialAssetService.findAll(userId),
      this.financialLiabilityService.findAll(userId),
      this.financialObjectiveService.findAll(userId),
      this.transactionRecordService.getSummary(userId, {
        date_from,
        date_to,
        group_by: 'month',
      }) as Promise<TransactionSummaryResponseDto>,
      this.transactionRecordService.getSummary(userId, {
        date_from: isoDateOneYearBefore(today),
        date_to: today,
        group_by: 'month',
      }) as Promise<TransactionSummaryResponseDto>,
      this.transactionRecordService.findAll(userId, {
        date_from: isoDateNDaysBefore(today, RECENT_DAYS - 1),
        date_to: today,
        page: 1,
        limit: MAX_RECENT_TRANSACTIONS,
      }),
      this.categoryService.findAll(),
    ]);

    const categoryById = new Map<number, Category>(
      categories.map((c) => [c.id, c]),
    );

    // Las transferencias entre cuentas propias del usuario no son ni ingreso
    // ni gasto real (igual que ya las excluye TransactionRecordRepository al
    // agregar por categoría) — se excluyen también del listado de
    // movimientos recientes para no mezclarlas con gasto/ingreso real.
    const recentNonTransferTransactions = recentTransactions.data.filter(
      (tx) => tx.type !== TransactionTypeEnum.TRANSFER,
    );

    return renderToBuffer(
      <FinancialProfileReportDocument
        user={user}
        profile={profile}
        analysis={analysis}
        accounts={accounts}
        assets={assets}
        liabilities={liabilities}
        activeObjectives={objectives.filter((o) => !o.is_completed)}
        byCategory={txSummary.by_category}
        categoryById={categoryById}
        yearlyCategoryReview={this.buildYearlyCategoryReview(
          yearlySummary.by_category,
          categoryById,
        )}
        recentTransactions={recentNonTransferTransactions}
        recentTransactionsTruncated={
          recentTransactions.total > MAX_RECENT_TRANSACTIONS
        }
        generatedAt={new Date()}
      />,
    );
  }

  /**
   * Consolidado anual por categoría con una recomendación heurística de
   * cuáles vale la pena revisar: categorías discrecionales (bucket "wants"
   * o sin clasificar en el catálogo) que concentran una porción alta del
   * gasto anual. Las categorías "needs"/"savings"/"investment"/"debt" no se
   * marcan, aunque tengan un gasto alto, porque no son tan discrecionales.
   */
  private buildYearlyCategoryReview(
    byCategory: { category_id: number; expenses: number; count: number }[],
    categoryById: Map<number, Category>,
  ): CategoryYearlyReviewRow[] {
    const totalExpenses = byCategory.reduce(
      (sum, c) => sum + Number(c.expenses ?? 0),
      0,
    );

    return [...byCategory]
      .sort((a, b) => Number(b.expenses) - Number(a.expenses))
      .map((c) => {
        const category = categoryById.get(c.category_id);
        const sharePercent =
          totalExpenses > 0
            ? round2((Number(c.expenses) / totalExpenses) * 100)
            : 0;
        const isDiscretionary =
          !category?.profile_bucket ||
          category.profile_bucket === ProfileBucketEnum.WANTS;
        return {
          category_id: c.category_id,
          name: category?.name ?? 'Sin categoría',
          expenses: Number(c.expenses),
          count: c.count,
          sharePercent,
          shouldReview:
            isDiscretionary && sharePercent >= REVIEW_SHARE_THRESHOLD_PERCENT,
        };
      });
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';
import { UpdateTaxSummaryDto } from '@intelligence/dto/update-tax-summary.dto';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { BankAccountService } from '@banking/service/bank-account.service';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import { TransactionTypeEnum } from '@shared/enums';

interface TaxSummaryValidation {
  is_valid: boolean;
  warnings: string[];
  missing_data: string[];
  notes: Record<string, unknown>;
}

const CURRENT_UVT_2026 = 42680; // UVT 2026 (Colombia) - ajustar anualmente
const UVT_DECLARATION_THRESHOLD = 1400; // En UVT: si ingreso > 1400 UVT, debe declarar
const PATRIMONY_DECLARATION_THRESHOLD = 4750; // En UVT: si patrimonio > 4750 UVT, debe declarar

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class TaxSummaryCalculatorService {
  private readonly logger = new Logger(TaxSummaryCalculatorService.name);

  constructor(
    @InjectRepository(TaxSummary)
    private readonly taxSummaryRepo: Repository<TaxSummary>,
    private readonly transactionRecordService: TransactionRecordService,
    private readonly bankAccountService: BankAccountService,
    private readonly financialAssetService: FinancialAssetService,
    private readonly financialLiabilityService: FinancialLiabilityService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  /**
   * Calcula y persiste un resumen fiscal basado en datos operativos del usuario.
   * Si ya existe para el año, verifica que no esté bloqueado como final.
   */
  async calculateAndPersist(
    userId: number,
    fiscalYear: number,
    uvtValue?: number,
  ): Promise<TaxSummary> {
    const year = fiscalYear ?? new Date().getFullYear();
    const uvt = uvtValue ?? CURRENT_UVT_2026;

    // Verificar si ya existe
    const existing = await this.taxSummaryRepo.findOne({
      where: { user_id: userId, fiscal_year: year },
    });
    if (existing) {
      throw new ConflictException(
        this.i18n.t('intelligence.TAX_SUMMARY_ALREADY_EXISTS', {
          args: { year },
        }),
      );
    }

    // Resolver datos operativos en paralelo
    const [incomeData, assetsData, liabilitiesData] = await Promise.all([
      this.resolveIncome(userId, year),
      this.resolveAssets(userId),
      this.resolveLiabilities(userId),
    ]);

    const validation = this.validateTaxData(
      incomeData,
      assetsData,
      liabilitiesData,
      uvt,
    );

    const totalIncome = incomeData.total;
    const totalAssets = assetsData.total;
    const totalLiabilities = liabilitiesData.total;
    const patrimony = totalAssets - totalLiabilities;

    // Cálculos en UVT
    const incomeInUvt = round2(totalIncome / uvt);
    const assetsInUvt = round2(totalAssets / uvt);

    // Determinar obligación de declarar según normas DIAN
    const mustDeclare =
      incomeInUvt >= UVT_DECLARATION_THRESHOLD ||
      assetsInUvt >= PATRIMONY_DECLARATION_THRESHOLD;

    const summary = this.taxSummaryRepo.create({
      user_id: userId,
      fiscal_year: year,
      total_income: round2(totalIncome),
      total_assets: round2(totalAssets),
      total_liabilities: round2(totalLiabilities),
      // patrimony, income_in_uvt, assets_in_uvt se calculan en BD
      uvt_value: uvt,
      must_declare: mustDeclare,
      calculation_notes: {
        calculated_at: new Date().toISOString(),
        validation,
        income_sources: incomeData.details,
        assets_breakdown: assetsData.details,
        liabilities_breakdown: liabilitiesData.details,
      },
    });

    this.logger.debug(
      `Persisting tax summary for user ${userId}, year ${year}`,
      { validation },
    );

    return this.taxSummaryRepo.save(summary);
  }

  /**
   * Edita/ajusta manualmente un resumen fiscal existente del usuario.
   * Recalcula must_declare con los umbrales DIAN sobre los valores resultantes,
   * salvo que el DTO lo fuerce explícitamente.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateTaxSummaryDto,
  ): Promise<TaxSummary> {
    const existing = await this.taxSummaryRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('intelligence.TAX_SUMMARY_ID_NOT_FOUND', {
          args: { id },
        }),
      );
    }

    // Postgres numeric llega como string vía pg/TypeORM: castear antes de operar.
    const totalIncome = Number(dto.total_income ?? existing.total_income);
    const totalAssets = Number(dto.total_assets ?? existing.total_assets);
    const uvt = Number(dto.uvt_value ?? existing.uvt_value);

    const incomeInUvt = uvt ? round2(totalIncome / uvt) : 0;
    const assetsInUvt = uvt ? round2(totalAssets / uvt) : 0;

    const mustDeclare =
      dto.must_declare !== undefined
        ? dto.must_declare
        : incomeInUvt >= UVT_DECLARATION_THRESHOLD ||
          assetsInUvt >= PATRIMONY_DECLARATION_THRESHOLD;

    Object.assign(existing, dto, { must_declare: mustDeclare });

    this.logger.debug(`Updating tax summary ${id} for user ${userId}`);

    return this.taxSummaryRepo.save(existing);
  }

  /**
   * Valida qué datos disponibles se usaron y qué falta para un cálculo preciso.
   */
  private validateTaxData(
    income: { total: number; details: Record<string, unknown> },
    assets: { total: number; details: Record<string, unknown> },
    liabilities: { total: number; details: Record<string, unknown> },
    uvt: number,
  ): TaxSummaryValidation {
    const warnings: string[] = [];
    const missing: string[] = [];
    const notes: Record<string, unknown> = {};

    // Income validation
    if (income.total === 0) {
      warnings.push(
        'No se encontraron transacciones de ingreso en el período. Verifica que estén registradas en el sistema.',
      );
      notes.income_risk = 'MISSING_OR_ZERO';
    }
    if (!income.details || Object.keys(income.details).length === 0) {
      missing.push('Detalles de ingresos por fuente');
    }

    // Assets validation
    if (assets.total === 0) {
      warnings.push(
        'No hay activos registrados (cuentas, activos financieros). Solo se reportarán ingresos sin patrimonio.',
      );
      notes.assets_risk = 'MISSING_OR_ZERO';
    }
    if (!assets.details || Object.keys(assets.details).length === 0) {
      missing.push('Desglose de activos (cuentas bancarias, activos financieros)');
    }

    // Liabilities validation
    if (liabilities.total === 0) {
      notes.liabilities_note = 'No hay deudas registradas';
    }

    // UVT validation
    if (uvt === 0) {
      warnings.push('UVT no configurado. Se requiere valor UVT para cálculos.');
      missing.push('Valor UVT del año fiscal');
    }

    return {
      is_valid: missing.length === 0,
      warnings,
      missing_data: missing,
      notes,
    };
  }

  /**
   * Suma ingresos del usuario en el rango fiscal (enero-diciembre del año).
   */
  private async resolveIncome(
    userId: number,
    fiscalYear: number,
  ): Promise<{ total: number; details: Record<string, unknown> }> {
    try {
      const dateFrom = `${fiscalYear}-01-01`;
      const dateTo = `${fiscalYear}-12-31`;

      const summary = (await this.transactionRecordService.getSummary(userId, {
        date_from: dateFrom,
        date_to: dateTo,
        type: TransactionTypeEnum.INCOME,
      })) as TransactionSummaryResponseDto;

      const total = Number(summary.totals?.income ?? 0);
      return {
        total,
        details: {
          count: summary.totals?.count ?? 0,
          series: summary.series ?? [],
        },
      };
    } catch (error) {
      this.logger.warn(
        `Error fetching income summary for user ${userId}, year ${fiscalYear}`,
        error,
      );
      return { total: 0, details: {} };
    }
  }

  /**
   * Suma saldos de cuentas bancarias y activos financieros del usuario.
   */
  private async resolveAssets(userId: number): Promise<{
    total: number;
    details: Record<string, unknown>;
  }> {
    try {
      const [accounts, assets] = await Promise.all([
        this.bankAccountService.findAll(userId),
        this.financialAssetService.findAll(userId),
      ]);

      const accountsTotal = accounts.reduce(
        (sum, acc) => sum + Number(acc.display_balance ?? 0),
        0,
      );
      const assetsTotal = assets.reduce(
        (sum, asset) => sum + Number(asset.current_value ?? 0),
        0,
      );

      return {
        total: accountsTotal + assetsTotal,
        details: {
          bank_accounts: {
            count: accounts.length,
            total: round2(accountsTotal),
          },
          financial_assets: {
            count: assets.length,
            total: round2(assetsTotal),
          },
        },
      };
    } catch (error) {
      this.logger.warn(
        `Error fetching assets for user ${userId}`,
        error,
      );
      return { total: 0, details: {} };
    }
  }

  /**
   * Suma saldos de pasivos (deudas) del usuario.
   */
  private async resolveLiabilities(userId: number): Promise<{
    total: number;
    details: Record<string, unknown>;
  }> {
    try {
      const liabilities = await this.financialLiabilityService.findAll(userId);
      const total = liabilities.reduce(
        (sum, liability) => sum + Number(liability.current_balance ?? 0),
        0,
      );

      return {
        total,
        details: {
          count: liabilities.length,
          total: round2(total),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Error fetching liabilities for user ${userId}`,
        error,
      );
      return { total: 0, details: {} };
    }
  }
}

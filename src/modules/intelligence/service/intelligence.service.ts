import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository, IsNull } from 'typeorm';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';
import { FinancialSummaryResponseDto } from '@intelligence/dto/financial-summary-response.dto';
import { TaxSummaryResponseDto } from '@intelligence/dto/tax-summary-response.dto';
import { mapFinancialSummary } from '@intelligence/util/financial-summary-mapper.util';

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    @InjectRepository(FinancialSummary)
    private readonly financialSummaryRepo: Repository<FinancialSummary>,
    @InjectRepository(TaxSummary)
    private readonly taxSummaryRepo: Repository<TaxSummary>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async findFinancialSummary(
    userId: number,
  ): Promise<FinancialSummaryResponseDto> {
    const summary = await this.financialSummaryRepo.findOne({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { calculated_at: 'DESC' },
    });
    if (!summary) {
      throw new NotFoundException(
        this.i18n.t('intelligence.FINANCIAL_SUMMARY_NOT_FOUND', {
          args: { userId },
        }),
      );
    }
    return mapFinancialSummary(summary);
  }

  async findFinancialSummaryByPeriod(
    userId: number,
    periodId: number,
  ): Promise<FinancialSummaryResponseDto> {
    const summary = await this.financialSummaryRepo.findOne({
      where: {
        user_id: userId,
        financial_period_id: periodId,
        deleted_at: IsNull(),
      },
    });
    if (!summary) {
      throw new NotFoundException(
        this.i18n.t('intelligence.FINANCIAL_SUMMARY_PERIOD_NOT_FOUND', {
          args: { periodId },
        }),
      );
    }
    return mapFinancialSummary(summary);
  }

  async findTaxSummary(
    userId: number,
    fiscalYear?: number,
  ): Promise<TaxSummaryResponseDto> {
    const year = fiscalYear ?? new Date().getFullYear();
    const summary = await this.taxSummaryRepo.findOne({
      where: { user_id: userId, fiscal_year: year },
      order: { created_at: 'DESC' },
    });
    if (!summary) {
      throw new NotFoundException(
        this.i18n.t('intelligence.TAX_SUMMARY_NOT_FOUND', { args: { year } }),
      );
    }
    return this.mapTaxSummary(summary);
  }

  private mapTaxSummary(entity: TaxSummary): TaxSummaryResponseDto {
    return {
      id: entity.id,
      user_id: entity.user_id,
      fiscal_year: entity.fiscal_year,
      total_income: entity.total_income,
      total_assets: entity.total_assets,
      total_liabilities: entity.total_liabilities,
      patrimony: entity.patrimony,
      income_in_uvt: entity.income_in_uvt,
      assets_in_uvt: entity.assets_in_uvt,
      uvt_value: entity.uvt_value,
      must_declare: entity.must_declare,
      estimated_tax: entity.estimated_tax,
      created_at: entity.created_at,
    };
  }
}

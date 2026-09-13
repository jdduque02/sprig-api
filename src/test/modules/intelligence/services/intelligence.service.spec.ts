import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { IntelligenceService } from '@intelligence/service/intelligence.service';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';

const buildFinancialSummary = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    financial_period_id: 5,
    total_income: 5000,
    total_expense: 3000,
    total_debt: 1000,
    net_worth: 4000,
    expense_ratio: 0.6,
    debt_ratio: 0.2,
    savings_rate: 0.4,
    recommended_max_expense: 3500,
    recommended_savings: 1500,
    is_over_spending: false,
    is_over_indebted: false,
    insights: [],
    calculated_at: new Date(),
    is_final: false,
    ...overrides,
  }) as FinancialSummary;

const buildTaxSummary = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    fiscal_year: 2025,
    total_income: 80000000,
    total_assets: 200000000,
    total_liabilities: 50000000,
    patrimony: 150000000,
    income_in_uvt: 100,
    assets_in_uvt: 250,
    uvt_value: 40000,
    must_declare: true,
    estimated_tax: 1000000,
    created_at: new Date(),
    ...overrides,
  }) as TaxSummary;

const mockI18n = { t: jest.fn((key: string) => key) };

describe('IntelligenceService', () => {
  let service: IntelligenceService;
  const financialSummaryRepo = {
    findOne: jest.fn(),
  };
  const taxSummaryRepo = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntelligenceService(
      financialSummaryRepo as never,
      taxSummaryRepo as never,
      mockI18n as unknown as I18nService,
    );
  });

  describe('findFinancialSummary', () => {
    it('retorna el resumen mapeado', async () => {
      financialSummaryRepo.findOne.mockResolvedValue(buildFinancialSummary());
      const result = await service.findFinancialSummary(10);
      expect(result).toMatchObject({
        id: 1,
        user_id: 10,
        total_income: 5000,
      });
    });

    it('lanza NotFoundException si no hay resumen', async () => {
      financialSummaryRepo.findOne.mockResolvedValue(null);
      await expect(service.findFinancialSummary(10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findFinancialSummaryByPeriod', () => {
    it('retorna el resumen del período', async () => {
      financialSummaryRepo.findOne.mockResolvedValue(buildFinancialSummary());
      const result = await service.findFinancialSummaryByPeriod(10, 5);
      expect(result.financial_period_id).toBe(5);
    });

    it('lanza NotFoundException si no existe', async () => {
      financialSummaryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findFinancialSummaryByPeriod(10, 99),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findTaxSummary', () => {
    it('usa el año actual por defecto', async () => {
      taxSummaryRepo.findOne.mockResolvedValue(buildTaxSummary());
      const result = await service.findTaxSummary(10);
      expect(result.fiscal_year).toBe(2025);
    });

    it('usa el año fiscal provisto', async () => {
      taxSummaryRepo.findOne.mockResolvedValue(
        buildTaxSummary({ fiscal_year: 2024 }),
      );
      const result = await service.findTaxSummary(10, 2024);
      expect(result.fiscal_year).toBe(2024);
    });

    it('lanza NotFoundException si no existe', async () => {
      taxSummaryRepo.findOne.mockResolvedValue(null);
      await expect(service.findTaxSummary(10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

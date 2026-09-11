import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { TaxSummaryCalculatorService } from '@intelligence/service/tax-summary-calculator.service';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';

const mockTaxSummary = (overrides = {}): TaxSummary => ({
  id: 1,
  user_id: 10,
  fiscal_year: 2026,
  total_income: 72000000,
  total_assets: 200000000,
  total_liabilities: 50000000,
  patrimony: 150000000,
  income_in_uvt: 1686.92,
  assets_in_uvt: 4684.05,
  uvt_value: 42680,
  must_declare: true,
  estimated_tax: 5000000,
  calculation_notes: {},
  created_at: new Date(),
  ...overrides,
});

describe('TaxSummaryCalculatorService', () => {
  let service: TaxSummaryCalculatorService;

  const mockTaxSummaryRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTransactionRecordService = {
    getSummary: jest.fn(),
  };

  const mockBankAccountService = {
    findAll: jest.fn(),
  };

  const mockFinancialAssetService = {
    findAll: jest.fn(),
  };

  const mockFinancialLiabilityService = {
    findAll: jest.fn(),
  };

  const mockI18n = { t: jest.fn((key: string) => key) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaxSummaryCalculatorService(
      mockTaxSummaryRepo as never,
      mockTransactionRecordService as never,
      mockBankAccountService as never,
      mockFinancialAssetService as never,
      mockFinancialLiabilityService as never,
      mockI18n as unknown as I18nService,
    );
  });

  describe('calculateAndPersist', () => {
    it('should calculate and persist a tax summary with valid data', async () => {
      const userId = 10;
      const fiscalYear = 2026;

      // Mock operativo data
      mockTransactionRecordService.getSummary.mockResolvedValue({
        totals: { income: 72000000, count_income: 42 },
        by_month: {},
      });

      mockBankAccountService.findAll.mockResolvedValue([
        { display_balance: 50000000 },
        { display_balance: 25000000 },
      ]);

      mockFinancialAssetService.findAll.mockResolvedValue([
        { current_value: 100000000 },
        { current_value: 25000000 },
      ]);

      mockFinancialLiabilityService.findAll.mockResolvedValue([
        { current_balance: 30000000 },
        { current_balance: 20000000 },
      ]);

      mockTaxSummaryRepo.findOne.mockResolvedValue(null);
      mockTaxSummaryRepo.create.mockReturnValue(
        mockTaxSummary({ user_id: userId, fiscal_year: fiscalYear }),
      );
      mockTaxSummaryRepo.save.mockResolvedValue(
        mockTaxSummary({ user_id: userId, fiscal_year: fiscalYear }),
      );

      const result = await service.calculateAndPersist(userId, fiscalYear);

      expect(result.user_id).toBe(userId);
      expect(result.fiscal_year).toBe(fiscalYear);
      expect(result.total_income).toBe(72000000);
      expect(result.total_assets).toBe(200000000); // 50M + 25M + 100M + 25M
      expect(result.total_liabilities).toBe(50000000); // 30M + 20M
      expect(result.must_declare).toBe(true); // income_in_uvt >= 1400
      expect(mockTaxSummaryRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if tax summary already exists', async () => {
      const userId = 10;
      const fiscalYear = 2026;

      mockTaxSummaryRepo.findOne.mockResolvedValue(mockTaxSummary());

      await expect(
        service.calculateAndPersist(userId, fiscalYear),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate missing data and include warnings', async () => {
      const userId = 10;
      const fiscalYear = 2026;

      // No transactions
      mockTransactionRecordService.getSummary.mockResolvedValue({
        totals: { income: 0, count_income: 0 },
        by_month: {},
      });

      mockBankAccountService.findAll.mockResolvedValue([]);
      mockFinancialAssetService.findAll.mockResolvedValue([]);
      mockFinancialLiabilityService.findAll.mockResolvedValue([]);

      mockTaxSummaryRepo.findOne.mockResolvedValue(null);
      const createdSummary = mockTaxSummary({
        total_income: 0,
        total_assets: 0,
        total_liabilities: 0,
        must_declare: false,
      });
      mockTaxSummaryRepo.create.mockReturnValue(createdSummary);
      mockTaxSummaryRepo.save.mockResolvedValue(createdSummary);

      const result = await service.calculateAndPersist(userId, fiscalYear);

      const notes = result.calculation_notes;
      const validation = notes.validation as Record<string, unknown>;

      expect(validation.is_valid).toBe(false);
      expect((validation.warnings as string[]).length).toBeGreaterThan(0);
      expect((validation.missing_data as string[]).length).toBeGreaterThan(0);
    });

    it('should use provided UVT value or default to CURRENT_UVT_2026', async () => {
      const userId = 10;
      const fiscalYear = 2026;
      const customUVT = 50000;

      mockTransactionRecordService.getSummary.mockResolvedValue({
        totals: { income: 50000000, count_income: 10 },
        by_month: {},
      });

      mockBankAccountService.findAll.mockResolvedValue([]);
      mockFinancialAssetService.findAll.mockResolvedValue([]);
      mockFinancialLiabilityService.findAll.mockResolvedValue([]);

      mockTaxSummaryRepo.findOne.mockResolvedValue(null);
      const createdSummary = mockTaxSummary({
        total_income: 50000000,
        uvt_value: customUVT,
      });
      mockTaxSummaryRepo.create.mockReturnValue(createdSummary);
      mockTaxSummaryRepo.save.mockResolvedValue(createdSummary);

      const result = await service.calculateAndPersist(
        userId,
        fiscalYear,
        customUVT,
      );

      expect(result.uvt_value).toBe(customUVT);
    });

    it('should determine must_declare based on UVT thresholds', async () => {
      const userId = 10;
      const fiscalYear = 2026;
      const uvt = 42680;
      // income > 1400 UVT = must_declare
      const incomeAboveThreshold = 1400 * uvt + 1000000; // 59652000

      mockTransactionRecordService.getSummary.mockResolvedValue({
        totals: { income: incomeAboveThreshold, count_income: 20 },
        by_month: {},
      });

      mockBankAccountService.findAll.mockResolvedValue([]);
      mockFinancialAssetService.findAll.mockResolvedValue([]);
      mockFinancialLiabilityService.findAll.mockResolvedValue([]);

      mockTaxSummaryRepo.findOne.mockResolvedValue(null);
      const createdSummary = mockTaxSummary({
        total_income: incomeAboveThreshold,
        must_declare: true,
      });
      mockTaxSummaryRepo.create.mockReturnValue(createdSummary);
      mockTaxSummaryRepo.save.mockResolvedValue(createdSummary);

      const result = await service.calculateAndPersist(userId, fiscalYear, uvt);

      expect(result.must_declare).toBe(true);
    });

    it('should handle errors gracefully and continue calculation', async () => {
      const userId = 10;
      const fiscalYear = 2026;

      // Simular error al obtener transacciones
      mockTransactionRecordService.getSummary.mockRejectedValue(
        new Error('DB connection error'),
      );

      mockBankAccountService.findAll.mockResolvedValue([]);
      mockFinancialAssetService.findAll.mockResolvedValue([]);
      mockFinancialLiabilityService.findAll.mockResolvedValue([]);

      mockTaxSummaryRepo.findOne.mockResolvedValue(null);
      const createdSummary = mockTaxSummary({
        total_income: 0,
        total_assets: 0,
      });
      mockTaxSummaryRepo.create.mockReturnValue(createdSummary);
      mockTaxSummaryRepo.save.mockResolvedValue(createdSummary);

      const result = await service.calculateAndPersist(userId, fiscalYear);

      expect(result.total_income).toBe(0);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if tax summary does not exist', async () => {
      mockTaxSummaryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(10, 999, { total_income: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update fields and recalculate must_declare with DIAN thresholds', async () => {
      const userId = 10;
      const id = 1;
      const existing = mockTaxSummary({
        user_id: userId,
        total_income: 10000000,
        total_assets: 5000000,
        uvt_value: 42680,
        must_declare: false,
      });

      mockTaxSummaryRepo.findOne.mockResolvedValue(existing);
      mockTaxSummaryRepo.save.mockImplementation((entity: TaxSummary) =>
        Promise.resolve(entity),
      );

      const incomeAboveThreshold = 1400 * 42680 + 1000000;
      const result = await service.update(userId, id, {
        total_income: incomeAboveThreshold,
      });

      expect(result.total_income).toBe(incomeAboveThreshold);
      expect(result.must_declare).toBe(true);
      expect(mockTaxSummaryRepo.save).toHaveBeenCalled();
    });

    it('should respect an explicit must_declare override', async () => {
      const existing = mockTaxSummary({
        user_id: 10,
        total_income: 0,
        total_assets: 0,
        uvt_value: 42680,
        must_declare: false,
      });

      mockTaxSummaryRepo.findOne.mockResolvedValue(existing);
      mockTaxSummaryRepo.save.mockImplementation((entity: TaxSummary) =>
        Promise.resolve(entity),
      );

      const result = await service.update(10, 1, { must_declare: true });

      expect(result.must_declare).toBe(true);
    });

    it('should not divide by zero when uvt_value is 0', async () => {
      const existing = mockTaxSummary({
        user_id: 10,
        total_income: 10000000,
        total_assets: 5000000,
        uvt_value: 0,
        must_declare: false,
      });

      mockTaxSummaryRepo.findOne.mockResolvedValue(existing);
      mockTaxSummaryRepo.save.mockImplementation((entity: TaxSummary) =>
        Promise.resolve(entity),
      );

      const result = await service.update(10, 1, { uvt_value: 0 });

      expect(result.must_declare).toBe(false);
    });

    it('should handle numeric columns returned as strings by the DB driver', async () => {
      // Postgres numeric llega como string vía pg/TypeORM (ej. "0.00").
      const existing = mockTaxSummary({
        user_id: 10,
        total_income: '10000000.00' as unknown as number,
        total_assets: '5000000.00' as unknown as number,
        uvt_value: '0.00' as unknown as number,
        must_declare: true,
      });

      mockTaxSummaryRepo.findOne.mockResolvedValue(existing);
      mockTaxSummaryRepo.save.mockImplementation((entity: TaxSummary) =>
        Promise.resolve(entity),
      );

      const result = await service.update(10, 1, {});

      expect(result.must_declare).toBe(false);
    });
  });
});

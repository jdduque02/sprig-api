import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterestAccrualScheduler } from '@banking/service/interest-accrual.scheduler';
import { InterestAccrualService } from '@banking/service/interest-accrual.service';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { EncryptionService } from '@shared/services/encryption.service';

const mockInterestAccrualService = {
  findEligibleAccounts: jest.fn(),
  calculateInterest: jest.fn(),
  updateAccountMetadata: jest.fn(),
};

const mockTransactionRecordRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockEncryptionService = {
  decryptField: jest.fn((v: string) => v),
};

const buildAccount = (overrides = {}): BankAccount =>
  ({
    id: 1,
    user_id: 10,
    bank_name: 'Bancolombia',
    currency: 'COP',
    ...overrides,
  }) as unknown as BankAccount;

describe('InterestAccrualScheduler', () => {
  let scheduler: InterestAccrualScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestAccrualScheduler,
        {
          provide: InterestAccrualService,
          useValue: mockInterestAccrualService,
        },
        {
          provide: getRepositoryToken(TransactionRecord),
          useValue: mockTransactionRecordRepo,
        },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    scheduler = module.get<InterestAccrualScheduler>(InterestAccrualScheduler);
    jest.clearAllMocks();
  });

  describe('handleDailyAccrual', () => {
    it('ejecuta la acumulación y registra el resultado', async () => {
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([]);
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await scheduler.handleDailyAccrual();

      expect(
        mockInterestAccrualService.findEligibleAccounts,
      ).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Interest accrual complete'),
      );
      logSpy.mockRestore();
    });
  });

  describe('triggerManual', () => {
    it('ejecuta la acumulación manual y retorna el resumen', async () => {
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([]);

      const result = await scheduler.triggerManual();

      expect(result).toEqual({ accrued: 0, skipped: 0, errors: 0 });
    });
  });

  describe('runAccrual (vía triggerManual)', () => {
    it('omite cuentas sin interés que calcular', async () => {
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([
        buildAccount(),
      ]);
      mockInterestAccrualService.calculateInterest.mockReturnValue(null);

      const result = await scheduler.triggerManual();

      expect(result).toEqual({ accrued: 0, skipped: 1, errors: 0 });
      expect(mockTransactionRecordRepo.save).not.toHaveBeenCalled();
    });

    it('acumula interés, crea la transacción de ingreso y actualiza la cuenta', async () => {
      const account = buildAccount();
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([
        account,
      ]);
      mockInterestAccrualService.calculateInterest.mockReturnValue({
        interest: 5000,
        periodStart: '2026-01-01',
        periodEnd: '2026-02-01',
      });
      mockTransactionRecordRepo.create.mockImplementation((e: unknown) => e);
      mockTransactionRecordRepo.save.mockResolvedValue({});
      mockInterestAccrualService.updateAccountMetadata.mockResolvedValue(
        undefined,
      );

      const result = await scheduler.triggerManual();

      expect(result).toEqual({ accrued: 1, skipped: 0, errors: 0 });
      expect(mockTransactionRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 10,
          amount: 5000,
          account_id: 1,
          source: 'system',
        }),
      );
      expect(mockTransactionRecordRepo.save).toHaveBeenCalled();
      expect(
        mockInterestAccrualService.updateAccountMetadata,
      ).toHaveBeenCalledWith(account, '2026-02-01');
    });

    it('usa COP como divisa por defecto si la cuenta no tiene una configurada', async () => {
      const account = buildAccount({ currency: undefined });
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([
        account,
      ]);
      mockInterestAccrualService.calculateInterest.mockReturnValue({
        interest: 1000,
        periodStart: '2026-01-01',
        periodEnd: '2026-02-01',
      });
      mockTransactionRecordRepo.create.mockImplementation((e: unknown) => e);
      mockTransactionRecordRepo.save.mockResolvedValue({});

      await scheduler.triggerManual();

      expect(mockTransactionRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'COP' }),
      );
    });

    it('cuenta el error y continúa si falla el procesamiento de una cuenta', async () => {
      const account = buildAccount();
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([
        account,
      ]);
      mockInterestAccrualService.calculateInterest.mockImplementation(() => {
        throw new Error('boom');
      });
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      const result = await scheduler.triggerManual();

      expect(result).toEqual({ accrued: 0, skipped: 0, errors: 1 });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error accruing interest'),
      );
      errorSpy.mockRestore();
    });

    it('procesa varias cuentas acumulando resultados', async () => {
      const accountA = buildAccount({ id: 1 });
      const accountB = buildAccount({ id: 2 });
      mockInterestAccrualService.findEligibleAccounts.mockResolvedValue([
        accountA,
        accountB,
      ]);
      mockInterestAccrualService.calculateInterest
        .mockReturnValueOnce({
          interest: 100,
          periodStart: '2026-01-01',
          periodEnd: '2026-02-01',
        })
        .mockReturnValueOnce(null);
      mockTransactionRecordRepo.create.mockImplementation((e: unknown) => e);
      mockTransactionRecordRepo.save.mockResolvedValue({});

      const result = await scheduler.triggerManual();

      expect(result).toEqual({ accrued: 1, skipped: 1, errors: 0 });
    });
  });
});

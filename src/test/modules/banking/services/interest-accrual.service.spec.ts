import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterestAccrualService } from '@banking/service/interest-accrual.service';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { EncryptionService } from '@shared/services/encryption.service';

const mockBankAccountRepo = {
  find: jest.fn(),
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
    annual_interest_rate: 12,
    rate_type: 'EA',
    yield_frequency: 'monthly',
    encrypted_balance: '1000000',
    last_interest_applied_at: null,
    interest_start_date: null,
    created_at: new Date('2026-01-01'),
    term_days: null,
    maturity_date: null,
    auto_renew: true,
    ...overrides,
  }) as unknown as BankAccount;

describe('InterestAccrualService', () => {
  let service: InterestAccrualService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestAccrualService,
        {
          provide: getRepositoryToken(BankAccount),
          useValue: mockBankAccountRepo,
        },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<InterestAccrualService>(InterestAccrualService);
    jest.clearAllMocks();
  });

  describe('findEligibleAccounts', () => {
    it('busca cuentas activas con interés habilitado', async () => {
      const accounts = [buildAccount()];
      mockBankAccountRepo.find.mockResolvedValue(accounts);

      const result = await service.findEligibleAccounts();

      const [callArg] = mockBankAccountRepo.find.mock.calls[0] as [
        { where: { interest_enabled: boolean } },
      ];
      expect(callArg.where.interest_enabled).toBe(true);
      expect(result).toEqual(accounts);
    });
  });

  describe('calculateInterest', () => {
    it('retorna null si no hay tasa configurada', () => {
      const account = buildAccount({ annual_interest_rate: null });
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });

    it('retorna null si la tasa es <= 0', () => {
      const account = buildAccount({ annual_interest_rate: 0 });
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });

    it('retorna null si el saldo descifrado es <= 0', () => {
      mockEncryptionService.decryptField.mockReturnValueOnce('0');
      const account = buildAccount();
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });

    it('retorna null si ya se aplicó interés hoy', () => {
      const account = buildAccount({ last_interest_applied_at: '2026-02-01' });
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });

    it('usa interest_start_date si no hay last_interest_applied_at', () => {
      const account = buildAccount({
        last_interest_applied_at: null,
        interest_start_date: '2025-12-01',
        yield_frequency: 'daily',
      });
      const result = service.calculateInterest(account, '2026-02-01');
      expect(result).not.toBeNull();
      expect(result?.periodStart).toBe('2025-12-01');
    });

    it('usa created_at si no hay last_interest_applied_at ni interest_start_date', () => {
      const account = buildAccount({
        last_interest_applied_at: null,
        interest_start_date: null,
        created_at: new Date('2025-12-01T00:00:00Z'),
        yield_frequency: 'daily',
      });
      const result = service.calculateInterest(account, '2026-02-01');
      expect(result).not.toBeNull();
      expect(result?.periodStart).toBe('2025-12-01');
    });

    it('usa hoy como fallback si no hay ninguna fecha de referencia', () => {
      const account = buildAccount({
        last_interest_applied_at: null,
        interest_start_date: null,
        created_at: undefined,
      });
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });

    describe('CDT (term_days + maturity_date)', () => {
      it('retorna null si aún no llega la fecha de vencimiento', () => {
        const account = buildAccount({
          term_days: 90,
          maturity_date: '2026-05-01',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });

      it('calcula el interés al vencimiento', () => {
        const account = buildAccount({
          term_days: 90,
          maturity_date: '2026-02-01',
          last_interest_applied_at: '2025-11-01',
        });
        const result = service.calculateInterest(account, '2026-02-01');
        expect(result).not.toBeNull();
        expect(result?.periodStart).toBe('2026-02-01');
        expect(result?.periodEnd).toBe('2026-02-01');
      });

      it('retorna null si el interés calculado es <= 0', () => {
        const account = buildAccount({
          term_days: 90,
          maturity_date: '2026-02-01',
          annual_interest_rate: 0.0000001,
          last_interest_applied_at: '2025-11-01',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });
    });

    describe('frecuencia diaria', () => {
      it('retorna null si no han pasado días', () => {
        // periodStart posterior a `today` (distinto del "mismo día", ya
        // cubierto por la validación general de la línea 94) para ejercer
        // realmente la rama `days <= 0` propia de la frecuencia diaria.
        const account = buildAccount({
          yield_frequency: 'daily',
          last_interest_applied_at: '2026-02-02',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });

      it('calcula interés diario si han pasado días', () => {
        const account = buildAccount({
          yield_frequency: 'daily',
          last_interest_applied_at: '2026-01-30',
        });
        const result = service.calculateInterest(account, '2026-02-01');
        expect(result).not.toBeNull();
        expect(result?.interest).toBeGreaterThan(0);
      });
    });

    describe('frecuencia mensual', () => {
      it('retorna null si han pasado menos de 28 días', () => {
        const account = buildAccount({
          yield_frequency: 'monthly',
          last_interest_applied_at: '2026-01-20',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });

      it('calcula interés mensual si pasaron 28 días o más', () => {
        const account = buildAccount({
          yield_frequency: 'monthly',
          last_interest_applied_at: '2026-01-01',
        });
        const result = service.calculateInterest(account, '2026-02-01');
        expect(result).not.toBeNull();
      });

      it('retorna null si el interés calculado es <= 0', () => {
        const account = buildAccount({
          yield_frequency: 'monthly',
          annual_interest_rate: 0.0000001,
          last_interest_applied_at: '2026-01-01',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });
    });

    describe('frecuencia anual', () => {
      it('retorna null si han pasado menos de 350 días', () => {
        const account = buildAccount({
          yield_frequency: 'annual',
          last_interest_applied_at: '2025-06-01',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });

      it('calcula interés anual si pasaron 350 días o más', () => {
        const account = buildAccount({
          yield_frequency: 'annual',
          last_interest_applied_at: '2025-01-01',
        });
        const result = service.calculateInterest(account, '2026-02-01');
        expect(result).not.toBeNull();
      });

      it('retorna null si el interés calculado es <= 0', () => {
        const account = buildAccount({
          yield_frequency: 'annual',
          annual_interest_rate: 0.0000001,
          last_interest_applied_at: '2025-01-01',
        });
        expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
      });
    });

    it('retorna null para una frecuencia desconocida', () => {
      const account = buildAccount({
        yield_frequency: 'quarterly' as never,
        last_interest_applied_at: '2025-01-01',
      });
      expect(service.calculateInterest(account, '2026-02-01')).toBeNull();
    });
  });

  describe('updateAccountMetadata', () => {
    it('actualiza last_interest_applied_at y guarda la cuenta', async () => {
      const account = buildAccount();
      mockBankAccountRepo.save.mockResolvedValue(account);

      await service.updateAccountMetadata(account, '2026-02-01');

      expect(account.last_interest_applied_at).toBe('2026-02-01');
      expect(mockBankAccountRepo.save).toHaveBeenCalledWith(account);
    });

    it('renueva las fechas del CDT si venció y auto_renew está activo', async () => {
      const account = buildAccount({
        term_days: 90,
        maturity_date: '2026-02-01',
        auto_renew: true,
      });
      mockBankAccountRepo.save.mockResolvedValue(account);

      await service.updateAccountMetadata(account, '2026-02-01');

      expect(account.start_date).toBe('2026-02-01');
      expect(account.maturity_date).not.toBe('2026-02-01');
    });

    it('no renueva las fechas del CDT si auto_renew está desactivado', async () => {
      const account = buildAccount({
        term_days: 90,
        maturity_date: '2026-02-01',
        auto_renew: false,
      });
      mockBankAccountRepo.save.mockResolvedValue(account);

      await service.updateAccountMetadata(account, '2026-02-01');

      expect(account.maturity_date).toBe('2026-02-01');
    });

    it('no renueva si aún no llega la fecha de vencimiento', async () => {
      const account = buildAccount({
        term_days: 90,
        maturity_date: '2026-05-01',
        auto_renew: true,
      });
      mockBankAccountRepo.save.mockResolvedValue(account);

      await service.updateAccountMetadata(account, '2026-02-01');

      expect(account.maturity_date).toBe('2026-05-01');
    });
  });
});

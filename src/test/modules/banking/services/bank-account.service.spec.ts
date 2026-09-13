import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BankAccountService } from '@banking/service/bank-account.service';
import { BankAccountRepository } from '@banking/repositories/bank-account.repository';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';
import { UpdateBankAccountDto } from '@banking/dto/bank-account/update-bank-account.dto';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { EncryptionService } from '@shared/services/encryption.service';

const mockBankAccountRepository = {
  create: jest.fn<
    Promise<BankAccount>,
    [number, CreateBankAccountDto, string | null, string | null]
  >(),
  findAll: jest.fn<Promise<BankAccount[]>, [number]>(),
  findById: jest.fn<Promise<BankAccount>, [number, number]>(),
  findByIdOrNull: jest.fn<Promise<BankAccount | null>, [number, number]>(),
  update: jest.fn<
    Promise<BankAccount>,
    [number, number, Partial<BankAccount>]
  >(),
  softDelete: jest.fn<Promise<void>, [number, number]>(),
};

const mockEncryptionService = {
  encryptField: jest.fn((value: string) => `enc:${value}`),
  decryptField: jest.fn((value: string) => value.replace(/^enc:/, '')),
  encrypt: jest.fn((value: string) => value),
  decrypt: jest.fn((value: string) => value),
};

const buildAccount = (overrides = {}): BankAccount =>
  ({
    id: 1,
    user_id: 10,
    bank_name: 'Bancolombia',
    account_type: 'ahorros',
    encrypted_account_number: 'enc:123456789',
    encrypted_balance: 'enc:1500000',
    currency: 'COP',
    is_primary: false,
    exempt_4x1000: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as unknown as BankAccount;

describe('BankAccountService', () => {
  let service: BankAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountService,
        { provide: BankAccountRepository, useValue: mockBankAccountRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<BankAccountService>(BankAccountService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateBankAccountDto = {
      bank_name: 'Bancolombia',
      account_type: 'ahorros',
      account_number: '123456789',
      balance: 1500000,
    };

    it('debe cifrar account_number y balance antes de delegar al repositorio', async () => {
      mockBankAccountRepository.create.mockResolvedValue(buildAccount());

      const result = await service.create(10, dto);

      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '123456789',
        'banking',
      );
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '1500000',
        'banking',
      );
      expect(mockBankAccountRepository.create).toHaveBeenCalledTimes(1);
      const [userId, dtoArg, encNum, encBal] =
        mockBankAccountRepository.create.mock.calls[0];
      expect(userId).toBe(10);
      expect(dtoArg).toEqual(dto);
      expect(encNum).toBe('enc:123456789');
      expect(encBal).toBe('enc:1500000');
      expect(result).toEqual({
        id: 1,
        user_id: 10,
        bank_name: 'Bancolombia',
        account_type: 'ahorros',
        masked_account_number: '****6789',
        display_balance: '1500000',
        currency: 'COP',
        annual_interest_rate: null,
        yield_frequency: 'monthly',
        rate_type: 'EA',
        interest_enabled: true,
        last_interest_applied_at: null,
        interest_start_date: null,
        term_days: null,
        start_date: null,
        maturity_date: null,
        maturity_action: 'renew',
        auto_renew: true,
        is_primary: false,
        exempt_4x1000: false,
        created_at: expect.any(Date) as Date,
        updated_at: expect.any(Date) as Date,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar las cuentas del usuario como DTOs', async () => {
      const accounts = [buildAccount()];
      mockBankAccountRepository.findAll.mockResolvedValue(accounts);

      const result = await service.findAll(10);

      expect(mockBankAccountRepository.findAll).toHaveBeenCalledWith(10);
      expect(result[0]).toHaveProperty('masked_account_number', '****6789');
      expect(result[0]).toHaveProperty('display_balance', '1500000');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar cuenta por id y userId', async () => {
      const account = buildAccount();
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.findOne(1, 10);

      expect(mockBankAccountRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toHaveProperty('masked_account_number', '****6789');
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockBankAccountRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('debe manejar cuentas sin datos cifrados ni opcionales', async () => {
      const account = buildAccount({
        encrypted_balance: null,
        encrypted_account_number: null,
        annual_interest_rate: 4.5,
        yield_frequency: 'quarterly',
        updated_at: null,
      });
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.findOne(1, 10);

      expect(result).toEqual(
        expect.objectContaining({
          masked_account_number: '****0000',
          display_balance: '0',
          annual_interest_rate: 4.5,
          yield_frequency: 'quarterly',
          updated_at: null,
        }),
      );
    });

    it('debe usar "0" como saldo visible si el descifrado no devuelve valor', async () => {
      const account = buildAccount();
      mockEncryptionService.decryptField.mockReturnValueOnce(null);
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.findOne(1, 10);

      expect(mockEncryptionService.decryptField).toHaveBeenCalledWith(
        'enc:1500000',
        'banking',
      );
      expect(result.display_balance).toBe('0');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOptional
  // ─────────────────────────────────────────────────────────────
  describe('findOptional', () => {
    it('retorna la entidad cruda sin lanzar si existe', async () => {
      const account = buildAccount();
      mockBankAccountRepository.findByIdOrNull.mockResolvedValue(account);

      const result = await service.findOptional(1, 10);

      expect(mockBankAccountRepository.findByIdOrNull).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(account);
    });

    it('retorna null si no existe o no pertenece al usuario', async () => {
      mockBankAccountRepository.findByIdOrNull.mockResolvedValue(null);

      const result = await service.findOptional(999, 10);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar campos básicos sin cifrado cuando no cambia account_number ni balance', async () => {
      const dto: UpdateBankAccountDto = {
        bank_name: 'Davivienda',
        is_primary: true,
      };
      const updated = buildAccount({ bank_name: 'Davivienda' });
      mockBankAccountRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      const [id, userId, partial] =
        mockBankAccountRepository.update.mock.calls[0];
      expect(id).toBe(1);
      expect(userId).toBe(10);
      expect(partial.bank_name).toBe('Davivienda');
      expect(partial.encrypted_account_number).toBeUndefined();
      expect(result).toHaveProperty('bank_name', 'Davivienda');
    });

    it('debe cifrar account_number si se provee en la actualización', async () => {
      const dto: UpdateBankAccountDto = { account_number: '987654321' };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '987654321',
        'banking',
      );
      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.encrypted_account_number).toBe('enc:987654321');
    });

    it('debe cifrar balance si se provee en la actualización', async () => {
      const dto: UpdateBankAccountDto = { balance: 2000000 };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.encrypted_balance).toBe('enc:2000000');
    });

    it('debe incluir annual_interest_rate y yield_frequency cuando se proveen', async () => {
      const dto: UpdateBankAccountDto = {
        annual_interest_rate: 6.5,
        yield_frequency: 'daily',
      };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.annual_interest_rate).toBe(6.5);
      expect(partial.yield_frequency).toBe('daily');
    });

    it('debe incluir rate_type, interest_enabled e interest_start_date cuando se proveen', async () => {
      const dto: UpdateBankAccountDto = {
        rate_type: 'nominal',
        interest_enabled: false,
        interest_start_date: '2026-01-01',
      };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.rate_type).toBe('nominal');
      expect(partial.interest_enabled).toBe(false);
      expect(partial.interest_start_date).toBe('2026-01-01');
    });

    it('debe incluir term_days y calcular maturity_date a partir de start_date', async () => {
      const dto: UpdateBankAccountDto = {
        term_days: 90,
        start_date: '2026-01-01',
      };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.term_days).toBe(90);
      expect(partial.start_date).toBe('2026-01-01');
      expect(partial.maturity_date).toBe('2026-04-01');
    });

    it('debe incluir start_date sin calcular maturity_date si no hay term_days', async () => {
      const dto: UpdateBankAccountDto = { start_date: '2026-01-01' };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.start_date).toBe('2026-01-01');
      expect(partial.maturity_date).toBeUndefined();
    });

    it('debe incluir maturity_action y auto_renew cuando se proveen', async () => {
      const dto: UpdateBankAccountDto = {
        maturity_action: 'liquidate',
        auto_renew: false,
      };
      mockBankAccountRepository.update.mockResolvedValue(buildAccount());

      await service.update(1, 10, dto);

      const [, , partial] = mockBankAccountRepository.update.mock.calls[0];
      expect(partial.maturity_action).toBe('liquidate');
      expect(partial.auto_renew).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe delegar el soft delete al repositorio', async () => {
      mockBankAccountRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockBankAccountRepository.softDelete).toHaveBeenCalledWith(1, 10);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getProjectedYield
  // ─────────────────────────────────────────────────────────────
  describe('getProjectedYield', () => {
    it('debe calcular la proyección compuesta mensual con saldo descifrado', async () => {
      const account = buildAccount({
        encrypted_balance: 'enc:1000000',
        annual_interest_rate: 12,
        yield_frequency: 'monthly',
      });
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.getProjectedYield(1, 10);

      expect(mockBankAccountRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(mockEncryptionService.decryptField).toHaveBeenCalledWith(
        'enc:1000000',
        'banking',
      );
      expect(result.current_balance).toBe(1000000);
      expect(result.annual_rate).toBe(12);
      expect(result.yield_frequency).toBe('monthly');
      // rate_type por defecto es 'EA' (Efectiva Anual): tras 12 periodos
      // mensuales el factor compuesto vuelve exactamente a la tasa anual.
      expect(result.projected['1y']).toBeCloseTo(1120000, 2);
      expect(result.projected['10y']).toBeGreaterThan(1000000);
    });

    it('debe manejar cuenta sin saldo, tasa ni frecuencia (proyección plana)', async () => {
      const account = buildAccount({
        encrypted_balance: null,
        annual_interest_rate: null,
        yield_frequency: null,
      });
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.getProjectedYield(1, 10);

      expect(result.current_balance).toBe(0);
      expect(result.annual_rate).toBeNull();
      expect(result.yield_frequency).toBe('monthly');
      expect(result.projected['5y']).toBe(0);
      expect(result.projected['10y']).toBe(0);
    });

    it('debe usar 365 períodos para frecuencia diaria', async () => {
      const account = buildAccount({
        annual_interest_rate: 0,
        yield_frequency: 'daily',
      });
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.getProjectedYield(1, 10);

      expect(result.yield_frequency).toBe('daily');
      expect(result.projected['1y']).toBe(1500000);
      expect(result.projected['10y']).toBe(1500000);
    });

    it('debe usar 1 período anual para frecuencias distintas a diaria/mensual', async () => {
      const account = buildAccount({
        annual_interest_rate: 4,
        yield_frequency: 'quarterly',
      });
      mockBankAccountRepository.findById.mockResolvedValue(account);

      const result = await service.getProjectedYield(1, 10);

      expect(result.yield_frequency).toBe('quarterly');
      expect(result.projected['1y']).toBeCloseTo(1560000, 2);
    });
  });
});

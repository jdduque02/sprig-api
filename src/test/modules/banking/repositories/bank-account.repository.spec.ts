import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';
import { BankAccountRepository } from '@banking/repositories/bank-account.repository';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildAccount = (overrides = {}): BankAccount =>
  ({
    id: 1,
    user_id: 10,
    bank_name: 'Bancolombia',
    account_type: 'ahorros',
    encrypted_account_number: Buffer.from('123456789', 'utf8'),
    encrypted_balance: Buffer.from('1500000', 'utf8'),
    is_primary: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as unknown as BankAccount;

describe('BankAccountRepository', () => {
  let repo: BankAccountRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountRepository,
        { provide: getRepositoryToken(BankAccount), useValue: mockTypeOrmRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<BankAccountRepository>(BankAccountRepository);
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
    const encNum = Buffer.from('123456789', 'utf8');
    const encBal = Buffer.from('1500000', 'utf8');

    it('debe crear y guardar cuenta bancaria exitosamente', async () => {
      const account = buildAccount();
      mockTypeOrmRepo.create.mockReturnValue(account);
      mockTypeOrmRepo.save.mockResolvedValue(account);

      const result = await repo.create(10, dto, encNum, encBal);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledTimes(1);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(account);
    });

    it('debe lanzar ConflictException por violación de unicidad (23505)', async () => {
      const pgError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { message: 'duplicate key', code: '23505' },
      );
      mockTypeOrmRepo.create.mockReturnValue(buildAccount());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(repo.create(10, dto, encNum, encBal)).rejects.toThrow(
        ConflictException,
      );
    });

    it('debe lanzar InternalServerErrorException para otros errores de BD', async () => {
      mockTypeOrmRepo.create.mockReturnValue(buildAccount());
      mockTypeOrmRepo.save.mockRejectedValue(new Error('connection timeout'));

      await expect(repo.create(10, dto, encNum, encBal)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar cuentas activas del usuario', async () => {
      const accounts = [buildAccount(), buildAccount({ id: 2 })];
      mockTypeOrmRepo.find.mockResolvedValue(accounts);

      const result = await repo.findAll(10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar la cuenta si existe', async () => {
      const account = buildAccount();
      mockTypeOrmRepo.findOne.mockResolvedValue(account);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(account);
    });

    it('debe lanzar NotFoundException si la cuenta no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar y guardar la cuenta', async () => {
      const account = buildAccount();
      const merged = buildAccount({ bank_name: 'Davivienda' });
      mockTypeOrmRepo.findOne.mockResolvedValue(account);
      mockTypeOrmRepo.merge.mockReturnValue(merged);
      mockTypeOrmRepo.save.mockResolvedValue(merged);

      const result = await repo.update(1, 10, { bank_name: 'Davivienda' });

      expect(mockTypeOrmRepo.merge).toHaveBeenCalledWith(account, {
        bank_name: 'Davivienda',
      });
      expect(result.bank_name).toBe('Davivienda');
    });

    it('debe propagar NotFoundException si la cuenta no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, 10, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('debe hacer soft remove de la cuenta', async () => {
      const account = buildAccount();
      mockTypeOrmRepo.findOne.mockResolvedValue(account);
      mockTypeOrmRepo.softRemove.mockResolvedValue(account);

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(account);
    });

    it('debe propagar NotFoundException si la cuenta no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

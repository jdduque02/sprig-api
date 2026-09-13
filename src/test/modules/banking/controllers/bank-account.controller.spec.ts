import { NotFoundException } from '@nestjs/common';
import { BankAccountController } from '@banking/controller/bank-account.controller';
import { BankAccountService } from '@banking/service/bank-account.service';
import { InterestAccrualScheduler } from '@banking/service/interest-accrual.scheduler';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';
import { UpdateBankAccountDto } from '@banking/dto/bank-account/update-bank-account.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockBankAccountService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getProjectedYield: jest.fn(),
};

const mockInterestAccrualScheduler = {
  triggerManual: jest.fn(),
};

const buildAccount = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  bank_name: 'Bancolombia',
  account_type: 'ahorros',
  is_primary: false,
  created_at: new Date(),
  ...overrides,
});

const currentUser: IntrospectResponse = {
  sub: 'kc-uuid',
  username: 'testuser',
};

describe('BankAccountController', () => {
  let controller: BankAccountController;

  beforeEach(() => {
    controller = new BankAccountController(
      mockBankAccountService as unknown as BankAccountService,
      mockInterestAccrualScheduler as unknown as InterestAccrualScheduler,
    );
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

    it('debe crear cuenta bancaria delegando al servicio', async () => {
      const created = buildAccount();
      mockBankAccountService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockBankAccountService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todas las cuentas del usuario', async () => {
      const accounts = [
        buildAccount(),
        buildAccount({ id: 2, bank_name: 'Davivienda' }),
      ];
      mockBankAccountService.findAll.mockResolvedValue(accounts);

      const result = await controller.findAll(10, currentUser);

      expect(mockBankAccountService.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('debe retornar lista vacía cuando el usuario no tiene cuentas', async () => {
      mockBankAccountService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(10, currentUser);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar cuenta por id', async () => {
      const account = buildAccount();
      mockBankAccountService.findOne.mockResolvedValue(account);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockBankAccountService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(account);
    });

    it('debe propagar NotFoundException si la cuenta no existe', async () => {
      mockBankAccountService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar cuenta y retornar el resultado', async () => {
      const dto: UpdateBankAccountDto = { bank_name: 'Davivienda' };
      const updated = buildAccount({ bank_name: 'Davivienda' });
      mockBankAccountService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockBankAccountService.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual(updated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar cuenta y retornar undefined', async () => {
      mockBankAccountService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(10, 1, currentUser);

      expect(mockBankAccountService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });

    it('debe propagar NotFoundException si la cuenta no existe', async () => {
      mockBankAccountService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getProjectedYield
  // ─────────────────────────────────────────────────────────────
  describe('getProjectedYield', () => {
    it('debe retornar la proyección de rendimiento delegando al servicio', async () => {
      const projection = { months: 12, projected_yield: 150000 };
      mockBankAccountService.getProjectedYield.mockResolvedValue(projection);

      const result = await controller.getProjectedYield(10, 1, currentUser);

      expect(mockBankAccountService.getProjectedYield).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(projection);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // accrueInterest
  // ─────────────────────────────────────────────────────────────
  describe('accrueInterest', () => {
    it('debe delegar la capitalización manual al scheduler', async () => {
      const summary = { processed: 3, skipped: 0 };
      mockInterestAccrualScheduler.triggerManual.mockResolvedValue(summary);

      const result = await controller.accrueInterest(10, currentUser);

      expect(mockInterestAccrualScheduler.triggerManual).toHaveBeenCalled();
      expect(result).toEqual(summary);
    });
  });
});

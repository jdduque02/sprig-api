import { BadRequestException } from '@nestjs/common';
import { CashArqueoController } from '@finance/controller/cash-arqueo.controller';
import { CashArqueoService } from '@finance/service/cash-arqueo.service';

const mockService = {
  create: jest.fn(),
  getReconciliation: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const currentUser = { userId: 10 };

const mockI18n = { t: jest.fn((key: string) => key) };

describe('CashArqueoController', () => {
  let controller: CashArqueoController;

  beforeEach(() => {
    controller = new CashArqueoController(
      mockService as unknown as CashArqueoService,
      mockI18n as never,
    );
    jest.clearAllMocks();
  });

  it('reconciliation pasa month como query', async () => {
    mockService.getReconciliation.mockResolvedValue({ expected_amount: 0 });
    await controller.reconciliation(10, '2026-08', currentUser as never);
    expect(mockService.getReconciliation).toHaveBeenCalledWith(10, '2026-08');
  });

  it('reconciliation lanza BadRequestException si el mes falta', async () => {
    await expect(
      controller.reconciliation(10, '', currentUser as never),
    ).rejects.toThrow(BadRequestException);
    expect(mockService.getReconciliation).not.toHaveBeenCalled();
  });

  it('reconciliation lanza BadRequestException si el mes tiene formato inválido', async () => {
    await expect(
      controller.reconciliation(10, '2026/08', currentUser as never),
    ).rejects.toThrow(BadRequestException);
    expect(mockService.getReconciliation).not.toHaveBeenCalled();
  });

  it('create delega', async () => {
    const dto = { counted_amount: 1000 };
    mockService.create.mockResolvedValue({ id: 1 });
    await controller.create(10, dto, currentUser as never);
    expect(mockService.create).toHaveBeenCalledWith(10, dto);
  });

  it('findAll delega', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll(10, currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10);
  });

  it('findOne delega', async () => {
    mockService.findOne.mockResolvedValue({ id: 2 });
    await controller.findOne(10, 2, currentUser as never);
    expect(mockService.findOne).toHaveBeenCalledWith(2, 10);
  });

  it('remove delega', async () => {
    await controller.remove(10, 2, currentUser as never);
    expect(mockService.remove).toHaveBeenCalledWith(2, 10);
  });
});

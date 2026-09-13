import { TransferController } from '@finance/controller/transfer.controller';
import { TransferService } from '@finance/service/transfer.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  clone: jest.fn(),
};

const currentUser = { userId: 10 };

describe('TransferController', () => {
  let controller: TransferController;

  beforeEach(() => {
    controller = new TransferController(
      mockService as unknown as TransferService,
    );
    jest.clearAllMocks();
  });

  it('create delega con userId y dto', async () => {
    const dto = { amount: 50000 };
    mockService.create.mockResolvedValue({ transfer_group_id: 'g' });
    await controller.create(10, dto as never, currentUser as never);
    expect(mockService.create).toHaveBeenCalledWith(10, dto);
  });

  it('findAll usa paginación por defecto', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, 1, 20);
  });

  it('findAll normaliza page y limit', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, currentUser as never, '2', '1000');
    expect(mockService.findAll).toHaveBeenCalledWith(10, 2, 500);
  });

  it('findAll protege contra valores inválidos', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, currentUser as never, '-5', '0');
    expect(mockService.findAll).toHaveBeenCalledWith(10, 1, 1);
  });

  it('findOne delega', async () => {
    mockService.findOne.mockResolvedValue({ transfer_group_id: 'g' });
    await controller.findOne(10, 7, currentUser as never);
    expect(mockService.findOne).toHaveBeenCalledWith(7, 10);
  });

  it('update delega', async () => {
    const dto = { amount: 1 };
    mockService.update.mockResolvedValue({});
    await controller.update(10, 7, dto, currentUser as never);
    expect(mockService.update).toHaveBeenCalledWith(7, 10, dto);
  });

  it('remove delega', async () => {
    await controller.remove(10, 7, currentUser as never);
    expect(mockService.remove).toHaveBeenCalledWith(7, 10);
  });

  it('clone delega con userId, id y dto', async () => {
    const dto = { amount: 90000 };
    mockService.clone.mockResolvedValue({ transfer_group_id: 'g2' });
    const result = await controller.clone(10, 7, dto, currentUser as never);
    expect(mockService.clone).toHaveBeenCalledWith(7, 10, dto);
    expect(result).toEqual({ transfer_group_id: 'g2' });
  });
});

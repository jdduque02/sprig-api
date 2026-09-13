import { BankingEntityController } from '@support/controller/banking-entity.controller';
import { BankingEntityService } from '@support/service/banking-entity.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('BankingEntityController', () => {
  let controller: BankingEntityController;

  beforeEach(() => {
    controller = new BankingEntityController(
      mockService as unknown as BankingEntityService,
    );
    jest.clearAllMocks();
  });

  it('create delega en el servicio', async () => {
    const dto = { name: 'Banco X', code: 'BX' };
    mockService.create.mockResolvedValue(dto);
    await expect(controller.create(dto as never)).resolves.toEqual(dto);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega en el servicio', async () => {
    const list = [{ id: 1 }];
    mockService.findAll.mockResolvedValue(list);
    await expect(controller.findAll()).resolves.toEqual(list);
  });

  it('findOne delega con el id', async () => {
    mockService.findOne.mockResolvedValue({ id: 5 });
    await expect(controller.findOne(5)).resolves.toEqual({ id: 5 });
    expect(mockService.findOne).toHaveBeenCalledWith(5);
  });

  it('update delega con id y dto', async () => {
    const dto = { name: 'Nuevo' };
    mockService.update.mockResolvedValue({ id: 1, ...dto });
    await expect(controller.update(1, dto as never)).resolves.toMatchObject(
      dto,
    );
    expect(mockService.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove delega en el servicio', async () => {
    await controller.remove(3);
    expect(mockService.remove).toHaveBeenCalledWith(3);
  });
});

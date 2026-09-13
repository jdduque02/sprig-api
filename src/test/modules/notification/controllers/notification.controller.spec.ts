import { NotificationController } from '@notification/controller/notification.controller';
import { NotificationService } from '@notification/service/notification.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  remove: jest.fn(),
};

const currentUser = { userId: 10 };

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(() => {
    controller = new NotificationController(
      mockService as unknown as NotificationService,
    );
    jest.clearAllMocks();
  });

  it('create delega con userId y dto', async () => {
    const dto = { title: 'Hola' };
    mockService.create.mockResolvedValue({ id: 1 });
    await controller.create(10, dto, currentUser as never);
    expect(mockService.create).toHaveBeenCalledWith(10, dto);
  });

  it('findAll pasa el query', async () => {
    const query = { is_read: false };
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll(10, query, currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, query);
  });

  it('findAll funciona sin query', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll(10, undefined, currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, undefined);
  });

  it('findOne delega', async () => {
    mockService.findOne.mockResolvedValue({ id: 2 });
    await controller.findOne(10, 2, currentUser as never);
    expect(mockService.findOne).toHaveBeenCalledWith(2, 10);
  });

  it('markAllAsRead delega', async () => {
    await controller.markAllAsRead(10, currentUser as never);
    expect(mockService.markAllAsRead).toHaveBeenCalledWith(10);
  });

  it('update delega', async () => {
    const dto = { title: 'Nuevo' };
    mockService.update.mockResolvedValue({ id: 2, ...dto });
    await controller.update(10, 2, dto, currentUser as never);
    expect(mockService.update).toHaveBeenCalledWith(2, 10, dto);
  });

  it('markAsRead delega', async () => {
    mockService.markAsRead.mockResolvedValue({ id: 2, is_read: true });
    await controller.markAsRead(10, 2, currentUser as never);
    expect(mockService.markAsRead).toHaveBeenCalledWith(2, 10);
  });

  it('remove delega', async () => {
    await controller.remove(10, 2, currentUser as never);
    expect(mockService.remove).toHaveBeenCalledWith(2, 10);
  });
});

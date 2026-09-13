import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationRepository } from '@notification/repositories/notification.repository';
import { Notification } from '@notification/entities/notification.entity';

const buildNotification = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    title: 'Título',
    description: null,
    is_active: true,
    is_read: false,
    scheduled_at: null,
    reference: null,
    created_at: new Date(),
    ...overrides,
  }) as Notification;

const mockRepo = {
  create: jest.fn((e: Partial<Notification>) => e),
  save: jest.fn((e: Notification) => ({ id: 1, ...e })),
  findOne: jest.fn(),
  find: jest.fn(),
  merge: jest.fn((n: Notification, dto: Partial<Notification>) => ({
    ...n,
    ...dto,
  })),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockI18n = { t: jest.fn((key: string) => key) };

describe('NotificationRepository', () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = new NotificationRepository(
      mockRepo as never,
      mockI18n as unknown as I18nService,
    );
    jest.clearAllMocks();
  });

  it('create persiste la notificación', async () => {
    const result = await repo.create(10, {
      title: 'Hola',
      description: 'Mundo',
    });
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.id).toBe(1);
  });

  it('findByReference consulta por userId y reference', async () => {
    mockRepo.findOne.mockResolvedValue(buildNotification());
    const result = await repo.findByReference(10, 'ref-1');
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 10, reference: 'ref-1' },
    });
    expect(result).toBeTruthy();
  });

  it('findAll aplica filtros opcionales', async () => {
    mockRepo.find.mockResolvedValue([]);
    await repo.findAll(10, { is_read: false, is_active: true });
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 10, is_read: false, is_active: true },
      }),
    );
  });

  it('findById lanza NotFoundException si no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(repo.findById(99, 10)).rejects.toThrow(NotFoundException);
  });

  it('findById retorna la notificación', async () => {
    mockRepo.findOne.mockResolvedValue(buildNotification({ id: 2 }));
    await expect(repo.findById(2, 10)).resolves.toMatchObject({ id: 2 });
  });

  it('update fusiona y guarda', async () => {
    mockRepo.findOne.mockResolvedValue(buildNotification());
    const result = await repo.update(1, 10, { is_read: true });
    expect(result.is_read).toBe(true);
  });

  it('markAsRead marca como leída', async () => {
    mockRepo.findOne.mockResolvedValue(buildNotification({ is_read: false }));
    const result = await repo.markAsRead(1, 10);
    expect(result.is_read).toBe(true);
  });

  it('markAllAsRead actualiza todas', async () => {
    await repo.markAllAsRead(10);
    expect(mockRepo.update).toHaveBeenCalledWith(
      { user_id: 10, is_read: false },
      { is_read: true },
    );
  });

  it('remove elimina la notificación', async () => {
    const n = buildNotification();
    mockRepo.findOne.mockResolvedValue(n);
    await repo.remove(1, 10);
    expect(mockRepo.remove).toHaveBeenCalledWith(n);
  });
});

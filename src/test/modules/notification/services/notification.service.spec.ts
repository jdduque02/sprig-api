import { NotificationService } from '@notification/service/notification.service';
import { NotificationGateway } from '@notification/gateway/notification.gateway';
import { NotificationPayload } from '@notification/interfaces/notification.interfaces';

const mockNotificationGateway = {
  sendNotificationToUser: jest.fn(),
  confirmMarkRead: jest.fn(),
  confirmMarkAllRead: jest.fn(),
  sendStatementImportProgress: jest.fn(),
};

const mockNotificationRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  remove: jest.fn(),
  findByReference: jest.fn(),
};

const buildPayload = (overrides = {}): NotificationPayload => ({
  id: 1,
  user_id: 10,
  title: 'Alerta de presupuesto',
  description: 'Has superado el 80% de tu presupuesto mensual.',
  is_read: false,
  is_active: true,
  scheduled_at: null,
  created_at: new Date(),
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService(
      mockNotificationGateway as unknown as NotificationGateway,
      mockNotificationRepository as never,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // sendToUser
  // ─────────────────────────────────────────────────────────────
  describe('sendToUser', () => {
    it('debe delegar la notificación al gateway con userId y payload', () => {
      const payload = buildPayload();

      service.sendToUser(10, payload);

      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).toHaveBeenCalledWith(10, payload);
    });

    it('debe delegar correctamente a diferentes usuarios', () => {
      const payload1 = buildPayload({ user_id: 10 });
      const payload2 = buildPayload({
        id: 2,
        user_id: 20,
        title: 'Otro aviso',
      });

      service.sendToUser(10, payload1);
      service.sendToUser(20, payload2);

      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).toHaveBeenNthCalledWith(1, 10, payload1);
      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).toHaveBeenNthCalledWith(2, 20, payload2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // confirmMarkRead
  // ─────────────────────────────────────────────────────────────
  describe('confirmMarkRead', () => {
    it('debe confirmar al gateway que la notificación fue leída', () => {
      service.confirmMarkRead(10, 99);

      expect(mockNotificationGateway.confirmMarkRead).toHaveBeenCalledWith(
        10,
        99,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // confirmMarkAllRead
  // ─────────────────────────────────────────────────────────────
  describe('confirmMarkAllRead', () => {
    it('debe confirmar al gateway que todas las notificaciones fueron leídas', () => {
      service.confirmMarkAllRead(10);

      expect(mockNotificationGateway.confirmMarkAllRead).toHaveBeenCalledWith(
        10,
      );
    });
  });

  const buildNotification = (overrides: Partial<NotificationPayload> = {}) => ({
    id: 1,
    user_id: 10,
    title: 'Alerta de presupuesto',
    description: 'Has superado el 80% de tu presupuesto mensual.',
    is_read: false,
    is_active: true,
    scheduled_at: null,
    reference: null,
    created_at: new Date(),
    ...overrides,
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('debe crear la notificación y enviarla por el gateway', async () => {
      const notification = buildNotification();
      mockNotificationRepository.create.mockResolvedValue(notification);

      const result = await service.create(10, {
        title: 'Alerta de presupuesto',
        description: 'Has superado el 80% de tu presupuesto mensual.',
      });

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(10, {
        title: 'Alerta de presupuesto',
        description: 'Has superado el 80% de tu presupuesto mensual.',
      });
      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).toHaveBeenCalledWith(10, {
        id: notification.id,
        user_id: notification.user_id,
        title: notification.title,
        description: notification.description,
        is_read: notification.is_read,
        is_active: notification.is_active,
        scheduled_at: notification.scheduled_at,
        reference: notification.reference,
        created_at: notification.created_at,
      });
      expect(result).toEqual(notification);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('sin query envía filtros indefinidos', async () => {
      const notifications = [buildNotification()];
      mockNotificationRepository.findAll.mockResolvedValue(notifications);

      const result = await service.findAll(10);

      expect(mockNotificationRepository.findAll).toHaveBeenCalledWith(10, {
        is_read: undefined,
        is_active: undefined,
      });
      expect(result).toEqual(notifications);
    });

    it('con query aplica los filtros de lectura y actividad', async () => {
      mockNotificationRepository.findAll.mockResolvedValue([]);

      await service.findAll(10, { is_read: true, is_active: false });

      expect(mockNotificationRepository.findAll).toHaveBeenCalledWith(10, {
        is_read: true,
        is_active: false,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe delegar la búsqueda por id y usuario', async () => {
      const notification = buildNotification();
      mockNotificationRepository.findById.mockResolvedValue(notification);

      const result = await service.findOne(1, 10);

      expect(mockNotificationRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(notification);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe delegar la actualización al repositorio', async () => {
      const updated = buildNotification({ title: 'Leído' });
      mockNotificationRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, { title: 'Leído' });

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(1, 10, {
        title: 'Leído',
      });
      expect(result).toEqual(updated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // markAsRead / markAllAsRead
  // ─────────────────────────────────────────────────────────────
  describe('markAsRead', () => {
    it('debe marcar como leída y confirmar al gateway', async () => {
      const read = buildNotification({ is_read: true });
      mockNotificationRepository.markAsRead.mockResolvedValue(read);

      const result = await service.markAsRead(1, 10);

      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith(1, 10);
      expect(mockNotificationGateway.confirmMarkRead).toHaveBeenCalledWith(
        10,
        read.id,
      );
      expect(result).toEqual(read);
    });
  });

  describe('markAllAsRead', () => {
    it('debe marcar todas y confirmar al gateway', async () => {
      mockNotificationRepository.markAllAsRead.mockResolvedValue(undefined);

      await service.markAllAsRead(10);

      expect(mockNotificationRepository.markAllAsRead).toHaveBeenCalledWith(10);
      expect(mockNotificationGateway.confirmMarkAllRead).toHaveBeenCalledWith(
        10,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe delegar la eliminación al repositorio', async () => {
      mockNotificationRepository.remove.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockNotificationRepository.remove).toHaveBeenCalledWith(1, 10);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createIfMissing
  // ─────────────────────────────────────────────────────────────
  describe('createIfMissing', () => {
    it('retorna null si ya existe una con la misma referencia', async () => {
      mockNotificationRepository.findByReference.mockResolvedValue(
        buildNotification(),
      );

      const result = await service.createIfMissing(10, { title: 'X' }, 'ref-1');

      expect(mockNotificationRepository.findByReference).toHaveBeenCalledWith(
        10,
        'ref-1',
      );
      expect(result).toBeNull();
      expect(
        mockNotificationGateway.sendNotificationToUser,
      ).not.toHaveBeenCalled();
    });

    it('crea la notificación cuando no existe', async () => {
      const notification = buildNotification({ reference: 'ref-1' });
      mockNotificationRepository.findByReference.mockResolvedValue(null);
      mockNotificationRepository.create.mockResolvedValue(notification);

      const result = await service.createIfMissing(10, { title: 'X' }, 'ref-1');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(10, {
        title: 'X',
        reference: 'ref-1',
      });
      expect(result).toEqual(notification);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendStatementImportProgress
  // ─────────────────────────────────────────────────────────────
  describe('sendStatementImportProgress', () => {
    it('debe delegar el progreso de importación al gateway', () => {
      const payload = { done: 3, total: 10 };

      service.sendStatementImportProgress(10, payload);

      expect(
        mockNotificationGateway.sendStatementImportProgress,
      ).toHaveBeenCalledWith(10, payload);
    });
  });
});

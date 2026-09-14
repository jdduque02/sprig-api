import { Test } from '@nestjs/testing';
import { NotificationGateway } from '@notification/gateway/notification.gateway';
import { NotificationService } from '@notification/service/notification.service';
import { NotificationPayload } from '@notification/interfaces/notification.interfaces';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROOMS,
} from '@notification/constants/notification.events';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@auth/service/auth.service';
import { I18nService } from 'nestjs-i18n';
import { PresenceService } from '@shared/services/presence.service';
import { WsException } from '@nestjs/websockets';

// ─────────────────────────────────────────────────────────────
// Mocks del Server y Socket de socket.io
// ─────────────────────────────────────────────────────────────
interface MockServerTo {
  emit: jest.Mock;
}

interface MockServer {
  to: jest.Mock;
  use: jest.Mock;
}

interface MockSocketClient {
  id: string;
  data?: Record<string, unknown>;
  handshake?: {
    auth?: { token?: string };
    headers?: { authorization?: string };
  };
  join?: jest.Mock;
  leave?: jest.Mock;
}

const mockServerTo: MockServerTo = { emit: jest.fn() };
const mockServer: MockServer = {
  to: jest.fn().mockReturnValue(mockServerTo),
  use: jest.fn(),
};

const mockGateway = {
  sendNotificationToUser: jest.fn(),
  confirmMarkRead: jest.fn(),
  confirmMarkAllRead: jest.fn(),
};

const mockAuthService = {
  introspect: jest.fn(),
};

const mockPresenceService = {
  markOnline: jest.fn(),
  markOffline: jest.fn(),
};

const mockGatewayI18n = {
  t: jest.fn((key: string) => `[${key}]`),
};

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const buildPayload = (overrides = {}): NotificationPayload => ({
  id: 1,
  user_id: 10,
  title: 'Test',
  description: 'Mensaje de prueba',
  is_read: false,
  is_active: true,
  scheduled_at: null,
  reference: null,
  created_at: new Date(),
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService(
      mockGateway as unknown as NotificationGateway,
      {} as never,
    );
    jest.clearAllMocks();
  });

  describe('sendToUser', () => {
    it('debe delegar al gateway.sendNotificationToUser', () => {
      const payload = buildPayload();

      service.sendToUser(10, payload);

      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(
        10,
        payload,
      );
    });
  });

  describe('confirmMarkRead', () => {
    it('debe delegar al gateway.confirmMarkRead', () => {
      service.confirmMarkRead(10, 42);

      expect(mockGateway.confirmMarkRead).toHaveBeenCalledWith(10, 42);
    });
  });

  describe('confirmMarkAllRead', () => {
    it('debe delegar al gateway.confirmMarkAllRead', () => {
      service.confirmMarkAllRead(10);

      expect(mockGateway.confirmMarkAllRead).toHaveBeenCalledWith(10);
    });
  });
});

describe('NotificationGateway — resolución vía DI (forwardRef)', () => {
  // A diferencia de `new NotificationGateway(...)`, resolver la clase a través del
  // contenedor de Nest ejerce la metadata real de `@Inject(forwardRef(() => AuthService))`
  // del constructor (necesaria por la dependencia circular auth <-> notification).
  it('debe instanciarse correctamente cuando Nest resuelve sus dependencias', async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        { provide: ConfigService, useValue: {} },
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockGatewayI18n },
        { provide: PresenceService, useValue: mockPresenceService },
      ],
    }).compile();

    const gateway = module.get(NotificationGateway);

    expect(gateway).toBeInstanceOf(NotificationGateway);
  });
});

describe('NotificationGateway — métodos de emisión', () => {
  let gateway: NotificationGateway;

  beforeEach(() => {
    gateway = new NotificationGateway(
      {} as unknown as ConfigService, // ConfigService — no se usa en los métodos de emisión
      mockAuthService as unknown as AuthService,
      mockGatewayI18n as unknown as I18nService,
      mockPresenceService as unknown as PresenceService,
    );

    // Inyectar el server mock en la propiedad privada
    (gateway as unknown as { server: MockServer }).server = mockServer;
    jest.clearAllMocks();
    mockServer.to.mockReturnValue(mockServerTo);
    mockAuthService.introspect.mockResolvedValue({ sub: 'kc-uuid' });
  });

  describe('afterInit / authenticateSocket', () => {
    const setupMiddleware = (): ((
      socket: MockSocketClient,
      next: (err?: Error) => void,
    ) => void) => {
      gateway.afterInit(mockServer as unknown as never);
      const calls = mockServer.use.mock.calls as unknown as Array<
        Array<(socket: MockSocketClient, next: (err?: Error) => void) => void>
      >;
      return calls[0][0];
    };

    it('registra el middleware de autenticación al inicializar', () => {
      gateway.afterInit(mockServer as unknown as never);
      expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('rechaza conexiones sin token', async () => {
      const middleware = setupMiddleware();
      const next = jest.fn();
      const socket: MockSocketClient = {
        id: 'socket-1',
        handshake: { auth: {}, headers: {} },
      };

      middleware(socket, next);
      await flush();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[notification.AUTH_TOKEN_REQUIRED]',
        }),
      );
      expect(mockAuthService.introspect).not.toHaveBeenCalled();
    });

    it('autentica con el token del handshake', async () => {
      const user = { sub: 'kc-uuid', userId: 5 };
      mockAuthService.introspect.mockResolvedValue(user);
      const middleware = setupMiddleware();
      const next = jest.fn();
      const socket: MockSocketClient = {
        id: 'socket-1',
        data: {},
        handshake: { auth: { token: 'abc' }, headers: {} },
      };

      middleware(socket, next);
      await flush();

      expect(mockAuthService.introspect).toHaveBeenCalledWith('abc');
      expect(next).toHaveBeenCalledWith();
      expect(socket.data).toMatchObject({ token: 'abc', user });
    });

    it('autentica con el token del encabezado Authorization', async () => {
      const middleware = setupMiddleware();
      const next = jest.fn();
      const socket: MockSocketClient = {
        id: 'socket-1',
        data: {},
        handshake: { auth: {}, headers: { authorization: 'Bearer xyz' } },
      };

      middleware(socket, next);
      await flush();

      expect(mockAuthService.introspect).toHaveBeenCalledWith('xyz');
      expect(next).toHaveBeenCalledWith();
    });

    it('rechaza conexiones con token inválido', async () => {
      mockAuthService.introspect.mockRejectedValue(new Error('invalid'));
      const middleware = setupMiddleware();
      const next = jest.fn();
      const socket: MockSocketClient = {
        id: 'socket-1',
        handshake: { auth: { token: 'bad' }, headers: {} },
      };

      middleware(socket, next);
      await flush();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[notification.AUTH_TOKEN_INVALID]',
        }),
      );
    });

    it('las excepciones Ws de autenticación son instancias de WsException', async () => {
      const middleware = setupMiddleware();
      const next = jest.fn();
      const socket: MockSocketClient = {
        id: 'socket-1',
        handshake: { auth: {}, headers: {} },
      };

      middleware(socket, next);
      await flush();

      const [err] = next.mock.calls[0] as [WsException];
      expect(err).toBeInstanceOf(WsException);
      expect(err.getError()).toBe('[notification.AUTH_TOKEN_REQUIRED]');
    });
  });

  describe('sendNotificationToUser', () => {
    it('debe emitir NEW_NOTIFICATION a la sala del usuario', () => {
      const payload = buildPayload();
      const expectedRoom = NOTIFICATION_ROOMS.user(10);

      gateway.sendNotificationToUser(10, payload);

      expect(mockServer.to).toHaveBeenCalledWith(expectedRoom);
      expect(mockServerTo.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.NEW_NOTIFICATION,
        payload,
      );
    });
  });

  describe('sendStatementImportProgress', () => {
    it('debe emitir el progreso del extracto a la sala del usuario', () => {
      const payload = { id: 1, status: 'processing' };
      const expectedRoom = NOTIFICATION_ROOMS.user(10);

      gateway.sendStatementImportProgress(10, payload);

      expect(mockServer.to).toHaveBeenCalledWith(expectedRoom);
      expect(mockServerTo.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.STATEMENT_IMPORT_PROGRESS,
        payload,
      );
    });
  });

  describe('confirmMarkRead', () => {
    it('debe emitir MARK_READ con el id de notificación', () => {
      const expectedRoom = NOTIFICATION_ROOMS.user(10);

      gateway.confirmMarkRead(10, 42);

      expect(mockServer.to).toHaveBeenCalledWith(expectedRoom);
      expect(mockServerTo.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.MARK_READ,
        {
          notification_id: 42,
        },
      );
    });
  });

  describe('confirmMarkAllRead', () => {
    it('debe emitir MARK_ALL_READ a la sala del usuario', () => {
      const expectedRoom = NOTIFICATION_ROOMS.user(10);

      gateway.confirmMarkAllRead(10);

      expect(mockServer.to).toHaveBeenCalledWith(expectedRoom);
      expect(mockServerTo.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.MARK_ALL_READ,
      );
    });
  });

  describe('handleConnection / handleDisconnect', () => {
    it('handleConnection no debe lanzar excepción', () => {
      const socket: MockSocketClient = {
        id: 'socket-1',
        data: { user: { sub: 'kc-uuid' } },
      };
      expect(() => gateway.handleConnection(socket as never)).not.toThrow();
      expect(mockPresenceService.markOnline).not.toHaveBeenCalled();
    });

    it('handleConnection debe marcar online al usuario autenticado', () => {
      const socket: MockSocketClient = {
        id: 'socket-1',
        data: { user: { sub: 'kc-uuid', userId: 7 } },
      };
      gateway.handleConnection(socket as never);

      expect(mockPresenceService.markOnline).toHaveBeenCalledWith(7);
      expect(socket.data!.user_id).toBe(7);
    });

    it('handleConnection sin usuario no marca online', () => {
      const socket: MockSocketClient = { id: 'socket-1', data: {} };
      gateway.handleConnection(socket as never);

      expect(mockPresenceService.markOnline).not.toHaveBeenCalled();
    });

    it('handleDisconnect no debe lanzar excepción', () => {
      const socket: MockSocketClient = { id: 'socket-1', data: {} };
      expect(() => gateway.handleDisconnect(socket as never)).not.toThrow();
      expect(mockPresenceService.markOffline).not.toHaveBeenCalled();
    });

    it('handleDisconnect debe marcar offline al usuario', () => {
      const socket: MockSocketClient = {
        id: 'socket-1',
        data: { user_id: 10 },
      };
      gateway.handleDisconnect(socket as never);

      expect(mockPresenceService.markOffline).toHaveBeenCalledWith(10);
    });
  });

  describe('handleSubscribe', () => {
    it('debe unir al cliente a la sala del usuario', () => {
      const join = jest.fn();
      const client: MockSocketClient = {
        id: 'socket-1',
        join,
        data: { user: { userId: 10 } },
      };

      gateway.handleSubscribe({ user_id: 10 }, client as never);

      expect(join).toHaveBeenCalledWith(NOTIFICATION_ROOMS.user(10));
      expect(client.data!.user_id).toBe(10);
    });

    it('debe lanzar WsException si el user_id no coincide con el autenticado', () => {
      const join = jest.fn();
      const client: MockSocketClient = {
        id: 'socket-1',
        join,
        data: { user: { userId: 10 } },
      };

      expect(() =>
        gateway.handleSubscribe({ user_id: 99 }, client as never),
      ).toThrow(WsException);
      expect(join).not.toHaveBeenCalled();
    });

    it('debe lanzar WsException si no hay usuario autenticado', () => {
      const join = jest.fn();
      const client: MockSocketClient = {
        id: 'socket-1',
        join,
        data: {},
      };

      expect(() =>
        gateway.handleSubscribe({ user_id: 10 }, client as never),
      ).toThrow(WsException);
      expect(join).not.toHaveBeenCalled();
    });
  });

  describe('handleUnsubscribe', () => {
    it('debe sacar al cliente de la sala del usuario', () => {
      const leave = jest.fn();
      const client: MockSocketClient = {
        id: 'socket-1',
        leave,
        data: { user: { userId: 10 } },
      };

      gateway.handleUnsubscribe({ user_id: 10 }, client as never);

      expect(leave).toHaveBeenCalledWith(NOTIFICATION_ROOMS.user(10));
    });

    it('debe lanzar WsException si el user_id no coincide con el autenticado', () => {
      const leave = jest.fn();
      const client: MockSocketClient = {
        id: 'socket-1',
        leave,
        data: { user: { userId: 10 } },
      };

      expect(() =>
        gateway.handleUnsubscribe({ user_id: 99 }, client as never),
      ).toThrow(WsException);
      expect(leave).not.toHaveBeenCalled();
    });
  });

  describe('handleMarkAsRead', () => {
    it('no debe lanzar excepción al recibir el evento', () => {
      const client: MockSocketClient = { id: 'socket-1', data: {} };
      expect(() =>
        gateway.handleMarkAsRead({ notification_id: 5 }, client as never),
      ).not.toThrow();
    });
  });

  describe('handleMarkAllAsRead', () => {
    it('no debe lanzar excepción cuando el cliente tiene user_id', () => {
      const client: MockSocketClient = {
        id: 'socket-1',
        data: { user_id: 10 },
      };
      expect(() => gateway.handleMarkAllAsRead(client as never)).not.toThrow();
    });

    it('no debe lanzar excepción cuando el cliente no tiene user_id', () => {
      const client: MockSocketClient = { id: 'socket-1', data: {} };
      expect(() => gateway.handleMarkAllAsRead(client as never)).not.toThrow();
    });
  });

  describe('configuración CORS del gateway', () => {
    it('debe permitir cualquier origen', () => {
      const options = Reflect.getMetadata(
        'websockets:gateway_options',
        NotificationGateway,
      ) as {
        cors: {
          origin: (
            origin: string,
            cb: (err: Error | null, allow?: boolean) => void,
          ) => void;
        };
      };
      let errResult: Error | null = new Error('no llamado');
      let allowResult: boolean | undefined = undefined;

      options.cors.origin('http://localhost:3000', (err, allow) => {
        errResult = err;
        allowResult = allow;
      });

      expect(errResult).toBeNull();
      expect(allowResult).toBe(true);
    });
  });
});

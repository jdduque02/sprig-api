import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  Inject,
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
  forwardRef,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROOMS,
} from '../constants/notification.events';
import {
  MarkReadPayload,
  NotificationPayload,
  SubscribePayload,
} from '../interfaces/notification.interfaces';
import { WsExceptionFilter } from '../filters/ws-exception.filter';
import { AuthService } from '@auth/service/auth.service';
import { PresenceService } from '@shared/services/presence.service';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

type SocketData = {
  token?: string;
  user?: IntrospectResponse;
  user_id?: number;
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (
      origin: string,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // La validación de origen se delega a la misma configuración CORS del HTTP server
      callback(null, true);
    },
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly presenceService: PresenceService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log(
      `NotificationGateway inicializado — namespace: /notifications`,
    );

    // Middleware de autenticación: valida el token JWT con Keycloak antes de permitir conexión
    server.use((socket: Socket, next) => {
      void this.authenticateSocket(socket, next);
    });
  }

  private async authenticateSocket(
    socket: Socket,
    next: (err?: Error) => void,
  ): Promise<void> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(
        new WsException(this.i18n.t('notification.AUTH_TOKEN_REQUIRED')),
      );
    }

    try {
      const user = await this.authService.introspect(token);
      const data = this.socketData(socket);
      data.token = token;
      // Adjunta el perfil Keycloak al socket: { sub, username, email, realm_access, ... }
      data.user = user;
      next();
    } catch {
      next(new WsException(this.i18n.t('notification.AUTH_TOKEN_INVALID')));
    }
  }

  private socketData(client: Socket): SocketData {
    return client.data as SocketData;
  }

  handleConnection(client: Socket): void {
    const userId = this.socketData(client).user?.userId;
    this.logger.log(
      `Cliente conectado: ${client.id} (sub: ${this.socketData(client).user?.sub ?? 'desconocido'})`,
    );
    if (userId) {
      void this.presenceService.markOnline(userId);
      this.socketData(client).user_id = userId;
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketData(client).user_id;
    this.logger.log(`Cliente desconectado: ${client.id}`);
    if (userId) {
      void this.presenceService.markOffline(userId);
    }
  }

  // ── Eventos del cliente ─────────────────────────────────────

  /**
   * El cliente se suscribe a su sala privada de notificaciones.
   * El user_id debe coincidir con el sub del JWT para evitar suscripciones cruzadas.
   */
  @SubscribeMessage(NOTIFICATION_EVENTS.SUBSCRIBE)
  handleSubscribe(
    @MessageBody() payload: SubscribePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const authenticatedUserId = this.socketData(client).user?.userId;
    if (!authenticatedUserId || payload.user_id !== authenticatedUserId) {
      throw new WsException(this.i18n.t('notification.FORBIDDEN_SUBSCRIBE'));
    }

    const room = NOTIFICATION_ROOMS.user(payload.user_id);
    void client.join(room);
    this.socketData(client).user_id = payload.user_id;
    this.logger.log(`Cliente ${client.id} suscrito a sala ${room}`);
  }

  /**
   * El cliente abandona su sala de notificaciones.
   */
  @SubscribeMessage(NOTIFICATION_EVENTS.UNSUBSCRIBE)
  handleUnsubscribe(
    @MessageBody() payload: SubscribePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const authenticatedUserId = this.socketData(client).user?.userId;
    if (!authenticatedUserId || payload.user_id !== authenticatedUserId) {
      throw new WsException(this.i18n.t('notification.FORBIDDEN_SUBSCRIBE'));
    }

    const room = NOTIFICATION_ROOMS.user(payload.user_id);
    void client.leave(room);
    this.logger.log(`Cliente ${client.id} salió de sala ${room}`);
  }

  /**
   * El cliente marca una notificación como leída.
   * La persistencia en BD se maneja en el servicio HTTP — aquí solo se recibe el evento.
   */
  @SubscribeMessage(NOTIFICATION_EVENTS.MARK_AS_READ)
  handleMarkAsRead(
    @MessageBody() payload: MarkReadPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.debug(
      `Cliente ${client.id} marcó notificación ${payload.notification_id} como leída`,
    );
    // La persistencia real va por HTTP PATCH /notifications/:id/read
    // Este evento solo confirma recepción en tiempo real
  }

  /**
   * El cliente solicita marcar todas sus notificaciones como leídas.
   */
  @SubscribeMessage(NOTIFICATION_EVENTS.MARK_ALL_AS_READ)
  handleMarkAllAsRead(@ConnectedSocket() client: Socket): void {
    const userId = this.socketData(client).user_id;
    if (userId) {
      this.logger.debug(
        `Cliente ${client.id} solicitó marcar todo como leído (user: ${userId})`,
      );
    }
  }

  // ── Métodos de emisión (server → client) ───────────────────

  /**
   * Envía una notificación a la sala privada del usuario.
   * Invocar desde NotificationService (a través de BullMQ worker).
   */
  sendNotificationToUser(userId: number, payload: NotificationPayload): void {
    const room = NOTIFICATION_ROOMS.user(userId);
    this.server.to(room).emit(NOTIFICATION_EVENTS.NEW_NOTIFICATION, payload);
    this.logger.debug(`Notificación enviada a sala ${room}: ${payload.title}`);
  }

  /**
   * Confirma al usuario que una notificación fue marcada como leída en BD.
   */
  confirmMarkRead(userId: number, notificationId: number): void {
    const room = NOTIFICATION_ROOMS.user(userId);
    this.server
      .to(room)
      .emit(NOTIFICATION_EVENTS.MARK_READ, { notification_id: notificationId });
  }

  /**
   * Confirma al usuario que todas sus notificaciones fueron marcadas como leídas.
   */
  confirmMarkAllRead(userId: number): void {
    const room = NOTIFICATION_ROOMS.user(userId);
    this.server.to(room).emit(NOTIFICATION_EVENTS.MARK_ALL_READ);
  }

  /**
   * Emite el progreso de una carga de extractos bancarios a la sala del usuario.
   * Invocar desde StatementImportService.
   */
  sendStatementImportProgress(
    userId: number,
    payload: Record<string, unknown>,
  ): void {
    const room = NOTIFICATION_ROOMS.user(userId);
    this.server
      .to(room)
      .emit(NOTIFICATION_EVENTS.STATEMENT_IMPORT_PROGRESS, payload);
  }
}

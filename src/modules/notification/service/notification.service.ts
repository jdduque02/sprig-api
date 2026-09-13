import { Injectable } from '@nestjs/common';
import { NotificationGateway } from '../gateway/notification.gateway';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPayload } from '../interfaces/notification.interfaces';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    private readonly gateway: NotificationGateway,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  // ── CRUD REST ──────────────────────────────────────────────

  async create(
    userId: number,
    dto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.create(userId, dto);
    const payload: NotificationPayload = {
      id: notification.id,
      user_id: notification.user_id,
      title: notification.title,
      description: notification.description,
      is_read: notification.is_read,
      is_active: notification.is_active,
      scheduled_at: notification.scheduled_at,
      reference: notification.reference,
      created_at: notification.created_at,
    };
    this.gateway.sendNotificationToUser(userId, payload);
    return notification;
  }

  async findAll(
    userId: number,
    query?: NotificationQueryDto,
  ): Promise<Notification[]> {
    return this.notificationRepository.findAll(userId, {
      is_read: query?.is_read,
      is_active: query?.is_active,
    });
  }

  async findOne(id: number, userId: number): Promise<Notification> {
    return this.notificationRepository.findById(id, userId);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateNotificationDto,
  ): Promise<Notification> {
    return this.notificationRepository.update(id, userId, dto);
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.markAsRead(
      id,
      userId,
    );
    this.gateway.confirmMarkRead(userId, notification.id);
    return notification;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
    this.gateway.confirmMarkAllRead(userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    return this.notificationRepository.remove(id, userId);
  }

  // ── WebSocket helpers (invoked by other modules) ──────────

  /**
   * Crea una notificación solo si no existe otra con la misma `reference`.
   * Usado por el scheduler de recordatorios para evitar duplicados.
   */
  async createIfMissing(
    userId: number,
    dto: CreateNotificationDto,
    reference: string,
  ): Promise<Notification | null> {
    const existing = await this.notificationRepository.findByReference(
      userId,
      reference,
    );
    if (existing) return null;
    return this.create(userId, { ...dto, reference });
  }

  sendToUser(userId: number, payload: NotificationPayload): void {
    this.gateway.sendNotificationToUser(userId, payload);
  }

  confirmMarkRead(userId: number, notificationId: number): void {
    this.gateway.confirmMarkRead(userId, notificationId);
  }

  confirmMarkAllRead(userId: number): void {
    this.gateway.confirmMarkAllRead(userId);
  }

  sendStatementImportProgress(
    userId: number,
    payload: Record<string, unknown>,
  ): void {
    this.gateway.sendStatementImportProgress(userId, payload);
  }
}

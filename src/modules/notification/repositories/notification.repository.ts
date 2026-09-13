import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';

@Injectable()
export class NotificationRepository {
  private readonly logger = new Logger(NotificationRepository.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.repo.create({
      user_id: userId,
      title: dto.title,
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      scheduled_at: dto.scheduled_at ?? null,
      reference: dto.reference ?? null,
    });
    const saved = await this.repo.save(notification);
    this.logger.log(`Notificación creada para usuario ID: ${userId}`);
    return saved;
  }

  async findByReference(
    userId: number,
    reference: string,
  ): Promise<Notification | null> {
    return this.repo.findOne({ where: { user_id: userId, reference } });
  }

  async findAll(
    userId: number,
    filters?: { is_read?: boolean; is_active?: boolean },
  ): Promise<Notification[]> {
    const where: Record<string, any> = { user_id: userId };
    if (filters?.is_read !== undefined) where.is_read = filters.is_read;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async findById(id: number, userId: number): Promise<Notification> {
    const notification = await this.repo.findOne({
      where: { id, user_id: userId },
    });
    if (!notification)
      throw new NotFoundException(
        this.i18n.t('notification.NOT_FOUND', { args: { id } }),
      );
    return notification;
  }

  async update(
    id: number,
    userId: number,
    dto: Partial<Notification>,
  ): Promise<Notification> {
    const notification = await this.findById(id, userId);
    const updated = this.repo.merge(notification, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(
      `Notificación ID ${id} actualizada para usuario ID: ${userId}`,
    );
    return saved;
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    const notification = await this.findById(id, userId);
    notification.is_read = true;
    const saved = await this.repo.save(notification);
    this.logger.log(
      `Notificación ID ${id} marcada como leída para usuario ID: ${userId}`,
    );
    return saved;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.repo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    this.logger.log(
      `Todas las notificaciones marcadas como leídas para usuario ID: ${userId}`,
    );
  }

  async remove(id: number, userId: number): Promise<void> {
    const notification = await this.findById(id, userId);
    await this.repo.remove(notification);
    this.logger.log(
      `Notificación ID ${id} eliminada para usuario ID: ${userId}`,
    );
  }
}

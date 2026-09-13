import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import { SupportRequest } from '@support/entities/support-request.entity';
import { CreateSupportRequestDto } from '@support/dto/support-request/create-support-request.dto';
import { UpdateSupportRequestDto } from '@support/dto/support-request/update-support-request.dto';

@Injectable()
export class SupportRequestRepository {
  private readonly logger = new Logger(SupportRequestRepository.name);

  constructor(
    @InjectRepository(SupportRequest)
    private readonly repo: Repository<SupportRequest>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateSupportRequestDto,
  ): Promise<SupportRequest> {
    const request = this.repo.create({ ...dto, user_id: userId });
    const saved = await this.repo.save(request);
    this.logger.log(`Solicitud de soporte ID ${saved.id} creada.`);
    return saved;
  }

  async findByUser(userId: number): Promise<SupportRequest[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findByIdAndUser(id: number, userId: number): Promise<SupportRequest> {
    const request = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!request)
      throw new NotFoundException(
        this.i18n.t('support.SUPPORT_REQUEST_NOT_FOUND', { args: { id } }),
      );
    return request;
  }

  async findAllAdmin(): Promise<SupportRequest[]> {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findByIdAdmin(id: number): Promise<SupportRequest> {
    const request = await this.repo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!request)
      throw new NotFoundException(
        this.i18n.t('support.SUPPORT_REQUEST_NOT_FOUND', { args: { id } }),
      );
    return request;
  }

  async updateAdmin(
    id: number,
    dto: UpdateSupportRequestDto,
  ): Promise<SupportRequest> {
    const request = await this.findByIdAdmin(id);
    const updated = this.repo.merge(request, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(`Solicitud de soporte ID ${id} actualizada por admin.`);
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const request = await this.findByIdAndUser(id, userId);
    await this.repo.softRemove(request);
    this.logger.log(`Solicitud de soporte ID ${id} eliminada.`);
  }
}

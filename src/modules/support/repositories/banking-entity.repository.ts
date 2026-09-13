import {
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { BankingEntity } from '@support/entities/banking-entity.entity';
import { CreateBankingEntityDto } from '@support/dto/banking-entity/create-banking-entity.dto';
import { UpdateBankingEntityDto } from '@support/dto/banking-entity/update-banking-entity.dto';
import { BankingEntityDetection } from '@finance/service/bank-statement-parser';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BankingEntityRepository {
  private readonly logger = new Logger(BankingEntityRepository.name);

  constructor(
    @InjectRepository(BankingEntity)
    private readonly repo: Repository<BankingEntity>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateBankingEntityDto): Promise<BankingEntity> {
    try {
      const entity = this.repo.create({
        code: dto.code,
        name: dto.name,
        is_active: dto.is_active ?? true,
        detect_patterns: dto.detect_patterns ?? [],
      });
      const saved = await this.repo.save(entity);
      this.logger.log(
        `Entidad bancaria creada: ${saved.code} (ID: ${saved.id})`,
      );
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async findActive(): Promise<BankingEntity[]> {
    return this.repo.find({
      where: { is_active: true, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findAll(): Promise<BankingEntity[]> {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<BankingEntity> {
    const entity = await this.repo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!entity)
      throw new NotFoundException(
        this.i18n.t('support.BANKING_ENTITY_NOT_FOUND', { args: { id } }),
      );
    return entity;
  }

  async update(
    id: number,
    dto: UpdateBankingEntityDto,
  ): Promise<BankingEntity> {
    const entity = await this.findById(id);
    const updated = this.repo.merge(entity, dto);
    try {
      const saved = await this.repo.save(updated);
      this.logger.log(`Entidad bancaria ID ${id} actualizada.`);
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async softDelete(id: number): Promise<void> {
    const entity = await this.findById(id);
    entity.is_active = false;
    // `save()` solo desactivaba (is_active=false) sin tocar `deleted_at`,
    // así que `findById`/`findAll` (que sí filtran por `deleted_at IS NULL`)
    // seguían devolviendo la entidad "eliminada". `softRemove` persiste el
    // cambio de `is_active` y además marca `deleted_at`.
    await this.repo.softRemove(entity);
    this.logger.log(`Entidad bancaria ID ${id} eliminada (soft delete).`);
  }

  /**
   * Entidades activas listas para alimentar la detección del parser de
   * extractos. Devuelve solo los campos necesarios (estructura compatible
   * con `BankingEntityDetection`).
   */
  async findActiveDetections(): Promise<BankingEntityDetection[]> {
    const entities = await this.findActive();
    return entities.map((entity) => ({
      code: entity.code,
      detect_patterns: entity.detect_patterns ?? [],
    }));
  }

  private handleDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(
        this.i18n.t('support.BANKING_ENTITY_CODE_EXISTS'),
      );
    }
    this.logger.error(`Error de base de datos: ${(error as Error).message}`);
    throw new InternalServerErrorException(
      this.i18n.t('support.PROCESSING_ERROR'),
    );
  }
}

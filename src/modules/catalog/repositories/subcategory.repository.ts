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
import { QueryFailedError, Repository } from 'typeorm';
import { Subcategory } from '@catalog/entities/subcategory.entity';
import { CreateSubcategoryDto } from '@catalog/dto/subcategory/create-subcategory.dto';
import { UpdateSubcategoryDto } from '@catalog/dto/subcategory/update-subcategory.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class SubcategoryRepository {
  private readonly logger = new Logger(SubcategoryRepository.name);

  constructor(
    @InjectRepository(Subcategory)
    private readonly repo: Repository<Subcategory>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    try {
      const subcategory = this.repo.create({ ...dto, user_id: userId });
      const saved = await this.repo.save(subcategory);
      this.logger.log(
        `Subcategoría creada: ${saved.name} (ID: ${saved.id}) para usuario ID: ${userId}`,
      );
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async findAll(userId: number, categoryId?: number): Promise<Subcategory[]> {
    const where: Record<string, unknown> = { user_id: userId, is_active: true };
    if (categoryId) where.category_id = categoryId;
    return this.repo.find({ where: where, order: { name: 'ASC' } });
  }

  async findById(id: number, userId: number): Promise<Subcategory> {
    const subcategory = await this.repo.findOne({
      where: { id, user_id: userId, is_active: true },
    });
    if (!subcategory)
      throw new NotFoundException(
        this.i18n.t('catalog.SUBCATEGORY_NOT_FOUND', { args: { id } }),
      );
    return subcategory;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateSubcategoryDto,
  ): Promise<Subcategory> {
    const subcategory = await this.findById(id, userId);
    const updated = this.repo.merge(subcategory, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(
      `Subcategoría ID ${id} actualizada para usuario ID: ${userId}`,
    );
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const subcategory = await this.findById(id, userId);
    subcategory.is_active = false;
    await this.repo.save(subcategory);
    this.logger.log(
      `Subcategoría ID ${id} desactivada para usuario ID: ${userId}`,
    );
  }

  private handleDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(this.i18n.t('catalog.SUBCATEGORY_DUPLICATE'));
    }
    this.logger.error(`Error de base de datos: ${(error as Error).message}`);
    throw new InternalServerErrorException(
      this.i18n.t('catalog.PROCESSING_ERROR'),
    );
  }
}

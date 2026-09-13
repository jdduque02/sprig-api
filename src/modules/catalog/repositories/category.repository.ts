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
import { Category } from '@catalog/entities/category.entity';
import { CreateCategoryDto } from '@catalog/dto/category/create-category.dto';
import { UpdateCategoryDto } from '@catalog/dto/category/update-category.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class CategoryRepository {
  private readonly logger = new Logger(CategoryRepository.name);

  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      const category = this.repo.create(dto);
      const saved = await this.repo.save(category);
      this.logger.log(`Categoría creada: ${saved.name} (ID: ${saved.id})`);
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async findAll(): Promise<Category[]> {
    return this.repo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', name: 'ASC' },
      relations: { subcategories: false },
      cache: { id: 'categories:active', milliseconds: 60_000 },
    });
  }

  async findById(id: number): Promise<Category> {
    const category = await this.repo.findOne({
      where: { id, is_active: true },
    });
    if (!category)
      throw new NotFoundException(
        this.i18n.t('catalog.CATEGORY_NOT_FOUND', { args: { id } }),
      );
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findById(id);
    const updated = this.repo.merge(category, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(`Categoría ID ${id} actualizada.`);
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    const category = await this.findById(id);
    category.is_active = false;
    await this.repo.save(category);
    this.logger.log(`Categoría ID ${id} desactivada.`);
  }

  private handleDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(this.i18n.t('catalog.CATEGORY_DUPLICATE'));
    }
    this.logger.error(`Error de base de datos: ${(error as Error).message}`);
    throw new InternalServerErrorException(
      this.i18n.t('catalog.PROCESSING_ERROR'),
    );
  }
}

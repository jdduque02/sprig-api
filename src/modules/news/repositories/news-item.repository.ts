import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { NewsItem } from '@news/entities/news-item.entity';
import { NewsQueryDto } from '@news/dto/news-query.dto';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';
import { UpdateNewsItemDto } from '@news/dto/update-news-item.dto';

@Injectable()
export class NewsItemRepository {
  private readonly logger = new Logger(NewsItemRepository.name);

  constructor(
    @InjectRepository(NewsItem)
    private readonly repo: Repository<NewsItem>,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateNewsItemDto): Promise<NewsItem> {
    const entity = this.repo.create({
      ...dto,
      published_at: dto.published_at ? new Date(dto.published_at) : null,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Noticia creada ID: ${saved.id}`);
    return saved;
  }

  async findAll(query: NewsQueryDto): Promise<NewsItem[]> {
    const { limit = 10, category, search } = query;

    const qb = this.repo.createQueryBuilder('n');

    if (category) {
      qb.andWhere('n.category = :category', { category });
    }

    if (search) {
      qb.andWhere('(n.title ILIKE :search OR n.summary ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.andWhere('n.deleted_at IS NULL')
      .orderBy('n.published_at', 'DESC')
      .addOrderBy('n.created_at', 'DESC')
      .take(limit)
      .cache(`news:list:${category ?? ''}:${search ?? ''}:${limit}`, 45_000);

    const results = await qb.getMany();
    this.logger.debug(`NewsItem: ${results.length} noticias encontradas`);
    return results;
  }

  async findById(id: number): Promise<NewsItem> {
    const item = await this.repo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(
        this.i18n.t('news.NOT_FOUND', { args: { id } }),
      );
    }
    return item;
  }

  async update(id: number, dto: UpdateNewsItemDto): Promise<NewsItem> {
    const item = await this.findById(id);
    const payload: Record<string, any> = { ...dto };
    if (dto.published_at !== undefined) {
      payload.published_at = dto.published_at
        ? new Date(dto.published_at)
        : null;
    }
    Object.assign(item, payload);
    const saved = await this.repo.save(item);
    this.logger.log(`Noticia actualizada ID: ${id}`);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const item = await this.findById(id);
    await this.repo.softRemove(item);
    this.logger.log(`Noticia eliminada (soft delete) ID: ${id}`);
  }
}

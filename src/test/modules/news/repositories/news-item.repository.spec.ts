import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NewsItemRepository } from '@news/repositories/news-item.repository';
import { NewsItem } from '@news/entities/news-item.entity';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  cache: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockTypeOrmRepo = {
  create: jest.fn((e: Partial<NewsItem>) => e),
  save: jest.fn((e: NewsItem) => ({ ...e, id: 1 })),
  findOne: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQb),
};

const mockI18n = {
  t: jest.fn((key: string) => key),
};

describe('NewsItemRepository', () => {
  let repository: NewsItemRepository;

  beforeEach(() => {
    repository = new NewsItemRepository(
      mockTypeOrmRepo as never,
      mockI18n as unknown as I18nService,
    );
    jest.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);
    Object.values(mockQb).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReturnThis' in fn) {
        fn.mockReturnThis();
      }
    });
  });

  it('create persiste la noticia', async () => {
    const dto: CreateNewsItemDto = {
      title: 'T',
      summary: 'S',
      published_at: '2026-07-26T10:00:00.000Z',
    };
    const result = await repository.create(dto);
    expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
      ...dto,
      published_at: new Date(dto.published_at as string),
    });
    expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    expect(result.id).toBe(1);
  });

  it('create guarda published_at null si no se provee', async () => {
    await repository.create({ title: 'Sin fecha', summary: 'S' });

    expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
      title: 'Sin fecha',
      summary: 'S',
      published_at: null,
    });
  });

  it('findAll aplica filtros de categoría y búsqueda', async () => {
    mockQb.getMany.mockResolvedValue([{ id: 1 }]);
    const result = await repository.findAll({
      limit: 5,
      category: 'Economía',
      search: 'tasa',
    });
    expect(mockQb.andWhere).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('findAll sin filtros solo aplica el andWhere de deleted_at y usa cache con valores vacíos', async () => {
    mockQb.getMany.mockResolvedValue([]);
    const result = await repository.findAll({});
    expect(mockQb.andWhere).toHaveBeenCalledTimes(1);
    expect(mockQb.andWhere).toHaveBeenCalledWith('n.deleted_at IS NULL');
    expect(mockQb.cache).toHaveBeenCalledWith(`news:list:::10`, 45_000);
    expect(result).toEqual([]);
  });

  it('findById lanza NotFoundException si no existe', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue(null);
    await expect(repository.findById(99)).rejects.toThrow(NotFoundException);
  });

  it('findById retorna la entidad', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({ id: 2, title: 'X' });
    await expect(repository.findById(2)).resolves.toEqual({
      id: 2,
      title: 'X',
    });
  });

  it('update modifica y guarda', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({
      id: 2,
      title: 'Old',
      summary: 'S',
    });
    mockTypeOrmRepo.save.mockImplementation((e: NewsItem) => e);
    const result = await repository.update(2, { title: 'New' });
    expect(result.title).toBe('New');
  });

  it('update convierte published_at en Date cuando se provee', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({
      id: 2,
      title: 'Old',
      published_at: null,
    });
    mockTypeOrmRepo.save.mockImplementation((e: NewsItem) => e);
    const result = await repository.update(2, {
      published_at: '2026-08-01T09:00:00.000Z',
    });
    expect(result.published_at).toEqual(new Date('2026-08-01T09:00:00.000Z'));
  });

  it('update setea published_at null si el dto lo trae nulo', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue({
      id: 2,
      title: 'Old',
      published_at: new Date(),
    });
    mockTypeOrmRepo.save.mockImplementation((e: NewsItem) => e);
    const result = await repository.update(2, { published_at: null });
    expect(result.published_at).toBeNull();
  });

  it('remove hace soft delete de la entidad', async () => {
    const item = { id: 3, title: 'T' };
    mockTypeOrmRepo.findOne.mockResolvedValue(item);
    await repository.remove(3);
    expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(item);
  });
});

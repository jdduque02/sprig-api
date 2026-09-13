import { NotFoundException } from '@nestjs/common';
import { NewsItemController } from '@news/controller/news-item.controller';
import { NewsItemService } from '@news/service/news-item.service';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';
import { UpdateNewsItemDto } from '@news/dto/update-news-item.dto';

const mockNewsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const buildNews = (overrides = {}) => ({
  id: 1,
  title: 'Título',
  summary: 'Resumen',
  content: null,
  category: 'Economía',
  image_url: null,
  link: null,
  published_at: new Date('2026-07-26T10:00:00.000Z'),
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('NewsItemController', () => {
  let controller: NewsItemController;

  beforeEach(() => {
    controller = new NewsItemController(
      mockNewsService as unknown as NewsItemService,
    );
    jest.clearAllMocks();
  });

  it('debe crear noticia delegando al servicio', async () => {
    const dto: CreateNewsItemDto = {
      title: 'Título',
      summary: 'Resumen',
    };
    const created = buildNews();
    mockNewsService.create.mockResolvedValue(created);

    const result = await controller.create(dto);
    expect(mockNewsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('debe listar noticias con el query', async () => {
    const list = [buildNews()];
    mockNewsService.findAll.mockResolvedValue(list);

    const result = await controller.findAll({ limit: 5 });
    expect(mockNewsService.findAll).toHaveBeenCalledWith({ limit: 5 });
    expect(result).toEqual(list);
  });

  it('debe obtener noticia por id', async () => {
    const item = buildNews({ id: 9 });
    mockNewsService.findById.mockResolvedValue(item);

    const result = await controller.findById(9);
    expect(mockNewsService.findById).toHaveBeenCalledWith(9);
    expect(result).toEqual(item);
  });

  it('debe actualizar noticia', async () => {
    const dto: UpdateNewsItemDto = { title: 'Nuevo' };
    const updated = buildNews({ title: 'Nuevo' });
    mockNewsService.update.mockResolvedValue(updated);

    const result = await controller.update(1, dto);
    expect(mockNewsService.update).toHaveBeenCalledWith(1, dto);
    expect(result).toEqual(updated);
  });

  it('debe eliminar noticia', async () => {
    mockNewsService.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(mockNewsService.remove).toHaveBeenCalledWith(1);
  });

  it('propaga NotFoundException', async () => {
    mockNewsService.findById.mockRejectedValue(new NotFoundException());
    await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
  });
});

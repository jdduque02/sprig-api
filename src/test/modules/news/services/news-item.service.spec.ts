import { NewsItemService } from '@news/service/news-item.service';
import { NewsItemRepository } from '@news/repositories/news-item.repository';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';
import { UpdateNewsItemDto } from '@news/dto/update-news-item.dto';

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('NewsItemService', () => {
  let service: NewsItemService;

  beforeEach(() => {
    service = new NewsItemService(mockRepo as unknown as NewsItemRepository);
    jest.clearAllMocks();
  });

  it('create delega al repositorio', async () => {
    const dto: CreateNewsItemDto = { title: 'T', summary: 'S' };
    mockRepo.create.mockResolvedValue({ id: 1, ...dto });
    await expect(service.create(dto)).resolves.toEqual({ id: 1, ...dto });
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega al repositorio', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    await expect(service.findAll({ limit: 10 })).resolves.toEqual([]);
    expect(mockRepo.findAll).toHaveBeenCalledWith({ limit: 10 });
  });

  it('findById delega al repositorio', async () => {
    mockRepo.findById.mockResolvedValue({ id: 2 });
    await expect(service.findById(2)).resolves.toEqual({ id: 2 });
  });

  it('update delega al repositorio', async () => {
    const dto: UpdateNewsItemDto = { title: 'X' };
    mockRepo.update.mockResolvedValue({ id: 2, title: 'X' });
    await expect(service.update(2, dto)).resolves.toEqual({
      id: 2,
      title: 'X',
    });
  });

  it('remove delega al repositorio', async () => {
    mockRepo.remove.mockResolvedValue(undefined);
    await service.remove(3);
    expect(mockRepo.remove).toHaveBeenCalledWith(3);
  });
});

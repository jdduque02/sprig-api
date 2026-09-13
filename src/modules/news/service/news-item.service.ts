import { Injectable, Logger } from '@nestjs/common';
import { NewsItemRepository } from '@news/repositories/news-item.repository';
import { NewsQueryDto } from '@news/dto/news-query.dto';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';
import { UpdateNewsItemDto } from '@news/dto/update-news-item.dto';

@Injectable()
export class NewsItemService {
  private readonly logger = new Logger(NewsItemService.name);

  constructor(private readonly newsItemRepository: NewsItemRepository) {}

  async create(dto: CreateNewsItemDto) {
    return this.newsItemRepository.create(dto);
  }

  async findAll(query: NewsQueryDto) {
    return this.newsItemRepository.findAll(query);
  }

  async findById(id: number) {
    return this.newsItemRepository.findById(id);
  }

  async update(id: number, dto: UpdateNewsItemDto) {
    return this.newsItemRepository.update(id, dto);
  }

  async remove(id: number) {
    return this.newsItemRepository.remove(id);
  }
}

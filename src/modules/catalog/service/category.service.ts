import { Injectable, Logger } from '@nestjs/common';
import { CategoryRepository } from '@catalog/repositories/category.repository';
import { CreateCategoryDto } from '@catalog/dto/category/create-category.dto';
import { UpdateCategoryDto } from '@catalog/dto/category/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly categoryRepository: CategoryRepository) {}

  async create(dto: CreateCategoryDto) {
    return this.categoryRepository.create(dto);
  }

  async findAll() {
    return this.categoryRepository.findAll();
  }

  async findOne(id: number) {
    return this.categoryRepository.findById(id);
  }

  async update(id: number, dto: UpdateCategoryDto) {
    return this.categoryRepository.update(id, dto);
  }

  async remove(id: number) {
    return this.categoryRepository.softDelete(id);
  }
}

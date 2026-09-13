import { Injectable, Logger } from '@nestjs/common';
import { SubcategoryRepository } from '@catalog/repositories/subcategory.repository';
import { CreateSubcategoryDto } from '@catalog/dto/subcategory/create-subcategory.dto';
import { UpdateSubcategoryDto } from '@catalog/dto/subcategory/update-subcategory.dto';

@Injectable()
export class SubcategoryService {
  private readonly logger = new Logger(SubcategoryService.name);

  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async create(userId: number, dto: CreateSubcategoryDto) {
    return this.subcategoryRepository.create(userId, dto);
  }

  async findAll(userId: number, categoryId?: number) {
    return this.subcategoryRepository.findAll(userId, categoryId);
  }

  async findOne(id: number, userId: number) {
    return this.subcategoryRepository.findById(id, userId);
  }

  async update(id: number, userId: number, dto: UpdateSubcategoryDto) {
    return this.subcategoryRepository.update(id, userId, dto);
  }

  async remove(id: number, userId: number) {
    return this.subcategoryRepository.softDelete(id, userId);
  }
}

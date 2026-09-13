import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CategoryController } from './controller/category.controller';
import { SubcategoryController } from './controller/subcategory.controller';
import { CategoryService } from './service/category.service';
import { SubcategoryService } from './service/subcategory.service';
import { CategoryRepository } from './repositories/category.repository';
import { SubcategoryRepository } from './repositories/subcategory.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory]), AuthModule],
  controllers: [CategoryController, SubcategoryController],
  providers: [
    CategoryService,
    SubcategoryService,
    CategoryRepository,
    SubcategoryRepository,
  ],
  exports: [CategoryService, SubcategoryService],
})
export class CatalogModule {}

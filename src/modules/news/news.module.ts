import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NewsItem } from './entities/news-item.entity';
import { NewsItemController } from './controller/news-item.controller';
import { NewsItemService } from './service/news-item.service';
import { NewsItemRepository } from './repositories/news-item.repository';

@Module({
  imports: [TypeOrmModule.forFeature([NewsItem]), AuthModule],
  controllers: [NewsItemController],
  providers: [NewsItemService, NewsItemRepository],
  exports: [NewsItemService],
})
export class NewsModule {}

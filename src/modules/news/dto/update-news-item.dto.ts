import { PartialType } from '@nestjs/swagger';
import { CreateNewsItemDto } from './create-news-item.dto';

export class UpdateNewsItemDto extends PartialType(CreateNewsItemDto) {}

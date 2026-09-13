import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSubcategoryDto } from './create-subcategory.dto';

export class UpdateSubcategoryDto extends PartialType(
  OmitType(CreateSubcategoryDto, ['category_id'] as const),
) {}

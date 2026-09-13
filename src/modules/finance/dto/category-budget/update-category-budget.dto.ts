import { PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCategoryBudgetDto } from './create-category-budget.dto';

export class UpdateCategoryBudgetDto extends PartialType(
  OmitType(CreateCategoryBudgetDto, ['year', 'month'] as const),
) {
  @ApiPropertyOptional({ description: 'Activa/desactiva el presupuesto.' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCategoryBudgetDto {
  @ApiProperty({ description: 'Categoría presupuestada.', example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  category_id!: number;

  @ApiPropertyOptional({
    description: 'Subcategoría presupuestada (opcional).',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  subcategory_id?: number;

  @ApiProperty({ description: 'Año del período.', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ description: 'Mes del período (1-12).', example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    description: 'Monto límite del presupuesto, definido manualmente.',
    example: 500000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  limit_amount!: number;

  @ApiPropertyOptional({
    enum: ['COP', 'USD'],
    default: 'COP',
    example: 'COP',
  })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description:
      'Umbral (%) a partir del cual se genera la alerta de acercamiento.',
    default: 80,
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  alert_threshold_percent?: number;
}

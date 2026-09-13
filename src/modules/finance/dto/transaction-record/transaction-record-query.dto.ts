import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReviewStatusEnum, TransactionTypeEnum } from '@shared/enums';

export class TransactionRecordQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  category_id?: number;

  @ApiPropertyOptional({ enum: ReviewStatusEnum })
  @IsOptional()
  @IsEnum(ReviewStatusEnum)
  category_status?: ReviewStatusEnum;

  @ApiPropertyOptional({
    description: 'Solo transacciones pendientes por categorizar (por editar).',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  uncategorized?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  subcategory_id?: number;

  @ApiPropertyOptional({ enum: TransactionTypeEnum })
  @IsOptional()
  @IsEnum(TransactionTypeEnum)
  type?: TransactionTypeEnum;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha inicio (ISO 8601). Filtra por transaction_date.',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha fin.' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 3,
    description: 'Filtrar por meta asociada.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  objective_id?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar por cuenta bancaria asociada.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  account_id?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Filtrar por activo financiero asociado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  asset_id?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar por pasivo asociado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  liability_id?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Filtrar por empresa/comercio asociada.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  company_id?: number;

  @ApiPropertyOptional({
    enum: ['COP', 'USD'],
    description: 'Filtrar por moneda.',
    example: 'COP',
  })
  @IsOptional()
  currency?: string;
}

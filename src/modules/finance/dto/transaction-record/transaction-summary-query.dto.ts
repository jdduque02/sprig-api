import { IsDateString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionTypeEnum } from '@shared/enums';

export class TransactionSummaryQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha inicio (ISO 8601). Filtra por transaction_date.',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha fin (ISO 8601).',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    description: 'Granularidad de la serie del resumen.',
    example: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  group_by?: 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({ enum: TransactionTypeEnum })
  @IsOptional()
  @IsEnum(TransactionTypeEnum)
  type?: TransactionTypeEnum;

  @ApiPropertyOptional({
    enum: ['COP', 'USD'],
    description: 'Filtrar por moneda.',
    example: 'COP',
  })
  @IsOptional()
  currency?: string;
}

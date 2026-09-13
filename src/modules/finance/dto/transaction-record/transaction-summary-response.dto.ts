import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionTotalsDto {
  @ApiProperty({ example: 5000000 })
  income!: number;

  @ApiProperty({ example: 3200000 })
  expenses!: number;

  @ApiProperty({ example: 500000 })
  investments!: number;

  @ApiProperty({ example: 45 })
  count!: number;

  @ApiPropertyOptional({ example: 'COP', nullable: true })
  currency?: string | null;
}

export class TransactionCategorySummaryDto {
  @ApiProperty({ example: 1 })
  category_id!: number;

  @ApiProperty({ example: 0 })
  income!: number;

  @ApiProperty({ example: 2400000 })
  expenses!: number;

  @ApiProperty({ example: 0 })
  investments!: number;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class TransactionSeriesItemDto {
  @ApiProperty({ example: '2026-08-03' })
  key!: string;

  @ApiProperty({ example: '3 ago' })
  label!: string;

  @ApiProperty({ example: 0 })
  income!: number;

  @ApiProperty({ example: 85000 })
  expenses!: number;

  @ApiProperty({ example: 0 })
  investments!: number;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class TransactionCompanySummaryDto {
  @ApiProperty({ example: 1 })
  company_id!: number;

  @ApiPropertyOptional({ example: 'Netflix', nullable: true })
  company_name!: string | null;

  @ApiProperty({ example: 2400000 })
  expenses!: number;

  @ApiProperty({ example: 12 })
  count!: number;

  @ApiProperty({ example: 35.5 })
  percent_of_total!: number;
}

export class TransactionSummaryResponseDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  date_to?: string;

  @ApiProperty({ enum: ['day', 'week', 'month'], example: 'day' })
  group_by!: 'day' | 'week' | 'month';

  @ApiProperty({ type: TransactionTotalsDto })
  totals!: TransactionTotalsDto;

  @ApiProperty({ type: [TransactionCategorySummaryDto] })
  by_category!: TransactionCategorySummaryDto[];

  @ApiProperty({ type: [TransactionSeriesItemDto] })
  series!: TransactionSeriesItemDto[];

  @ApiPropertyOptional({ type: [TransactionCompanySummaryDto] })
  by_company?: TransactionCompanySummaryDto[];
}

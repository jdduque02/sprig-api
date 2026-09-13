import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryBudgetResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 3 })
  category_id!: number;

  @ApiPropertyOptional({ example: 12, nullable: true })
  subcategory_id!: number | null;

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: 4 })
  month!: number;

  @ApiProperty({ example: 500000 })
  limit_amount!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ example: 80 })
  alert_threshold_percent!: number;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({
    description: 'Gasto acumulado en la categoría/periodo hasta la fecha.',
    example: 410000,
  })
  spent_amount!: number;

  @ApiProperty({
    description: 'Porcentaje de uso del presupuesto (spent/limit * 100).',
    example: 82,
  })
  percent_used!: number;

  @ApiProperty({
    enum: ['ok', 'warning', 'exceeded'],
    description:
      'ok: por debajo del umbral. warning: >= umbral y < 100%. ' +
      'exceeded: >= 100% del límite.',
    example: 'warning',
  })
  status!: 'ok' | 'warning' | 'exceeded';

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

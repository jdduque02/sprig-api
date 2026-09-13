import { ApiProperty } from '@nestjs/swagger';

export class FinancialInsightDto {
  @ApiProperty({ example: 'overspending' })
  type!: string;

  @ApiProperty({
    example: 'medium',
    enum: ['low', 'medium', 'high', 'critical'],
  })
  severity!: string;

  @ApiProperty({ example: 'Gasto excesivo en entretenimiento' })
  message!: string;

  @ApiProperty({ example: 5, nullable: true })
  category_id?: number;

  @ApiProperty({ example: 'Reducir gastos en suscripciones', nullable: true })
  suggested_action?: string;
}

export class FinancialSummaryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 1 })
  financial_period_id!: number;

  @ApiProperty({ example: 5000000 })
  total_income!: number;

  @ApiProperty({ example: 3200000 })
  total_expense!: number;

  @ApiProperty({ example: 1800000 })
  total_debt!: number;

  @ApiProperty({ example: 15000000 })
  net_worth!: number;

  @ApiProperty({ example: 64.0, nullable: true })
  expense_ratio!: number | null;

  @ApiProperty({ example: 36.0, nullable: true })
  debt_ratio!: number | null;

  @ApiProperty({ example: 36.0, nullable: true })
  savings_rate!: number | null;

  @ApiProperty({ example: 2500000, nullable: true })
  recommended_max_expense!: number | null;

  @ApiProperty({ example: 1000000, nullable: true })
  recommended_savings!: number | null;

  @ApiProperty({ example: false })
  is_over_spending!: boolean;

  @ApiProperty({ example: false })
  is_over_indebted!: boolean;

  @ApiProperty({ type: [FinancialInsightDto], nullable: true })
  insights!: FinancialInsightDto[];

  @ApiProperty({ example: '2026-07-20T12:00:00.000Z', nullable: true })
  calculated_at!: Date | null;

  @ApiProperty({ example: false })
  is_final!: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialObjectiveTypeEnum, FrequencyEnum } from '@shared/enums';

export class FinancialObjectiveResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  category_id!: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  subcategory_id!: number | null;

  @ApiProperty({ example: 'Fondo de emergencia' })
  name!: string;

  @ApiProperty({ enum: FinancialObjectiveTypeEnum })
  type!: FinancialObjectiveTypeEnum;

  @ApiPropertyOptional({
    example: 10000000,
    nullable: true,
  })
  target_amount!: number | null;

  @ApiProperty({ example: 0 })
  current_balance!: number;

  @ApiPropertyOptional({ example: 5.5, nullable: true })
  interest_rate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  fees!: number | null;

  @ApiPropertyOptional({ nullable: true })
  monthly_payment!: number | null;

  @ApiPropertyOptional({ nullable: true })
  owner!: string | null;

  @ApiPropertyOptional({ example: 'Bancolombia', nullable: true })
  bank!: string | null;

  @ApiPropertyOptional({ example: 5.5, nullable: true })
  current_profitability!: number | null;

  @ApiPropertyOptional({
    description: 'Cuenta bancaria vinculada a la meta.',
    example: 1,
    nullable: true,
  })
  account_id!: number | null;

  @ApiPropertyOptional({ enum: FrequencyEnum, nullable: true })
  frequency!: FrequencyEnum | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  due_day!: number | null;

  @ApiPropertyOptional({ nullable: true })
  start_date!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  end_date!: Date | null;

  @ApiProperty({ example: false })
  is_completed!: boolean;

  @ApiPropertyOptional({
    description:
      'Monto restante por ahorrar (target - current, mínimo 0). null si no hay monto objetivo.',
    example: 9800000,
    nullable: true,
  })
  amount_remaining!: number | null;

  @ApiPropertyOptional({
    description:
      'Porcentaje de avance hacia la meta (0-100). null si no hay monto objetivo.',
    example: 2,
    nullable: true,
  })
  progress_percent!: number | null;

  @ApiPropertyOptional({
    description:
      'Días calendario restantes hasta end_date (0 si venció o no hay fecha).',
    example: 345,
    nullable: true,
  })
  days_remaining!: number | null;

  @ApiPropertyOptional({
    description: 'Referencia del cálculo de cuota usado al crear la meta.',
    nullable: true,
  })
  quota_calculation!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  completed_at!: Date | null;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

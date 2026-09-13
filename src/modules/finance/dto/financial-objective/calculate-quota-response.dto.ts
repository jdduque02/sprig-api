import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FrequencyEnum } from '@shared/enums';

export class CalculateQuotaResponseDto {
  @ApiPropertyOptional({
    description: 'Monto objetivo de la meta.',
    example: 10000000,
    nullable: true,
  })
  target_amount!: number | null;

  @ApiProperty({ description: 'Saldo actual ahorrado.', example: 0 })
  current_balance!: number;

  @ApiPropertyOptional({
    description: 'Monto restante por ahorrar.',
    example: 10000000,
    nullable: true,
  })
  amount_to_save!: number | null;

  @ApiProperty({
    description: 'Fecha de inicio del plan.',
    example: '2026-01-01',
  })
  start_date!: string;

  @ApiPropertyOptional({
    description: 'Fecha límite de la meta.',
    example: '2027-12-31',
    nullable: true,
  })
  end_date!: string | null;

  @ApiProperty({
    enum: FrequencyEnum,
    description: 'Frecuencia de cuotas.',
    example: FrequencyEnum.MONTHLY,
  })
  frequency!: FrequencyEnum;

  @ApiProperty({ description: 'Número total de cuotas.', example: 24 })
  total_periods!: number;

  @ApiProperty({ description: 'Días totales del período.', example: 730 })
  days_in_period!: number;

  @ApiProperty({ description: 'Monto de cada cuota.', example: 416666.67 })
  quota_amount!: number;

  @ApiPropertyOptional({
    description: 'Ingreso mensual del usuario (descifrado).',
    example: 3500000,
    nullable: true,
  })
  monthly_income!: number | null;

  @ApiProperty({
    description: 'Porcentaje de ahorro del perfil financiero.',
    example: 20,
  })
  savings_ratio!: number;

  @ApiPropertyOptional({
    description: 'Monto máximo permitido por período según regla 50-30-20.',
    example: 578640.73,
    nullable: true,
  })
  max_allowed_per_period!: number | null;

  @ApiPropertyOptional({
    description: '¿La cuota está dentro del presupuesto recomendado?',
    example: true,
    nullable: true,
  })
  is_within_budget!: boolean | null;

  @ApiPropertyOptional({
    description: 'Banco donde se aloja el ahorro (descifrado).',
    example: 'Bancolombia',
    nullable: true,
  })
  bank!: string | null;

  @ApiPropertyOptional({
    description: 'Rentabilidad actual anual (%).',
    example: 5.5,
    nullable: true,
  })
  current_profitability!: number | null;

  @ApiPropertyOptional({
    description: 'Saldo proyectado al final con rentabilidad.',
    example: 10410000,
    nullable: true,
  })
  projected_final_balance!: number | null;

  @ApiProperty({
    description: 'Indica si el usuario tiene perfil financiero registrado.',
    example: true,
  })
  has_financial_profile!: boolean;

  @ApiProperty({
    description: 'Advertencias sobre el plan de ahorro.',
    type: [String],
  })
  warnings!: string[];

  @ApiProperty({
    description: 'Recomendaciones psicológicas y prácticas.',
    type: [String],
  })
  recommendations!: string[];
}

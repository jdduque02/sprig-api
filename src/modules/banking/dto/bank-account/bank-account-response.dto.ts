import { ApiProperty } from '@nestjs/swagger';

export class BankAccountResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'Bancolombia' })
  bank_name!: string;

  @ApiProperty({ example: 'ahorros' })
  account_type!: string;

  @ApiProperty({
    description: 'Número de cuenta enmascarado (últimos 4 dígitos).',
    example: '****6789',
  })
  masked_account_number!: string;

  @ApiProperty({
    description: 'Saldo visible de la cuenta.',
    example: '1500000',
  })
  display_balance!: string;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({
    description: 'Tasa de interés anual de la cuenta (%).',
    example: 4.5,
    nullable: true,
  })
  annual_interest_rate!: number | null;

  @ApiProperty({
    description: 'Frecuencia de entrega del rendimiento.',
    example: 'monthly',
  })
  yield_frequency!: string;

  @ApiProperty({
    description:
      'Tipo de tasa: EA (Efectiva Anual), nominal, MV (Mes Vencido).',
    example: 'EA',
    enum: ['EA', 'nominal', 'MV'],
  })
  rate_type!: string;

  @ApiProperty({
    description:
      'Si true, el job de interés capitaliza automáticamente esta cuenta.',
    example: true,
  })
  interest_enabled!: boolean;

  @ApiProperty({
    description: 'Fecha del último interés aplicado (null = nunca).',
    example: '2026-08-25',
    nullable: true,
  })
  last_interest_applied_at!: string | null;

  @ApiProperty({
    description: 'Fecha de inicio del interés (null = created_at).',
    example: '2026-08-01',
    nullable: true,
  })
  interest_start_date!: string | null;

  @ApiProperty({
    description: 'Plazo del CDT en días (null = no es CDT).',
    example: 360,
    nullable: true,
  })
  term_days!: number | null;

  @ApiProperty({
    description: 'Fecha de inicio del ciclo CDT actual.',
    example: '2026-08-01',
    nullable: true,
  })
  start_date!: string | null;

  @ApiProperty({
    description:
      'Fecha de vencimiento del CDT (calculada: start_date + term_days).',
    example: '2027-08-01',
    nullable: true,
  })
  maturity_date!: string | null;

  @ApiProperty({
    description: 'Acción al vencer el CDT.',
    example: 'renew',
    enum: ['renew'],
  })
  maturity_action!: string;

  @ApiProperty({
    description: 'Si true, el CDT se renueva automáticamente al vencer.',
    example: true,
  })
  auto_renew!: boolean;

  @ApiProperty({ example: false })
  is_primary!: boolean;

  @ApiProperty({
    description: 'Indica si la cuenta está exenta del impuesto 4x1000 (GMF).',
    example: false,
  })
  exempt_4x1000!: boolean;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z', nullable: true })
  updated_at!: Date | null;
}

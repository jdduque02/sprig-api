import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferMovementDto {
  @ApiProperty({ example: 100 })
  id!: number;

  @ApiProperty({
    description: 'ID de la cuenta bancaria de este lado.',
    example: 1,
  })
  account_id!: number | null;

  @ApiPropertyOptional({
    description: 'ID del pasivo financiero de este lado (tarjeta de crédito).',
    example: 3,
    nullable: true,
  })
  liability_id!: number | null;

  @ApiProperty({
    description: 'Lado del movimiento: origen (debita) o destino (acredita).',
  })
  side!: 'source' | 'destination';

  @ApiPropertyOptional({ example: 'Bancolombia', nullable: true })
  bank_name!: string | null;

  @ApiPropertyOptional({ example: 'Ahorros', nullable: true })
  account_type!: string | null;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '2026-08-07' })
  transaction_date!: Date;

  @ApiPropertyOptional({
    example: 'Transferencia entre cuentas',
    nullable: true,
  })
  description!: string | null;

  @ApiPropertyOptional({ example: 'TRF-2026-001', nullable: true })
  reference_code!: string | null;

  @ApiPropertyOptional({
    description: 'ID de la empresa/comercio asociada.',
    example: 5,
    nullable: true,
  })
  company_id!: number | null;

  @ApiPropertyOptional({
    description:
      'ID de la meta financiera vinculada (se aplica al lado destino).',
    example: 12,
    nullable: true,
  })
  objective_id!: number | null;

  @ApiProperty({ example: '2026-08-07T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

export class TransferResponseDto {
  @ApiProperty({
    description: 'ID del grupo compartido por los dos movimientos.',
    example: 'e6a2f0e4-8f0a-4a9e-9f2c-2b1d3f0a1c8e',
  })
  transfer_group_id!: string;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '2026-08-07' })
  transaction_date!: Date;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reference_code!: string | null;

  @ApiPropertyOptional({
    description: 'ID de la meta financiera vinculada a la transferencia.',
    example: 12,
    nullable: true,
  })
  objective_id!: number | null;

  @ApiPropertyOptional({
    description: 'ID del pasivo financiero de destino (tarjeta de crédito).',
    example: 3,
    nullable: true,
  })
  destination_liability_id!: number | null;

  @ApiProperty({ type: TransferMovementDto })
  source!: TransferMovementDto;

  @ApiProperty({ type: TransferMovementDto })
  destination!: TransferMovementDto;
}

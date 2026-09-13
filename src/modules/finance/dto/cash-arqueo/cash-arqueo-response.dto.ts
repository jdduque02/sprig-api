import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashArqueoStatusEnum } from '@finance/entities/cash-arqueo.entity';

export class CashReconciliationDto {
  @ApiProperty({ example: '2026-08' })
  month!: string;

  @ApiProperty({
    description: 'Registros del aplicativo (source = manual).',
    example: { count: 12, income: 3000000, expense: 1500000, net: 1500000 },
  })
  app!: { count: number; income: number; expense: number; net: number };

  @ApiProperty({
    description:
      'Registros provenientes de extractos cargados (source = import).',
    example: { count: 18, income: 2800000, expense: 1350000, net: 1450000 },
  })
  extract!: { count: number; income: number; expense: number; net: number };

  @ApiProperty({
    description:
      'Movimientos que coinciden en ambos lados (por fecha+monto+descripción).',
    example: { count: 10, amount: 2500000 },
  })
  matched!: { count: number; amount: number };

  @ApiProperty({
    description:
      'Movimientos solo presentes en el aplicativo (sin contraparte en extractos).',
    example: { count: 2, amount: 500000 },
  })
  app_only!: { count: number; amount: number };

  @ApiProperty({
    description:
      'Movimientos solo presentes en los extractos (sin contraparte en el aplicativo).',
    example: { count: 8, amount: 750000 },
  })
  extract_only!: { count: number; amount: number };

  @ApiPropertyOptional({
    description:
      'Valor esperado sugerido para el arqueo: neto de los extractos si hay, si no neto del aplicativo.',
    example: 1450000,
  })
  expected_amount!: number;

  @ApiPropertyOptional({
    type: 'array',
    description:
      'Movimientos sin coincidencia (detalle de app_only y extract_only).',
  })
  discrepancies?: Array<Record<string, unknown>>;
}

export class CashArqueoResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: '2026-08-07' })
  arqueo_date!: Date;

  @ApiProperty({ example: 1450000 })
  expected_amount!: number;

  @ApiProperty({ example: 1500000 })
  counted_amount!: number;

  @ApiProperty({ example: 50000 })
  difference!: number;

  @ApiProperty({ enum: CashArqueoStatusEnum })
  status!: CashArqueoStatusEnum;

  @ApiPropertyOptional({ example: 'Sobrante de caja', nullable: true })
  observations!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  reconciliation!: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-08-07T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

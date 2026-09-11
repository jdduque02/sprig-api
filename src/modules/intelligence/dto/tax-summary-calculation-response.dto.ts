import { ApiProperty } from '@nestjs/swagger';
import { TaxSummaryResponseDto } from './tax-summary-response.dto';

export class TaxSummaryValidationDto {
  @ApiProperty({
    example: true,
    description: 'Si el cálculo es válido (todos los datos requeridos están disponibles)',
  })
  is_valid!: boolean;

  @ApiProperty({
    example: [
      'No se encontraron transacciones de ingreso. Verifica que estén registradas.',
    ],
    description: 'Advertencias sobre calidad de datos',
  })
  warnings!: string[];

  @ApiProperty({
    example: ['UVT del año fiscal'],
    description: 'Datos faltantes que podrían mejorar la precisión',
  })
  missing_data!: string[];

  @ApiProperty({
    example: { income_risk: 'MISSING_OR_ZERO' },
    description: 'Notas adicionales sobre validación',
  })
  notes!: Record<string, unknown>;
}

export class TaxSummaryCalculationResponseDto extends TaxSummaryResponseDto {
  @ApiProperty({
    description: 'Validación de datos usados en el cálculo',
  })
  validation!: TaxSummaryValidationDto;

  @ApiProperty({
    example: {
      calculated_at: '2026-09-11T20:30:00Z',
      income_sources: { count: 42, byMonth: {} },
      assets_breakdown: {
        bank_accounts: { count: 2, total: 50000000 },
        financial_assets: { count: 1, total: 10000000 },
      },
      liabilities_breakdown: { count: 2, total: 15000000 },
    },
    description: 'Notas y detalles de cómo se calcularon los valores',
  })
  calculation_details!: Record<string, unknown>;
}

import { ApiProperty } from '@nestjs/swagger';

export class GmfAccountBreakdownDto {
  @ApiProperty({ example: 1 })
  account_id!: number;

  @ApiProperty({ example: 'Bancolombia' })
  bank_name!: string | null;

  @ApiProperty({ example: false })
  exempt_4x1000!: boolean;

  @ApiProperty({
    example: 5000000,
    description: 'Total debitado desde esta cuenta en el periodo.',
  })
  debited_amount!: number;

  @ApiProperty({
    example: 20000,
    description: 'GMF (4x1000) pagado por los débitos de esta cuenta.',
  })
  gmf_paid!: number;
}

export class GmfSummaryResponseDto {
  @ApiProperty({ example: '2026-01-01' })
  date_from!: string;

  @ApiProperty({ example: '2026-01-31' })
  date_to!: string;

  @ApiProperty({
    example: 0.004,
    description: 'Tarifa fija del GMF (4x1000, art. 871/872 E.T.).',
  })
  gmf_rate!: number;

  @ApiProperty({
    example: 5000000,
    description: 'Total debitado desde cuentas no exentas en el periodo.',
  })
  total_debited_amount!: number;

  @ApiProperty({
    example: 20000,
    description: 'Total pagado en GMF (4x1000) en el periodo.',
  })
  total_gmf_paid!: number;

  @ApiProperty({
    example: 20000,
    description:
      'Ahorro estimado si todos esos débitos se hubieran hecho desde una ' +
      'cuenta exenta de 4x1000 (equivale al GMF efectivamente pagado).',
  })
  estimated_savings_if_exempt!: number;

  @ApiProperty({ type: [GmfAccountBreakdownDto] })
  by_account!: GmfAccountBreakdownDto[];
}

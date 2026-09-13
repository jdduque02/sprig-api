import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FinancialLiabilityResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'credito_hipotecario' })
  liability_type!: string;

  @ApiProperty({ example: 'Crédito vivienda Bancolombia' })
  name!: string;

  @ApiProperty({ example: 80000000 })
  current_balance!: number;

  @ApiPropertyOptional({ example: 12.5, nullable: true })
  interest_rate!: number | null;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ example: '2026-04-25T10:00:00.000Z', nullable: true })
  updated_at!: Date | null;
}

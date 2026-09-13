import { ApiProperty } from '@nestjs/swagger';

export class TaxSummaryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 2026 })
  fiscal_year!: number;

  @ApiProperty({ example: 72000000 })
  total_income!: number;

  @ApiProperty({ example: 45000000 })
  total_assets!: number;

  @ApiProperty({ example: 12000000 })
  total_liabilities!: number;

  @ApiProperty({ example: 33000000, nullable: true })
  patrimony!: number | null;

  @ApiProperty({ example: 5294.12, nullable: true })
  income_in_uvt!: number | null;

  @ApiProperty({ example: 3311.76, nullable: true })
  assets_in_uvt!: number | null;

  @ApiProperty({ example: 42680 })
  uvt_value!: number;

  @ApiProperty({ example: true })
  must_declare!: boolean;

  @ApiProperty({ example: 8500000, nullable: true })
  estimated_tax!: number | null;

  @ApiProperty({ example: '2026-07-20T12:00:00.000Z' })
  created_at!: Date;
}

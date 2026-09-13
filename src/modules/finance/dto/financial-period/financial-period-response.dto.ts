import { ApiProperty } from '@nestjs/swagger';

export class FinancialPeriodResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: 4 })
  month!: number;

  @ApiProperty({ example: false })
  is_closed!: boolean;

  @ApiProperty({ example: null, nullable: true })
  closed_at!: Date | null;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  created_at!: Date;
}

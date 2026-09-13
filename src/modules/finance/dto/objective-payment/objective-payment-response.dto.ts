import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ObjectivePaymentResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  objective_id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 200000 })
  amount!: number;

  @ApiProperty({ example: '2026-04-25' })
  payment_date!: Date;

  @ApiPropertyOptional({ example: 'Abono mensual', nullable: true })
  note!: string | null;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;
}

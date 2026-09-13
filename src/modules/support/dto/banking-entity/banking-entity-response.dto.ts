import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BankingEntityResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'daviplata' })
  code!: string;

  @ApiProperty({ example: 'Daviplata' })
  name!: string;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string' },
    example: ['Movimientos de Daviplata'],
  })
  detect_patterns!: string[];

  @ApiProperty({ example: '2026-08-07T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

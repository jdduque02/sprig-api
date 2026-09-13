import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmpresaResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'Netflix' })
  name!: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  default_category_id!: number | null;

  @ApiProperty({ example: '2026-08-16T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

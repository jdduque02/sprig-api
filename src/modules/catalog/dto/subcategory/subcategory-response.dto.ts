import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubcategoryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  category_id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'Restaurantes' })
  name!: string;

  @ApiPropertyOptional({ example: 'silverware', nullable: true })
  icon_key!: string | null;

  @ApiPropertyOptional({ example: '#FFA500', nullable: true })
  color_hex!: string | null;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;
}

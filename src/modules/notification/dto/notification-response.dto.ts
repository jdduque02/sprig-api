import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'Recordatorio de pago' })
  title!: string;

  @ApiPropertyOptional({ example: 'Tu cuota vence en 3 días', nullable: true })
  description!: string | null;

  @ApiProperty({ example: false })
  is_read!: boolean;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiPropertyOptional({ example: '2026-08-01T09:00:00.000Z', nullable: true })
  scheduled_at!: Date | null;

  @ApiPropertyOptional({
    example: 'fixed:reminder:42:2026-08-15',
    nullable: true,
  })
  reference!: string | null;

  @ApiProperty({ example: '2026-07-28T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ example: '2026-07-28T10:00:00.000Z', nullable: true })
  updated_at!: Date | null;
}

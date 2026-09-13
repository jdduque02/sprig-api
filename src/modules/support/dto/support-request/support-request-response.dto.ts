import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportRequestStatusEnum } from '@support/entities/support-request.entity';

export class SupportRequestResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ example: 'No reconoce el extracto de mi banco' })
  subject!: string;

  @ApiProperty({ example: 'Al cargar el PDF de mi banco...' })
  description!: string;

  @ApiProperty({ enum: SupportRequestStatusEnum })
  status!: SupportRequestStatusEnum;

  @ApiPropertyOptional({
    example: 'Solicitado al equipo de integraciones.',
    nullable: true,
  })
  admin_notes!: string | null;

  @ApiProperty({ example: '2026-08-07T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Título de la notificación',
    example: 'Recordatorio de pago',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada',
    example: 'Tu cuota vence en 3 días',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Fecha programada para la notificación',
    example: '2026-08-01T09:00:00.000Z',
  })
  @IsOptional()
  scheduled_at?: Date;

  @ApiPropertyOptional({
    description:
      'Clave de deduplicación (ej: fixed:reminder:{txId}:{YYYY-MM-DD})',
    example: 'fixed:reminder:42:2026-08-15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ description: 'Estado activo', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

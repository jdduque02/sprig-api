import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por notificaciones no leídas',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_read?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por notificaciones activas',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;
}

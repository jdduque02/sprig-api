import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNewsItemDto {
  @ApiProperty({
    example: 'El Banco de la República eleva las tasas de interés',
    description: 'Título de la noticia.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiProperty({
    example: 'La junta directiva decidió incrementar la tasa de interés...',
    description: 'Resumen breve de la noticia.',
  })
  @IsNotEmpty()
  @IsString()
  summary!: string;

  @ApiPropertyOptional({
    example: 'Contenido completo de la noticia...',
    description: 'Contenido detallado (opcional).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiPropertyOptional({
    example: 'Economía',
    description: 'Categoría de la noticia.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @ApiPropertyOptional({
    example: 'https://ejemplo.com/imagen.jpg',
    description: 'URL de imagen destacada.',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  image_url?: string | null;

  @ApiPropertyOptional({
    example: 'https://ejemplo.com/noticia',
    description: 'URL del artículo original.',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  link?: string | null;

  @ApiPropertyOptional({
    example: '2026-07-26T10:00:00.000Z',
    description: 'Fecha de publicación de la noticia.',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  published_at?: string | null;
}

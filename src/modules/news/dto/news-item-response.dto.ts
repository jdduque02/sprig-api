import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NewsItemResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({
    example: 'El Banco de la República eleva las tasas de interés',
  })
  title!: string;

  @ApiProperty({
    example: 'La junta directiva decidió incrementar la tasa de interés...',
  })
  summary!: string;

  @ApiPropertyOptional({
    example: 'Contenido completo de la noticia...',
    nullable: true,
  })
  content!: string | null;

  @ApiPropertyOptional({ example: 'Economía', nullable: true })
  category!: string | null;

  @ApiPropertyOptional({
    example: 'https://ejemplo.com/imagen.jpg',
    nullable: true,
  })
  image_url!: string | null;

  @ApiPropertyOptional({
    example: 'https://ejemplo.com/noticia',
    nullable: true,
  })
  link!: string | null;

  @ApiPropertyOptional({ example: '2026-07-26T10:00:00.000Z', nullable: true })
  published_at!: Date | null;

  @ApiProperty({ example: '2026-07-26T10:00:00.000Z' })
  created_at!: Date;
}

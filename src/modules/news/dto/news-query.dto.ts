import { IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class NewsQueryDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Número máximo de noticias a retornar.',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Economía',
    description: 'Filtrar por categoría.',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'banco',
    description: 'Buscar en título o resumen.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

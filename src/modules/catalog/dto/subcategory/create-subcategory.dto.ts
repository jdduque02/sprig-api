import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSubcategoryDto {
  @ApiProperty({ description: 'ID de la categoría padre.', example: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  category_id!: number;

  @ApiProperty({
    description: 'Nombre de la subcategoría.',
    example: 'Restaurantes',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Clave del ícono.',
    example: 'silverware',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon_key?: string;

  @ApiPropertyOptional({
    description: 'Color hexadecimal (formato #RRGGBB).',
    example: '#FFA500',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color_hex?: string;

  @ApiPropertyOptional({ description: 'Estado activo.', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBankingEntityDto {
  @ApiProperty({
    description:
      'Código único de la entidad (minúsculas, números, guion o guion bajo). Se usa para etiquetar los movimientos importados.',
    example: 'daviplata',
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'code solo puede contener minúsculas, números, guion o guion bajo',
  })
  code!: string;

  @ApiProperty({
    description: 'Nombre comercial de la entidad.',
    example: 'Daviplata',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Si está activa para detección de extractos.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Expresiones regulares usadas para reconocer los extractos de esta entidad. Cuantas más coincidan, más confiable es la detección.',
    example: ['Movimientos de Daviplata', 'Cuenta ahorro'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  detect_patterns?: string[];
}

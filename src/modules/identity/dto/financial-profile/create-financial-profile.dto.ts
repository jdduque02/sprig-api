import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialProfileDto {
  @ApiProperty({
    description: 'Identificador único del usuario asociado al perfil.',
    example: '1',
  })
  @IsString()
  @IsNotEmpty()
  user_id!: string;

  @ApiPropertyOptional({
    description: 'Nombre descriptivo del perfil financiero.',
    example: 'Plan de Ahorro Agresivo',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  profile_name?: string;

  @ApiPropertyOptional({
    description: 'Indica si es un perfil personalizado por el usuario.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_custom?: boolean;

  @ApiPropertyOptional({
    description: 'Porcentaje destinado a necesidades básicas.',
    example: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  needs_ratio?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje destinado a deseos o gastos variables.',
    example: 30,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  wants_ratio?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje destinado a ahorros e inversión.',
    example: 20,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  savings_ratio?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje destinado a inversión.',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  investment_ratio?: number;

  @ApiPropertyOptional({
    description: 'Límite máximo de endeudamiento permitido.',
    example: 35,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  max_debt_ratio?: number;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales del perfil financiero.',
    example: { version: '1.0', tags: ['emergencia', 'personal'] },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Ingreso mensual del usuario en pesos colombianos (se almacena encriptado).',
    example: 3500000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthly_income?: number;
}

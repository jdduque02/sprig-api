import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFinancialLiabilityDto {
  @ApiProperty({
    description: 'Tipo de pasivo financiero.',
    example: 'credito_hipotecario',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  liability_type!: string;

  @ApiProperty({
    description: 'Nombre descriptivo del pasivo.',
    example: 'Crédito vivienda Bancolombia',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Saldo actual del pasivo.', example: 80000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  current_balance!: number;

  @ApiPropertyOptional({
    description: 'Tasa de interés anual (%).',
    example: 12.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interest_rate?: number;

  @ApiPropertyOptional({ description: 'Moneda ISO 4217.', example: 'COP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

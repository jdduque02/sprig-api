import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTaxSummaryDto {
  @ApiPropertyOptional({
    description: 'Total de ingresos del año fiscal (COP).',
    example: 75000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_income?: number;

  @ApiPropertyOptional({
    description: 'Total de activos del usuario (COP).',
    example: 210000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_assets?: number;

  @ApiPropertyOptional({
    description: 'Total de pasivos del usuario (COP).',
    example: 52000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_liabilities?: number;

  @ApiPropertyOptional({
    description: 'Valor UVT usado para el cálculo del año fiscal.',
    example: 42680,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  uvt_value?: number;

  @ApiPropertyOptional({
    description:
      'Impuesto estimado (COP). Ajuste manual según régimen tributario.',
    example: 8500000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimated_tax?: number;

  @ApiPropertyOptional({
    description:
      'Forzar manualmente la obligación de declarar. Si se omite, se recalcula según los umbrales DIAN con los valores resultantes.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  must_declare?: boolean;
}

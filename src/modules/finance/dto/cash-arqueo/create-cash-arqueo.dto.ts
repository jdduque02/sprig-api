import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCashArqueoDto {
  @ApiProperty({
    description:
      'Fecha del arqueo. Determina el mes sobre el que se calcula la conciliación (registros del app vs extractos). Por defecto: hoy.',
    example: '2026-08-07',
  })
  @IsOptional()
  @IsDateString()
  arqueo_date?: string;

  @ApiProperty({
    description: 'Total de efectivo físico contado.',
    example: 1500000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  counted_amount!: number;

  @ApiPropertyOptional({
    description:
      'Valor esperado (registro contable). Si no se envía, se autocompleta con el neto reconciliado del mes (app vs extractos).',
    example: 1450000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expected_amount?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del arqueo.',
    example: 'Sobrante de caja de $50.000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string;
}

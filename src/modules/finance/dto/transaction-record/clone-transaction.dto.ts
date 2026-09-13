import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CloneTransactionDto {
  @ApiPropertyOptional({
    description: 'Fecha de negocio de la transacción clonada.',
    example: '2026-08-16',
  })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiPropertyOptional({
    description: 'Monto de la transacción clonada.',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Descripción de la transacción clonada.',
    example: 'Almuerzo trabajo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: 'ID de la categoría.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  category_id?: number;

  @ApiPropertyOptional({ description: 'ID de la empresa.', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  company_id?: number;
}

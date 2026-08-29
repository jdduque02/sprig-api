import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CloneTransferDto {
  @ApiPropertyOptional({ description: 'Nueva fecha de la transferencia clonada.', example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiPropertyOptional({ description: 'Nuevo monto de la transferencia clonada.', example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: 'Nueva descripción de la transferencia clonada.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

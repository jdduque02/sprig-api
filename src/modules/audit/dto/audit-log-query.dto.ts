import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AuditActionEnum } from '@shared/enums';

export class AuditLogQueryDto {
  @ApiPropertyOptional({
    description: 'Esquema de la tabla auditada.',
    example: 'finance',
  })
  @IsOptional()
  @IsString()
  schema_name?: string;

  @ApiPropertyOptional({
    description: 'Nombre de la tabla auditada.',
    example: 'transaction_record',
  })
  @IsOptional()
  @IsString()
  table_name?: string;

  @ApiPropertyOptional({ description: 'ID del registro auditado.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  record_id?: number;

  @ApiPropertyOptional({
    description: 'ID del usuario que realizó el cambio.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  changed_by?: number;

  @ApiPropertyOptional({
    enum: AuditActionEnum,
    description: 'Tipo de acción auditada.',
  })
  @IsOptional()
  @IsEnum(AuditActionEnum)
  action?: AuditActionEnum;

  @ApiPropertyOptional({
    example: 1,
    description: 'Número de página (desde 1).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Resultados por página (máx. 100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  limit?: number = 20;
}

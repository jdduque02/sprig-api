import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SystemLogSeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export enum SystemLogSource {
  APP = 'app',
  AUDIT = 'audit',
  ALL = 'all',
}

export class SystemLogQueryDto {
  @ApiPropertyOptional({
    enum: SystemLogSeverity,
    description: 'Filtrar por severidad',
  })
  @IsOptional()
  @IsEnum(SystemLogSeverity)
  severity?: SystemLogSeverity;

  @ApiPropertyOptional({
    enum: SystemLogSource,
    default: 'all',
    description: 'Fuente del log',
  })
  @IsOptional()
  @IsEnum(SystemLogSource)
  source?: SystemLogSource;

  @ApiPropertyOptional({ description: 'Buscar en mensaje y contexto' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por contexto (módulo/servicio)',
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ description: 'Fecha inicio (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha fin (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    default: 'timestamp',
    enum: ['timestamp', 'severity'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

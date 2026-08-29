import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FinancialObjectiveTypeEnum, FrequencyEnum } from '@shared/enums';

export class CreateFinancialObjectiveDto {
  @ApiPropertyOptional({
    description: 'ID de la categoría asociada.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  category_id?: number;

  @ApiPropertyOptional({
    description: 'ID de la subcategoría asociada.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  subcategory_id?: number;

  @ApiProperty({
    description: 'Nombre descriptivo del objetivo.',
    example: 'Fondo de emergencia',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    enum: FinancialObjectiveTypeEnum,
    description: 'Tipo de objetivo financiero.',
  })
  @IsEnum(FinancialObjectiveTypeEnum)
  type!: FinancialObjectiveTypeEnum;

  @ApiPropertyOptional({
    description:
      'Monto objetivo. Opcional para metas abiertas (sin monto ni fecha fin).',
    example: 10000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  target_amount?: number;

  @ApiPropertyOptional({
    description: 'Saldo actual ahorrado hacia el objetivo.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  current_balance?: number;

  @ApiPropertyOptional({
    description: 'Tasa de interés anual (%).',
    example: 5.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interest_rate?: number;

  @ApiPropertyOptional({
    description: 'Comisiones o cargos adicionales.',
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fees?: number;

  @ApiPropertyOptional({
    description: 'Cuota mensual sugerida.',
    example: 200000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthly_payment?: number;

  @ApiPropertyOptional({
    description: 'Propietario del objetivo.',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  owner?: string;

  @ApiPropertyOptional({
    description: 'Banco donde se aloja el ahorro (se almacena encriptado).',
    example: 'Bancolombia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bank?: string;

  @ApiPropertyOptional({
    description: 'Rentabilidad actual anual del ahorro (%).',
    example: 5.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  current_profitability?: number;

  @ApiPropertyOptional({
    description:
      'Cuenta bancaria vinculada a la meta (patrimonio donde se ahorra).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  account_id?: number;

  @ApiPropertyOptional({
    enum: FrequencyEnum,
    description: 'Frecuencia de pago.',
  })
  @IsOptional()
  @IsEnum(FrequencyEnum)
  frequency?: FrequencyEnum;

  @ApiPropertyOptional({
    description: 'Día de vencimiento del mes (1-31).',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  due_day?: number;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del objetivo.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'Fecha límite del objetivo.',
    example: '2027-12-31',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description:
      'Referencia del cálculo de cuota previo (resultado de /calculate-quota). Se guarda como referencia interna.',
    example: {
      quota_amount: 416666.67,
      total_periods: 24,
      has_financial_profile: true,
      is_within_budget: true,
    },
  })
  @IsOptional()
  quota_calculation?: Record<string, unknown>;
}

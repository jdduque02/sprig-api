import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FrequencyEnum } from '@shared/enums';

export class CalculateQuotaDto {
  @ApiPropertyOptional({
    description:
      'Monto objetivo de la meta de ahorro. Opcional para metas abiertas (sin monto ni fecha).',
    example: 10000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  target_amount?: number;

  @ApiPropertyOptional({
    description: 'Saldo actual ya ahorrado hacia esta meta.',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  current_balance?: number;

  @ApiPropertyOptional({
    description:
      'Fecha de inicio del plan de ahorro (ISO 8601). Si no se envía, usa la fecha actual.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description:
      'Fecha límite para alcanzar la meta (ISO 8601). Si no se envía, se retorna un mensaje recomendativo sin calcular cuotas.',
    example: '2027-12-31',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Tasa de interés anual (%) para proyectar el saldo final.',
    example: 5.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interest_rate?: number;

  @ApiPropertyOptional({
    description:
      'Cuenta bancaria vinculada a la meta. Si se envía y no se especifica interest_rate, se toma la tasa anual de la cuenta.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  account_id?: number;

  @ApiProperty({
    enum: FrequencyEnum,
    description: 'Frecuencia de las cuotas de ahorro.',
    example: FrequencyEnum.MONTHLY,
  })
  @IsEnum(FrequencyEnum, {
    message:
      'La frecuencia debe ser: daily, weekly, biweekly, monthly, quarterly o yearly.',
  })
  @IsNotEmpty()
  frequency!: FrequencyEnum;
}

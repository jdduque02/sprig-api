import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FixedTypeEnum, FrequencyEnum } from '@shared/enums';

@ValidatorConstraint({ name: 'distinctTransferEntities', async: false })
class DistinctTransferEntitiesConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      source_account_id?: number;
      destination_account_id?: number;
      destination_liability_id?: number;
    };
    if (!obj.source_account_id) return false;
    const hasDestAccount =
      obj.destination_account_id !== undefined &&
      obj.destination_account_id !== null;
    const hasDestLiability =
      obj.destination_liability_id !== undefined &&
      obj.destination_liability_id !== null;
    return hasDestAccount !== hasDestLiability;
  }

  defaultMessage(): string {
    return 'Se requiere exactamente uno de destination_account_id o destination_liability_id.';
  }
}

const ValidateClassDecorator = Validate as unknown as (
  constraint: unknown,
) => ClassDecorator;

@ValidateClassDecorator(DistinctTransferEntitiesConstraint)
export class CreateTransferDto {
  @ApiProperty({
    description: 'ID de la cuenta bancaria de origen (se debita).',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_account_id!: number;

  @ApiPropertyOptional({
    description: 'ID de la cuenta bancaria de destino (se acredita).',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_account_id?: number;

  @ApiPropertyOptional({
    description: 'ID del pasivo financiero de destino (tarjeta de crédito).',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_liability_id?: number;

  @ApiProperty({ description: 'Monto del movimiento.', example: 250000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    description:
      'Fecha de negocio del movimiento (día del movimiento). Por defecto: hoy.',
    example: '2026-08-07',
  })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiPropertyOptional({
    description: 'Descripción del movimiento.',
    example: 'Transferencia a cuenta de ahorros',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Código de referencia.',
    example: 'TRF-2026-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_code?: string;

  @ApiPropertyOptional({
    description: 'Marca el movimiento como fijo (por ejemplo, ahorro mensual).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_fixed?: boolean;

  @ApiPropertyOptional({
    description:
      'ID de la meta financiera a la que se vincula el movimiento (abona al saldo de la meta).',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  objective_id?: number;

  @ApiPropertyOptional({
    description:
      'ID de la empresa/comercio asociada. Se asigna a ambos movimientos de la transferencia.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @ApiPropertyOptional({
    description: 'Tipo de movimiento fijo (deducción o ingreso fijo).',
    enum: FixedTypeEnum,
  })
  @IsOptional()
  @IsEnum(FixedTypeEnum)
  fixed_type?: FixedTypeEnum;

  @ApiPropertyOptional({
    description: 'Frecuencia del movimiento fijo.',
    enum: FrequencyEnum,
  })
  @IsOptional()
  @IsEnum(FrequencyEnum)
  frequency?: FrequencyEnum;

  @ApiPropertyOptional({
    description: 'Día del mes en que vence el movimiento fijo.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @MaxLength(31)
  due_day?: number;

  @ApiPropertyOptional({
    description: 'Días de anticipación para el recordatorio.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reminder_days?: number;
}

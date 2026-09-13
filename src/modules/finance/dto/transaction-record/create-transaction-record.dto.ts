import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  FixedTypeEnum,
  FrequencyEnum,
  PaymentMethodEnum,
  TransactionTypeEnum,
} from '@shared/enums';

@ValidatorConstraint({ name: 'singlePatrimony', async: false })
class SinglePatrimonyConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    const count = [obj.account_id, obj.asset_id, obj.liability_id].filter(
      (v) => v !== undefined && v !== null,
    ).length;
    return count <= 1;
  }

  defaultMessage(): string {
    return 'Una transacción puede tener a lo sumo un patrimonio asociado (cuenta, activo o pasivo).';
  }
}

export class CreateTransactionRecordDto {
  @ApiPropertyOptional({
    description:
      'ID de la categoría. Opcional: si no se indica, se intenta auto-categorizar por descripción; si no hay regla, queda pendiente (category_status = pending).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  category_id?: number;

  @ApiPropertyOptional({ description: 'ID de la subcategoría.', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  subcategory_id?: number;

  @ApiProperty({
    enum: TransactionTypeEnum,
    description: 'Tipo de transacción.',
  })
  @IsEnum(TransactionTypeEnum)
  type!: TransactionTypeEnum;

  @ApiProperty({ description: 'Monto de la transacción.', example: 50000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Moneda de la transacción (COP o USD).',
    enum: ['COP', 'USD'],
    default: 'COP',
    example: 'COP',
  })
  @IsOptional()
  @IsIn(['COP', 'USD'])
  currency?: string;

  @ApiPropertyOptional({
    description: 'Número de cuotas de la compra (tarjeta crédito).',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  installments?: number;

  @ApiPropertyOptional({
    description: 'Valor de cada cuota cuando la compra tiene financiación.',
    example: 150000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installment_value?: number;

  @ApiPropertyOptional({
    enum: PaymentMethodEnum,
    description: 'Método de pago.',
  })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional({
    description: 'Descripción de la transacción.',
    example: 'Almuerzo trabajo',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Código de referencia.',
    example: 'REF-2026-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_code?: string;

  @ApiPropertyOptional({ description: 'URLs de adjuntos.', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Cuenta origen.',
    example: 'Cuenta ahorros Bancolombia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_account?: string;

  @ApiPropertyOptional({
    description: 'Cuenta destino.',
    example: 'Cuenta ahorros Davivienda',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination_account?: string;

  @ApiPropertyOptional({ description: 'Banco origen.', example: 'Bancolombia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_bank?: string;

  @ApiPropertyOptional({ description: 'Banco destino.', example: 'Davivienda' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination_bank?: string;

  @ApiPropertyOptional({ description: 'Destinatario.', example: 'Empresa XYZ' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressee?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de negocio de la transacción (día del movimiento). Por defecto: hoy.',
    example: '2026-04-25',
  })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de la transacción (CRÍTICO: siempre incluir para partition pruning).',
    example: '2026-04-25T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  created_at?: string;

  @ApiPropertyOptional({
    description: 'Marca la transacción como fija (deducción o ingreso fijo).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_fixed?: boolean;

  @ApiPropertyOptional({
    enum: FixedTypeEnum,
    description: 'Tipo de transacción fija: deducción o ingreso fijo.',
  })
  @IsOptional()
  @IsEnum(FixedTypeEnum)
  fixed_type?: FixedTypeEnum;

  @ApiPropertyOptional({
    description:
      'Periodicidad de la transacción fija (diaria, semanal, quincenal, mensual, trimestral o anual).',
    enum: FrequencyEnum,
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
  frequency?: FrequencyEnum;

  @ApiPropertyOptional({
    description:
      'Día del mes (1-31) en que llega el ingreso o se ejecuta la deducción.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  due_day?: number;

  @ApiPropertyOptional({
    description:
      'Anticipación en días para generar el recordatorio de la transacción fija (default 3).',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  reminder_days?: number;

  @ApiPropertyOptional({
    description:
      'ID de la meta asociada (financial_objective). Al vincular, el saldo de la meta se ajusta según el tipo: ingreso/inversión suma, gasto resta.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  objective_id?: number;

  @ApiPropertyOptional({
    description:
      'ID de la cuenta bancaria asociada (banking.bank_account). Máximo un patrimonio (cuenta, activo o pasivo) por transacción. Ingreso suma, gasto/inversión resta del saldo.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Validate(SinglePatrimonyConstraint)
  account_id?: number;

  @ApiPropertyOptional({
    description:
      'ID del activo financiero asociado (banking.financial_asset). Máximo un patrimonio por transacción. Ingreso/inversión suma al valor, gasto resta.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Validate(SinglePatrimonyConstraint)
  asset_id?: number;

  @ApiPropertyOptional({
    description:
      'ID del pasivo asociado (banking.financial_liability). Máximo un patrimonio por transacción. Reduce el saldo del pasivo (abono).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Validate(SinglePatrimonyConstraint)
  liability_id?: number;

  @ApiPropertyOptional({
    description:
      'ID de la empresa/comercio asociada (finance.empresa). Si se asigna empresa y no hay categoría, se usa la categoría por defecto de la empresa.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  company_id?: number;

  @ApiPropertyOptional({
    description:
      'Procedencia del registro: manual (digita el usuario) o import (extracto cargado). Usado por la conciliación del arqueo de caja.',
    enum: ['manual', 'import'],
    example: 'manual',
  })
  @IsOptional()
  @IsIn(['manual', 'import'])
  source?: 'manual' | 'import';
}

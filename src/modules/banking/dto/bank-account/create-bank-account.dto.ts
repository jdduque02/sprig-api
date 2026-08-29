import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBankAccountDto {
  @ApiProperty({ description: 'Nombre del banco.', example: 'Bancolombia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bank_name!: string;

  @ApiProperty({
    description: 'Tipo de cuenta (ahorros, corriente, etc.).',
    example: 'ahorros',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  account_type!: string;

  @ApiProperty({
    description: 'Número de cuenta (se almacenará cifrado).',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  account_number!: string;

  @ApiProperty({ description: 'Saldo actual de la cuenta.', example: 1500000 })
  @Type(() => Number)
  @IsNumber()
  balance!: number;

  @ApiPropertyOptional({
    description: 'Código de moneda ISO 4217.',
    example: 'COP',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Indica si es la cuenta principal del usuario.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({
    description: 'Indica si la cuenta está exenta del impuesto 4x1000 (GMF).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  exempt_4x1000?: boolean;

  @ApiPropertyOptional({
    description: 'Tasa de interés anual de la cuenta (%).',
    example: 4.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  annual_interest_rate?: number;

  @ApiPropertyOptional({
    description:
      'Frecuencia de entrega del rendimiento (daily, monthly, annual).',
    example: 'monthly',
    enum: ['daily', 'monthly', 'annual'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  yield_frequency?: string;

  @ApiPropertyOptional({
    description: 'Tipo de tasa: EA (Efectiva Anual), nominal, MV (Mes Vencido).',
    example: 'EA',
    enum: ['EA', 'nominal', 'MV'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['EA', 'nominal', 'MV'])
  @MaxLength(10)
  rate_type?: string;

  @ApiPropertyOptional({
    description: 'Si true, el job de interés capitaliza automáticamente esta cuenta.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  interest_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del interés (null = created_at).',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  interest_start_date?: string;

  @ApiPropertyOptional({
    description: 'Plazo del CDT en días (requerido si account_type = cdt).',
    example: 360,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  term_days?: number;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del ciclo CDT (requerido si account_type = cdt).',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'Acción al vencer el CDT (default: renew).',
    example: 'renew',
    enum: ['renew'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['renew'])
  @MaxLength(20)
  maturity_action?: string;

  @ApiPropertyOptional({
    description: 'Si true, el CDT se renueva automáticamente al vencer.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;
}

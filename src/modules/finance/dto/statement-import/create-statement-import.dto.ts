import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransactionTypeEnum } from '@shared/enums';

/**
 * Campos del formulario multipart (los archivos van en el campo `files`).
 * NOTA: el `password` solo vive en memoria durante el procesamiento del lote;
 * jamás se persiste en la base de datos.
 */
export class CreateStatementImportDto {
  @ApiPropertyOptional({
    description:
      'Contraseña del PDF (si está protegido). No se almacena en BD.',
    example: 'mi-clave',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Categoría por defecto para las transacciones del extracto. Opcional: si no se indica, se intenta auto-categorizar por descripción; las que no matcheen quedan sin categoría (por editar).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  default_category_id?: number;

  @ApiPropertyOptional({
    description:
      'Asignar categorías automáticamente usando las reglas aprendidas por descripción del comercio (auto-categorización).',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  assign_categories?: string;

  @ApiPropertyOptional({
    description:
      'Cuenta bancaria a asociar a las transacciones (ajusta el saldo).',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  account_id?: number;

  @ApiPropertyOptional({
    description:
      'Omitir movimientos duplicados (misma fecha, monto y descripción).',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  skip_duplicates?: string;

  @ApiPropertyOptional({
    enum: TransactionTypeEnum,
    description:
      'Tipo por defecto para movimientos ambiguos (sin columna débito/crédito, sin signo).',
  })
  @IsOptional()
  @IsEnum(TransactionTypeEnum)
  default_type?: TransactionTypeEnum;

  @ApiPropertyOptional({
    description:
      'Capturar empresas/comercios de los movimientos y asociarlos a la transacción (fuzzy match por addressee/descripción contra nombres de empresa del usuario).',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  capture_companies?: string;

  @ApiPropertyOptional({
    description:
      'ID de empresa por defecto para asignar a todas las transacciones del extracto.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  default_company_id?: number;

  @ApiPropertyOptional({
    description:
      'ID del pasivo financiero (tarjeta de crédito) al que se asocian las transacciones del extracto.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  liability_id?: number;

  @ApiPropertyOptional({
    description: 'Moneda de las transacciones del extracto (COP o USD).',
    enum: ['COP', 'USD'],
    default: 'COP',
    example: 'COP',
  })
  @IsOptional()
  @IsIn(['COP', 'USD'])
  currency?: string;
}

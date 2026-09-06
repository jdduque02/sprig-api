import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateObjectivePaymentDto {
  @ApiPropertyOptional({
    description:
      'ID del objetivo financiero. No es necesario enviarlo: el controller lo toma del parámetro de ruta `:objectiveId` y lo sobreescribe.',
    example: 1,
  })
  // El cliente no necesita enviarlo (el controller lo toma de `:objectiveId`
  // y lo sobreescribe antes de llegar al service/repository, que sí asumen
  // que siempre está presente) — `@IsOptional()` evita rechazar la request
  // si falta, sin volver opcional el tipo aguas abajo.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  objective_id!: number;

  @ApiProperty({ description: 'Monto del abono.', example: 200000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'Fecha del pago (ISO 8601 date).',
    example: '2026-04-25',
  })
  @IsDateString()
  payment_date!: string;

  @ApiPropertyOptional({
    description: 'Nota del pago.',
    example: 'Abono mensual',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

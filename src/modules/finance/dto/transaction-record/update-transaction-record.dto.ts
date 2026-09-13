import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTransactionRecordDto } from './create-transaction-record.dto';

export class UpdateTransactionRecordDto extends PartialType(
  OmitType(CreateTransactionRecordDto, ['created_at'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Aplicar la categoría (y subcategoría) a todas las transacciones del usuario con la misma descripción (actualización en cadena).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  apply_to_similar?: boolean;
}

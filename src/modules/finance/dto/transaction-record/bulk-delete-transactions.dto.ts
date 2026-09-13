import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayMaxSize, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkDeleteTransactionsDto {
  @ApiProperty({
    description: 'IDs de las transacciones a eliminar (soft delete).',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];
}

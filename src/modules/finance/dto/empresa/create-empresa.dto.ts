import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEmpresaDto {
  @ApiProperty({ example: 'Netflix' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'Categoría por defecto para transacciones de esta empresa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  default_category_id?: number;
}

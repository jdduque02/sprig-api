import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

const USER_SORT_FIELDS = [
  'username',
  'email',
  'created_at',
  'updated_at',
  'last_login_at',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class UserQueryDto {
  @ApiPropertyOptional({
    description:
      'Texto a buscar en username o email (insensible a mayúsculas).',
    example: 'juan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por rol de realm (p. ej. admin, user).',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Campo por el que ordenar.',
    enum: USER_SORT_FIELDS,
    default: 'created_at',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento.',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Número de página (desde 1).',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Resultados por página (máx. 100).',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

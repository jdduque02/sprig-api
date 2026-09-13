import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { AuditActionEnum } from '@shared/enums';

export class WriteAuditLogDto {
  @IsString()
  @IsNotEmpty()
  schema_name!: string;

  @IsString()
  @IsNotEmpty()
  table_name!: string;

  @IsInt()
  @IsPositive()
  record_id!: number;

  @IsEnum(AuditActionEnum)
  action!: AuditActionEnum;

  @IsOptional()
  old_data?: Record<string, unknown>;

  @IsOptional()
  new_data?: Record<string, unknown>;

  /** ID del usuario que realiza el cambio. NULL = proceso automatizado. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  changed_by?: number;
}

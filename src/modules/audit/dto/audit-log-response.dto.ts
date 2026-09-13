import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditActionEnum } from '@shared/enums';

export class AuditLogResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'finance' })
  schema_name!: string;

  @ApiProperty({ example: 'transaction_record' })
  table_name!: string;

  @ApiProperty({ example: 42 })
  record_id!: number;

  @ApiProperty({ enum: AuditActionEnum })
  action!: AuditActionEnum;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  old_data!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  new_data!: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  changed_by!: number | null;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;
}

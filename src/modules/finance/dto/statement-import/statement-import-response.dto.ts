import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatementImportStatusEnum } from '@finance/entities/statement-import.entity';
import { StatementImportFileStatusEnum } from '@finance/entities/statement-import-file.entity';

export class StatementImportFileResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 42 })
  import_id!: number;

  @ApiProperty({ example: 'extracto-junio.pdf' })
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimetype!: string;

  @ApiProperty({ example: 154320 })
  size_bytes!: number;

  @ApiProperty({ enum: StatementImportFileStatusEnum })
  status!: StatementImportFileStatusEnum;

  @ApiProperty({ example: 32 })
  records_parsed!: number;

  @ApiProperty({ example: 30 })
  records_created!: number;

  @ApiProperty({ example: 2 })
  records_skipped!: number;

  @ApiProperty({ example: 4 })
  records_uncategorized!: number;

  @ApiPropertyOptional({ example: 'PDF_WRONG_PASSWORD' })
  error_code!: string | null;

  @ApiPropertyOptional({ example: 'Contraseña incorrecta para el PDF.' })
  error_message!: string | null;

  @ApiPropertyOptional()
  processed_at!: Date | null;

  @ApiProperty()
  created_at!: Date;
}

export class StatementImportResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiProperty({ enum: StatementImportStatusEnum })
  status!: StatementImportStatusEnum;

  @ApiProperty({ example: 3 })
  total_files!: number;

  @ApiProperty({ example: 3 })
  processed_files!: number;

  @ApiProperty({ example: 2 })
  success_files!: number;

  @ApiProperty({ example: 1 })
  failed_files!: number;

  @ApiProperty({ example: 95 })
  total_records_parsed!: number;

  @ApiProperty({ example: 90 })
  total_records_created!: number;

  @ApiProperty({ example: 5 })
  total_records_skipped!: number;

  @ApiProperty({ example: 0 })
  total_records_failed!: number;

  @ApiProperty({ example: 4 })
  total_records_uncategorized!: number;

  @ApiProperty()
  options!: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  error!: Record<string, unknown> | null;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;

  @ApiProperty({ type: [StatementImportFileResponseDto] })
  files!: StatementImportFileResponseDto[];
}

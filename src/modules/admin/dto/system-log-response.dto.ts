import { ApiProperty } from '@nestjs/swagger';

export class SystemLogEntryDto {
  @ApiProperty({ description: 'Identificador único del log' })
  id!: string;

  @ApiProperty({ enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'] })
  severity!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ required: false })
  context?: string;

  @ApiProperty({ required: false })
  data?: Record<string, unknown>;

  @ApiProperty()
  source!: string;

  @ApiProperty()
  timestamp!: string;
}

export class SystemLogStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  info!: number;

  @ApiProperty()
  warn!: number;

  @ApiProperty()
  error!: number;

  @ApiProperty()
  debug!: number;

  @ApiProperty()
  oldestEntry?: string;

  @ApiProperty()
  newestEntry?: string;
}

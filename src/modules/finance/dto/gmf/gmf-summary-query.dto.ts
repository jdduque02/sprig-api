import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GmfSummaryQueryDto {
  @ApiProperty({
    example: '2026-01-01',
    description:
      'Fecha inicio del periodo (ISO 8601). Filtra por transaction_date.',
  })
  @IsDateString()
  date_from!: string;

  @ApiProperty({
    example: '2026-01-31',
    description: 'Fecha fin del periodo (ISO 8601).',
  })
  @IsDateString()
  date_to!: string;
}

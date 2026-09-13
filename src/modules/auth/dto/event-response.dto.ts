import { ApiProperty } from '@nestjs/swagger';

export class EventResponseDto {
  @ApiProperty({ example: 'LOGIN' })
  type!: string;

  @ApiProperty({ example: '192.168.1.1' })
  ipAddress!: string;

  @ApiProperty({ example: '2026-07-28T12:00:00Z' })
  time!: string;

  @ApiProperty({ example: null, nullable: true })
  error!: string | null;

  @ApiProperty({ example: {}, type: Object })
  details!: Record<string, unknown>;

  constructor(partial: Partial<EventResponseDto>) {
    Object.assign(this, partial);
  }
}

import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id!: string;

  @ApiProperty({ example: '192.168.1.1' })
  ipAddress!: string;

  @ApiProperty({ example: 'Mozilla/5.0...' })
  browser!: string;

  @ApiProperty({ example: '2026-07-28T12:00:00Z' })
  start!: string;

  @ApiProperty({ example: '2026-07-28T14:00:00Z', nullable: true })
  lastAccess!: string | null;

  constructor(partial: Partial<SessionResponseDto>) {
    Object.assign(this, partial);
  }
}

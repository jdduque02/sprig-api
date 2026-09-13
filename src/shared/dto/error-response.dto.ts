import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  status!: boolean;

  @ApiProperty({ example: 'Mensaje descriptivo del error.' })
  message!: string;

  @ApiProperty({ example: [] })
  data!: unknown[];

  @ApiProperty({ example: '2026-04-19T12:00:00.000Z' })
  timestamp!: Date;
}

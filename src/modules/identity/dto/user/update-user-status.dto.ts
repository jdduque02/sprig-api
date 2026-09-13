import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ example: true, description: 'Estado activo del usuario.' })
  @IsBoolean()
  is_active!: boolean;
}

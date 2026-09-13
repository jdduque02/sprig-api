import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token obtenido en el login. Opcional si se envía cookie httpOnly cm_refresh_token.',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

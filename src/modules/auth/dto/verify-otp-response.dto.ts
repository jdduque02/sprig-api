import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpResponseDto {
  @ApiProperty({
    description:
      'Token de reset firmado (HMAC) para cambiar la contraseña en POST /auth/reset-password.',
    example: '10.1772311234.abcdef...',
  })
  reset_token!: string;

  @ApiProperty({ example: 900, description: 'Segundos de vigencia del token.' })
  expires_in_seconds!: number;
}

import { ApiProperty } from '@nestjs/swagger';

export class EncryptPasswordResponseDto {
  @ApiProperty({
    example: 'base64iv:base64authTag:base64encrypted',
    description:
      'Contraseña encriptada en formato iv:authTag:ciphertext (base64)',
  })
  encrypted_password!: string;
}

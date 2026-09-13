import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan_perez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El usuario solo puede contener letras, números y guiones bajos.',
  })
  username!: string;

  @ApiProperty({
    example: 'a3F8dG1rOjEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',
    description:
      'Contraseña encriptada con AES-256-GCM (formato base64iv:base64authTag:base64ciphertext). ' +
      'Obtener con POST /auth/encrypt antes de usar este endpoint.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  password!: string;
}

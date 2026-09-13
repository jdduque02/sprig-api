import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Token de reset obtenido en POST /auth/verify-otp.',
    example: '10.1772311234.abcdef...',
  })
  @IsString()
  reset_token!: string;

  @ApiProperty({
    description: 'Nueva contraseña (texto plano, se cambia en Keycloak).',
    example: 'NuevaClave123!!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(
    /(?=(?:.*[A-Z]){2})(?=(?:.*[a-z]){2})(?=(?:.*\d){2})(?=.*[^A-Za-z0-9])(?![.\n]).{8,}/,
    {
      message:
        'La contraseña debe tener mínimo 8 caracteres, 2 mayúsculas, 2 minúsculas, 2 números y 1 carácter especial.',
    },
  )
  new_password!: string;
}

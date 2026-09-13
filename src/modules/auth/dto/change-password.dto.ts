import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario.',
    example: 'MiViejaContraseña123!',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description:
      'Nueva contraseña (mínimo 8 caracteres, 2 mayúsculas, 2 minúsculas, 2 números y 1 carácter especial).',
    example: 'MiNuevaClave456!!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(
    /(?=(?:.*[A-Z]){2})(?=(?:.*[a-z]){2})(?=(?:.*\d){2})(?=.*[^A-Za-z0-9])(?![.\n]).{8,}/,
    {
      message:
        'La contraseña debe tener mínimo 8 caracteres, 2 mayúsculas, 2 minúsculas, 2 números y 1 carácter especial.',
    },
  )
  newPassword!: string;
}

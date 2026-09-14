import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la actualización parcial de un usuario.
 * Excluye `is_active` — solo los admins pueden activar/desactivar usuarios.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario.',
    example: 'juan.perez@example.com',
    maxLength: 200,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario único para acceder al sistema.',
    example: 'juan_perez',
    minLength: 3,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @ApiPropertyOptional({
    description:
      'Nueva contraseña (mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial).',
    example: 'NuevaClave2026!',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/)
  password?: string;

  @ApiPropertyOptional({
    description: 'Configuración regional del usuario (ej. es, en, fr).',
    example: 'es',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({
    description: 'Zona horaria para cálculos de fechas.',
    example: 'America/Bogota',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Objeto con datos adicionales personalizados.',
    example: { prefered_theme: 'dark', notifications: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Número de teléfono o celular del usuario (se almacena encriptado).',
    example: '+57 310 123 4567',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^(\+57\s?)?(3\d{2}\s?\d{3}\s?\d{4}|[1-9]\d{6,7})$/, {
    message:
      'El teléfono debe tener formato colombiano: +57 310 123 4567 (o 10 dígitos sin prefijo).',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Dirección física del usuario (se almacena encriptado).',
    example: 'Cra 10 #5-20, Bogotá',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({
    description: 'Nombre completo del usuario (se almacena encriptado).',
    example: 'Juan Pérez García',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  full_name?: string;

  @ApiPropertyOptional({
    description: 'Número de documento de identidad (se almacena encriptado).',
    example: '1234567890',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document_id?: string;
}

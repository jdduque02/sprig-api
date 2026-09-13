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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nombre de usuario único para acceder al sistema.',
    example: 'juan_perez',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    description: 'Correo electrónico de contacto.',
    example: 'juan.perez@ejemplo.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description:
      'Contraseña inicial del usuario (mínimo 8 caracteres, 2 mayúsculas, 2 minúsculas, 2 números y 1 carácter especial).',
    example: 'Admin123!!',
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
  password!: string;

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
      'Número de teléfono o celular del usuario (se almacena encriptado). Formato Colombia: +57 310 123 4567 o 3101234567.',
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

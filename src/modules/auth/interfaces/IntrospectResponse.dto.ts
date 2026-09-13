import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RealmAccess {
  @ApiProperty({ example: ['user', 'admin'] })
  roles!: string[];
}

export class IntrospectResponse {
  @ApiProperty({ example: true })
  active!: boolean;

  @ApiPropertyOptional({
    example: 1776630996,
    description: 'Unix timestamp de expiración',
  })
  exp?: number;

  @ApiPropertyOptional({
    example: 1776630696,
    description: 'Unix timestamp de emisión',
  })
  iat?: number;

  @ApiPropertyOptional({
    example: '406161a6-c969-40d9-a7a9-f57cb29e3fe7',
    description: 'ID del usuario en Keycloak',
  })
  sub?: string;

  @ApiPropertyOptional({ example: 'juan_perez' })
  username?: string;

  @ApiPropertyOptional({ example: 'juan.perez@ejemplo.com' })
  email?: string;

  @ApiPropertyOptional({ type: RealmAccess })
  realm_access?: RealmAccess;

  @ApiPropertyOptional({
    example: 245,
    description: 'Segundos restantes de vigencia del token',
  })
  expires_in_seconds?: number;

  @ApiPropertyOptional({
    example: 1234567890,
    description: 'ID del usuario en PostgreSQL',
  })
  userId?: number;

  @ApiPropertyOptional({
    example: 'es-CO',
    description: 'Preferencia de idioma/región del usuario (app_user.locale)',
  })
  locale?: string;
}

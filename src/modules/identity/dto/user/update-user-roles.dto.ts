import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

export const ALLOWED_REALM_ROLES = ['user', 'admin'] as const;
export type AllowedRealmRole = (typeof ALLOWED_REALM_ROLES)[number];

export class UpdateUserRolesDto {
  @ApiProperty({
    description: 'Roles de realm a asignar (reemplaza el conjunto actual).',
    example: ['user', 'admin'],
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(ALLOWED_REALM_ROLES, { each: true })
  roles!: AllowedRealmRole[];
}

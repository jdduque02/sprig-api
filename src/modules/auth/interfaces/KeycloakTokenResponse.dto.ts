import { ApiProperty } from '@nestjs/swagger';

export class KeycloakTokenResponse {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5...' })
  access_token!: string;

  @ApiProperty({ example: 300 })
  expires_in!: number;

  @ApiProperty({ example: 1800 })
  refresh_expires_in!: number;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5...' })
  refresh_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ example: 'a1b2c3d4-...' })
  session_state!: string;

  @ApiProperty({ example: 'profile email' })
  scope!: string;

  @ApiProperty({ example: 1 })
  userId!: number;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EncryptPasswordDto {
  @ApiProperty({ example: 'MiContraseñaSegura123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

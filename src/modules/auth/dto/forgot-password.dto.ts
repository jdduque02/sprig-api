import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'juan.perez@ejemplo.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

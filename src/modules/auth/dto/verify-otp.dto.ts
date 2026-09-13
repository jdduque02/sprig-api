import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Código OTP de 6 dígitos.' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código OTP debe tener 6 dígitos.' })
  code!: string;
}

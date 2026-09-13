import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportRequestDto {
  @ApiProperty({
    description: 'Asunto de la solicitud de soporte.',
    example: 'No reconoce el extracto de mi banco',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    description: 'Descripción detallada del problema.',
    example:
      'Al cargar el PDF de mi banco el sistema no detecta ninguna transacción.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;
}

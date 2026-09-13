import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class BroadcastEmailDto {
  @ApiProperty({
    description: 'Asunto del correo (como el título de una noticia).',
    example: 'Novedades de agosto: nuevas tasas de ahorro',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({
    description:
      'Cuerpo HTML del correo. Puede usar los marcadores {{name}} y {{year}}.',
    example:
      '<h1>Hola {{name}}</h1><p>Te contamos las novedades de este mes.</p>',
  })
  @IsString()
  @MinLength(1)
  html_body!: string;
}

export class BroadcastEmailResponseDto {
  @ApiProperty({ example: 'broadcast_1723728000000' })
  key!: string;

  @ApiProperty({ example: 'Novedades de agosto: nuevas tasas de ahorro' })
  subject!: string;

  @ApiProperty({ example: 42 })
  recipients!: number;

  @ApiProperty({ example: 40 })
  sent!: number;

  @ApiProperty({ example: 2 })
  failed!: number;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];

  constructor(partial: Partial<BroadcastEmailResponseDto>) {
    Object.assign(this, partial);
  }
}

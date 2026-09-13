import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/**
 * Limpia HTML peligroso de plantillas de correo.
 * Elimina script, event handlers y javascript: URLs.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'void:')
    .replace(/data\s*:/gi, 'void:');
}

export class UpdateEmailTemplateDto {
  @ApiProperty({
    description: 'Asunto del correo.',
    example: 'Tu código de recuperación de contraseña',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({
    description:
      'Cuerpo HTML del correo. Puede usar los marcadores {{otp}}, {{name}} y {{year}}.',
    example: '<p>Tu código es {{otp}}</p>',
  })
  @IsString()
  @MinLength(1)
  html_body!: string;

  /** Sanitiza el HTML antes de validarlo. */
  static sanitize(raw: string): string {
    return sanitizeHtml(raw);
  }
}

export class EmailTemplateResponseDto {
  @ApiProperty({ example: 'otp_password_reset' })
  key!: string;

  @ApiProperty({ example: 'Tu código de recuperación de contraseña' })
  subject!: string;

  @ApiProperty({ example: '<p>Tu código es {{otp}}</p>' })
  html_body!: string;

  @ApiPropertyOptional()
  updated_at!: Date | null;

  constructor(partial: Partial<EmailTemplateResponseDto>) {
    Object.assign(this, partial);
  }
}

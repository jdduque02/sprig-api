import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { render } from '@react-email/render';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { EmailTemplate } from '../entities/email-template.entity';
import OtpPasswordResetEmail from '../templates/otp-password-reset';
import {
  BroadcastEmailDto,
  BroadcastEmailResponseDto,
} from '../dto/broadcast-email.dto';

export const OTP_EMAIL_TEMPLATE_KEY = 'otp_password_reset';
export const DEFAULT_OTP_SUBJECT = 'Tu código de recuperación de contraseña';

/**
 * Servicio de correo basado en Nodemailer + plantillas react-email.
 * Si `MAIL_ENABLED=false` (o no hay host configurado), el envío se registra
 * en logs y no se hace (útil en desarrollo sin SMTP).
 * Permite personalizar la plantilla OTP desde mail.email_template (key
 * `otp_password_reset`): el HTML guardado puede usar los marcadores
 * {{otp}}, {{name}} y {{year}}.
 */
@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    private readonly userRepository: UserRepository,
  ) {
    const enabled =
      this.configService.get<string>('MAIL_ENABLED', 'false') === 'true';
    const host = this.configService.get<string>('MAIL_HOST');
    if (!enabled || !host) {
      this.logger.warn(
        'Correo deshabilitado (MAIL_ENABLED=false o MAIL_HOST vacío). Los emails se registran en logs.',
      );
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.configService.get<string>('MAIL_PORT', '465')),
      secure: this.configService.get<string>('MAIL_SECURE', 'true') === 'true',
      auth: {
        user: this.configService.get<string>('MAIL_USER', ''),
        pass: this.configService.get<string>('MAIL_PASS', ''),
      },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Se siembra con MÁS marcadores ({{otp}}, {{name}}, {{year}}) y no con
    // valores fijos: así el HTML guardado puede reemplazarse por correo.
    // (Históricamente se renderizaba con '123456'/'usuario' incrustados y
    // sendOtp reemplazaba sobre marcadores inexistentes → mismo código en
    // todos los correos.)
    const seededHtml = await render(
      OtpPasswordResetEmail({
        name: '{{name}}',
        otpCode: '{{otp}}',
        year: '{{year}}',
      }),
    );

    try {
      const existing = await this.templateRepo.findOne({
        where: { key: OTP_EMAIL_TEMPLATE_KEY },
      });

      if (!existing) {
        await this.templateRepo.save(
          this.templateRepo.create({
            key: OTP_EMAIL_TEMPLATE_KEY,
            subject: DEFAULT_OTP_SUBJECT,
            html_body: seededHtml,
          }),
        );
        this.logger.log(
          `Plantilla por defecto "${OTP_EMAIL_TEMPLATE_KEY}" creada en mail.email_template.`,
        );
        return;
      }

      // Repara plantillas previas que no tengan el marcador {{otp}}
      // (guardadas con un código fijo incrustado).
      if (!existing.html_body.includes('{{otp}}')) {
        existing.html_body = seededHtml;
        existing.subject = existing.subject || DEFAULT_OTP_SUBJECT;
        await this.templateRepo.save(existing);
        this.logger.warn(
          `Plantilla "${OTP_EMAIL_TEMPLATE_KEY}" reparada: se reemplazó el HTML por una versión con los marcadores {{otp}}, {{name}} y {{year}}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'No se pudo crear/reparar la plantilla por defecto',
        error as Error,
      );
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  private get from(): string {
    return (
      this.configService.get<string>('MAIL_FROM') ??
      'Sprig <no-reply@sprig.local>'
    );
  }

  /**
   * Envía el correo OTP de recuperación de contraseña. Usa la plantilla
   * personalizada (mail.email_template) si existe y contiene el marcador
   * {{otp}}; si no (o no existe), renderiza la react-email con el código
   * real para garantizar que el correo lleve SIEMPRE el código generado.
   */
  async sendOtp(to: string, code: string, name?: string): Promise<void> {
    let subject = DEFAULT_OTP_SUBJECT;
    let html: string;

    const custom = await this.templateRepo.findOne({
      where: { key: OTP_EMAIL_TEMPLATE_KEY },
    });
    const year = String(new Date().getFullYear());

    if (custom && custom.html_body.includes('{{otp}}')) {
      html = custom.html_body
        .replace(/{{otp}}/g, code)
        .replace(/{{name}}/g, name ?? '')
        .replace(/{{year}}/g, year);
      subject = custom.subject || subject;
    } else {
      if (custom) {
        this.logger.warn(
          `Plantilla "${OTP_EMAIL_TEMPLATE_KEY}" sin marcador {{otp}}; se usa la react-email por defecto con el código real.`,
        );
      }
      html = await render(
        OtpPasswordResetEmail({
          name,
          otpCode: code,
          year,
        }),
      );
    }

    await this.send({
      to,
      subject,
      html,
      text: `Su código de recuperación es ${code}`,
    });
  }

  /**
   * Crea un correo tipo noticia y lo envía a todos los usuarios activos.
   * Persiste la plantilla en mail.email_template con key `broadcast_<ts>`.
   * Marcadores soportados: {{name}}, {{year}}.
   */
  async sendBroadcast(
    dto: BroadcastEmailDto,
  ): Promise<BroadcastEmailResponseDto> {
    const key = `broadcast_${Date.now()}`;
    const year = String(new Date().getFullYear());

    await this.templateRepo.save(
      this.templateRepo.create({
        key,
        subject: dto.subject,
        html_body: dto.html_body,
      }),
    );
    this.logger.log(`Plantilla de broadcast guardada: ${key}`);

    const recipients = await this.userRepository.findAllActiveEmails();
    let sent = 0;
    const errors: string[] = [];

    for (const user of recipients) {
      const html = dto.html_body
        .replace(/{{name}}/g, user.full_name ?? '')
        .replace(/{{year}}/g, year);
      try {
        await this.send({
          to: user.email,
          subject: dto.subject,
          html,
          text: dto.subject,
        });
        sent += 1;
      } catch (error) {
        const msg = `${user.email}: ${(error as Error).message}`;
        errors.push(msg);
        this.logger.warn(`Broadcast falló para ${msg}`);
      }
    }

    return new BroadcastEmailResponseDto({
      key,
      subject: dto.subject,
      recipients: recipients.length,
      sent,
      failed: errors.length,
      errors: errors.length ? errors : undefined,
    });
  }

  private async send(payload: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[mail][mock] Para=${payload.to} | Asunto="${payload.subject}" | Código OTP incluido en el HTML`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text:
          payload.text ??
          `Su código de recuperación es ${payload.html.match(/\d{6}/)?.[0] ?? ''}`,
      });
      this.logger.log(`Correo enviado a ${payload.to}: "${payload.subject}"`);
    } catch (error) {
      this.logger.error(
        `Error enviando correo a ${payload.to}`,
        error as Error,
      );
      throw error;
    }
  }
}

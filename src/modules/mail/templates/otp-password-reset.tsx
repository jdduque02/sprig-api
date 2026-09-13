import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { BRAND_PALETTE } from '@config/brand';

export interface OtpPasswordResetEmailProps {
  /** Nombre o usuario a quien se envía el correo. */
  name?: string;
  /** Código OTP de 6 dígitos. */
  otpCode: string;
  /** Año a mostrar en el pie. Por defecto usa el año actual. */
  year?: string;
}

const DEFAULT_BG = BRAND_PALETTE.neutralLight;
const BRAND = BRAND_PALETTE.primary;

/**
 * Plantilla por defecto para el correo de recuperación de contraseña con
 * OTP. Se usa cuando no hay una plantilla personalizada en
 * mail.email_template (key = otp_password_reset).
 */
export default function OtpPasswordResetEmail({
  name = '',
  otpCode,
  year = String(new Date().getFullYear()),
}: OtpPasswordResetEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tu código de recuperación es {otpCode}</Preview>
      <Body
        style={{
          backgroundColor: DEFAULT_BG,
          fontFamily: 'sans-serif',
          margin: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: BRAND_PALETTE.white,
            borderRadius: 12,
            marginTop: 24,
            marginBottom: 24,
            maxWidth: 520,
            padding: '32px 28px',
          }}
        >
          <Heading
            style={{
              color: BRAND_PALETTE.neutralDark,
              fontSize: 22,
              margin: '0 0 8px',
            }}
          >
            Recuperación de contraseña
          </Heading>
          <Text
            style={{
              color: BRAND_PALETTE.bodyMuted,
              fontSize: 15,
              lineHeight: '22px',
            }}
          >
            Hola{name ? `, ${name}` : ''}: recibimos una solicitud para
            restablecer tu contraseña. Usa el siguiente código para continuar:
          </Text>

          <Section
            style={{
              backgroundColor: BRAND_PALETTE.neutralLight,
              borderRadius: 10,
              margin: '20px 0',
              padding: '16px 12px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                color: BRAND,
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '8px',
                margin: 0,
              }}
            >
              {otpCode}
            </Text>
          </Section>

          <Text
            style={{
              color: BRAND_PALETTE.bodyMuted,
              fontSize: 14,
              lineHeight: '21px',
            }}
          >
            El código expira en <strong>10 minutos</strong>. Si no solicitaste
            este cambio, ignora este correo.
          </Text>

          <Hr
            style={{ borderColor: BRAND_PALETTE.divider, margin: '24px 0' }}
          />

          <Text
            style={{
              color: BRAND_PALETTE.footerMuted,
              fontSize: 12,
              lineHeight: '18px',
            }}
          >
            © {year} Sprig. Este es un correo automático, por favor no
            respondas.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

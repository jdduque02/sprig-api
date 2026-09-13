import { UnauthorizedException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import type { Request } from 'express';

/**
 * Extrae el Bearer token del header Authorization.
 * Lanza UnauthorizedException si el header está ausente o mal formado.
 */
export function extractBearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith('Bearer ')) {
    const i18n = I18nContext.current();
    throw new UnauthorizedException(
      i18n?.t('shared.BEARER_REQUIRED') ??
        'Se requiere un Bearer token en el header Authorization.',
    );
  }
  return authorization.slice(7);
}

/**
 * Extrae el access token del header Authorization o, como fallback,
 * de la cookie `cm_access_token` (híbrido httpOnly).
 */
export function extractAccessToken(req: Request): string {
  const authorization = req.headers['authorization'];
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7);
  }
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    'cm_access_token'
  ];
  if (cookieToken) return cookieToken;

  const i18n = I18nContext.current();
  throw new UnauthorizedException(
    i18n?.t('shared.BEARER_REQUIRED') ??
      'Se requiere un Bearer token en el header Authorization.',
  );
}

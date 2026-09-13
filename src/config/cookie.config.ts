import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'cm_refresh_token';
export const ACCESS_COOKIE_NAME = 'cm_access_token';

function baseCookieOptions(
  configService: ConfigService,
  maxAgeMs: number | undefined,
  path: string,
): CookieOptions {
  const env = configService.get<string>('NODE_ENV', 'LOCAL');
  const isProd = env === 'PROD' || env === 'DEPLOY' || env === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path,
    maxAge: maxAgeMs,
  };
}

export function getRefreshCookieOptions(
  configService: ConfigService,
  maxAgeMs?: number,
): CookieOptions {
  const apiVersion = configService.get<string>('VERSION') ?? '1';
  return baseCookieOptions(
    configService,
    maxAgeMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
    `/api/v${apiVersion}/auth`,
  );
}

export function getAccessCookieOptions(
  configService: ConfigService,
  maxAgeMs?: number,
): CookieOptions {
  const apiVersion = configService.get<string>('VERSION') ?? '1';
  return baseCookieOptions(
    configService,
    maxAgeMs ?? 5 * 60 * 1000,
    `/api/v${apiVersion}`,
  );
}

export function clearRefreshCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return {
    ...getRefreshCookieOptions(configService, 0),
    maxAge: 0,
  };
}

export function clearAccessCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return {
    ...getAccessCookieOptions(configService, 0),
    maxAge: 0,
  };
}

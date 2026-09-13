import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  extractAccessToken,
  extractBearerToken,
} from '@shared/helpers/bearer-token.helper';

describe('extractBearerToken', () => {
  it('should extract the token from a valid Bearer string', () => {
    const authHeader = 'Bearer my-secret-token';
    const result = extractBearerToken(authHeader);
    expect(result).toBe('my-secret-token');
  });

  it('should throw UnauthorizedException if header is undefined', () => {
    expect(() => extractBearerToken(undefined)).toThrow(UnauthorizedException);
    expect(() => extractBearerToken(undefined)).toThrow(
      'Se requiere un Bearer token en el header Authorization.',
    );
  });

  it('should throw UnauthorizedException if header does not start with Bearer', () => {
    const authHeader = 'Basic dXNlcjpwYXNz';
    expect(() => extractBearerToken(authHeader)).toThrow(UnauthorizedException);
  });

  it('should return an empty string if header is just "Bearer "', () => {
    const authHeader = 'Bearer ';
    // The helper only checks startsWith('Bearer ') and then slices.
    const result = extractBearerToken(authHeader);
    expect(result).toBe('');
  });
});

describe('extractAccessToken', () => {
  const buildRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      headers: {},
      cookies: {},
      ...overrides,
    }) as unknown as Request;

  it('debe extraer el token del header Authorization si está presente', () => {
    const req = buildRequest({
      headers: { authorization: 'Bearer header-token' } as never,
    });

    expect(extractAccessToken(req)).toBe('header-token');
  });

  it('debe usar la cookie cm_access_token si no hay header Authorization', () => {
    const req = buildRequest({
      cookies: { cm_access_token: 'cookie-token' } as never,
    });

    expect(extractAccessToken(req)).toBe('cookie-token');
  });

  it('debe lanzar UnauthorizedException si no hay header ni cookie', () => {
    const req = buildRequest();

    expect(() => extractAccessToken(req)).toThrow(UnauthorizedException);
  });
});

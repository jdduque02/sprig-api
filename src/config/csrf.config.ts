import { ConfigService } from '@nestjs/config';
import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';

/**
 * Builds the CSRF double-submit cookie protection middleware.
 *
 * Uses the `csrf-csrf` library which implements the Double Submit Cookie pattern:
 *  - A signed CSRF token is stored in a cookie (`x-csrf-token`).
 *  - The client must send this token back in a request header or body.
 *  - Both values are compared on the server to validate the request.
 *
 * @param configService - NestJS ConfigService instance to read env vars.
 * @returns `doubleCsrfProtection` Express middleware ready to use with `app.use(...)`.
 */
export function getCsrfProtection(configService: ConfigService) {
  const { doubleCsrfProtection } = doubleCsrf({
    /**
     * Secret used to sign the CSRF token.
     * Falls back to a default string when CSRF_SECRET is not set (dev only).
     */
    getSecret: () =>
      configService.get<string>('CSRF_SECRET') ?? 'csrf-super-secret',

    /** Name of the cookie that holds the CSRF token. */
    cookieName: 'x-csrf-token',

    cookieOptions: {
      /**
       * `lax` ensures the cookie is sent on top-level navigations (forms, links)
       * but NOT on cross-site sub-resource requests (e.g. fetch from another domain).
       */
      sameSite: 'lax',

      /**
       * Mark the cookie as Secure only in production so that HTTPS is enforced.
       * In development (NODE_ENV !== 'PROD') the cookie is sent over plain HTTP as well.
       */
      secure: ['PROD', 'DEPLOY', 'production'].includes(
        configService.get<string>('NODE_ENV', 'LOCAL'),
      ),
    },

    /**
     * `getSessionIdentifier` is required in csrf-csrf v4+.
     *
     * For stateless REST APIs that don't use express-session:
     *  - We reuse the value of the CSRF cookie itself as the session identifier,
     *    which ties the token to a specific cookie value per request cycle.
     *  - If the cookie is not yet present (first request), we fall back to a
     *    constant string so that token generation still works.
     */
    getSessionIdentifier: (req: Request) =>
      (req?.cookies?.['x-csrf-token'] as string | undefined) ||
      'stateless-session',

    /**
     * Safe HTTP methods that do NOT mutate server state.
     * These are excluded from CSRF validation to avoid breaking read-only flows.
     */
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  return doubleCsrfProtection;
}

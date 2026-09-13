import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { extractAccessToken } from '@shared/helpers/bearer-token.helper';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

export interface FakeTestUser {
  userId: number;
  sub?: string;
  username?: string;
  email?: string;
  roles?: string[];
}

/**
 * Codifica un usuario de prueba en un "token" opaco que `TestAuthGuard`
 * sabe decodificar. Evita depender de Keycloak real en los e2e.
 */
export function buildTestToken(user: FakeTestUser): string {
  return Buffer.from(JSON.stringify(user), 'utf-8').toString('base64');
}

export function authHeader(user: FakeTestUser): [string, string] {
  return ['Authorization', `Bearer ${buildTestToken(user)}`];
}

/**
 * Reemplazo de `AuthGuard` para e2e: no llama a Keycloak, decodifica el
 * token fabricado por `buildTestToken`/`authHeader` y puebla `request.user`
 * igual que lo haría `AuthService.introspect` en producción, para que
 * `OwnershipGuard`/`AdminGuard` (guards reales, sin mockear) se comporten
 * igual que en el flujo real.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(request);

    let decoded: FakeTestUser;
    try {
      decoded = JSON.parse(
        Buffer.from(token, 'base64').toString('utf-8'),
      ) as FakeTestUser;
      if (!decoded || typeof decoded.userId !== 'number') {
        throw new Error('invalid payload');
      }
    } catch {
      throw new UnauthorizedException('Token de prueba inválido.');
    }

    const result: IntrospectResponse = {
      active: true,
      userId: decoded.userId,
      sub: decoded.sub ?? `test-sub-${decoded.userId}`,
      username: decoded.username ?? `test-user-${decoded.userId}`,
      email: decoded.email ?? `test-user-${decoded.userId}@sprig.test`,
      realm_access: { roles: decoded.roles ?? ['user'] },
      locale: 'es-CO',
    };

    (request as Request & { user: IntrospectResponse }).user = result;
    return true;
  }
}

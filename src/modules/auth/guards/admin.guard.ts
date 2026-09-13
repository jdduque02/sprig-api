import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Request } from 'express';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

/**
 * Restringe el acceso a usuarios con rol `admin` en Keycloak.
 * Debe usarse junto con AuthGuard para que `request.user` esté poblado.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(I18nService) private readonly i18n: I18nService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: IntrospectResponse }>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_REVOKED'));
    }

    const roles = user.realm_access?.roles ?? [];
    if (!roles.includes('admin')) {
      throw new ForbiddenException(this.i18n.t('identity.FORBIDDEN'));
    }

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Request } from 'express';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly i18n: I18nService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: IntrospectResponse }>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_REVOKED'));
    }

    const raw = request.params.userId ?? request.params.id;
    const routeUserId = Number.parseInt(String(raw), 10);

    if (Number.isNaN(routeUserId) || routeUserId !== user.userId) {
      throw new ForbiddenException(this.i18n.t('identity.FORBIDDEN'));
    }

    return true;
  }
}

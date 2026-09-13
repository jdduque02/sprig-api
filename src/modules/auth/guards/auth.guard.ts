import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { AuthService } from '@auth/service/auth.service';
import { extractAccessToken } from '@shared/helpers/bearer-token.helper';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(request);
    const result = await this.authService.introspect(token);

    if (!result.active) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_REVOKED'));
    }

    // Adjunta el payload del token al request para uso posterior
    (request as Request & { user: typeof result }).user = result;

    return true;
  }
}

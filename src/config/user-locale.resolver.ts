import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';
import { Request } from 'express';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

/**
 * Resuelve el idioma de la petición a partir del `locale` guardado en
 * `app_user.locale` para el usuario autenticado (adjuntado por AuthGuard
 * en `request.user`, ver IntrospectResponse).
 *
 * Normaliza formatos regionales (`es-CO`, `en-US`) al código de idioma
 * base (`es`, `en`) usado como nombre de archivo en src/i18n.
 *
 * Es infraestructura técnica de i18n (no lógica de negocio de un dominio
 * específico), por eso vive junto a la configuración de i18n y se registra
 * como el primer resolver: si hay usuario autenticado con locale, gana
 * sobre los headers; si no, los resolvers de headers (HeaderResolver,
 * AcceptLanguageResolver) siguen aplicando como fallback.
 */
@Injectable()
export class UserLocaleResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    if (context.getType() !== 'http') return undefined;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: IntrospectResponse }>();

    const locale = request?.user?.locale;
    if (!locale) return undefined;

    return this.normalize(locale);
  }

  private normalize(locale: string): string | undefined {
    const base = locale.split(/[-_]/)[0]?.toLowerCase().trim();
    return base || undefined;
  }
}

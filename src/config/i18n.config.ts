import { join } from 'path';
import { I18nOptions } from 'nestjs-i18n';
import { HeaderResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { UserLocaleResolver } from './user-locale.resolver';

export const getI18nConfig = (): I18nOptions => ({
  fallbackLanguage: 'es',
  resolvers: [
    // Prioridad: preferencia guardada del usuario autenticado (app_user.locale)
    // por encima de los headers, que actúan como fallback para requests
    // sin autenticar o usuarios sin locale configurado.
    UserLocaleResolver,
    new HeaderResolver(['x-lang', 'X-Language']),
    new AcceptLanguageResolver(),
  ],
  loaderOptions: {
    path: join(__dirname, '..', 'i18n'),
    watch: true,
  },
});

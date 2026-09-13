import { getI18nConfig } from '@config/i18n.config';
import { UserLocaleResolver } from '@config/user-locale.resolver';

describe('getI18nConfig', () => {
  it('retorna la configuración de i18n', () => {
    const config = getI18nConfig();
    expect(config.fallbackLanguage).toBe('es');
    expect(config.resolvers).toHaveLength(3);
    expect(config.loaderOptions).toMatchObject({ watch: true });
  });

  it('prioriza UserLocaleResolver por encima de los resolvers de headers', () => {
    const config = getI18nConfig();
    expect(config.resolvers?.[0]).toBe(UserLocaleResolver);
  });
});

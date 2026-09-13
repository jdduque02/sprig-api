import { ExecutionContext } from '@nestjs/common';
import { UserLocaleResolver } from '@config/user-locale.resolver';

describe('UserLocaleResolver', () => {
  let resolver: UserLocaleResolver;

  const buildHttpContext = (user?: { locale?: string }): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    resolver = new UserLocaleResolver();
  });

  it('normaliza es-CO a es', () => {
    const context = buildHttpContext({ locale: 'es-CO' });
    expect(resolver.resolve(context)).toBe('es');
  });

  it('normaliza en-US a en', () => {
    const context = buildHttpContext({ locale: 'en-US' });
    expect(resolver.resolve(context)).toBe('en');
  });

  it('normaliza formatos con guion bajo (es_CO)', () => {
    const context = buildHttpContext({ locale: 'es_CO' });
    expect(resolver.resolve(context)).toBe('es');
  });

  it('devuelve undefined si no hay usuario autenticado', () => {
    const context = buildHttpContext(undefined);
    expect(resolver.resolve(context)).toBeUndefined();
  });

  it('devuelve undefined si el usuario no tiene locale', () => {
    const context = buildHttpContext({});
    expect(resolver.resolve(context)).toBeUndefined();
  });

  it('devuelve undefined para contextos no HTTP (ws/rpc)', () => {
    const context = {
      getType: () => 'ws',
    } as unknown as ExecutionContext;
    expect(resolver.resolve(context)).toBeUndefined();
  });
});

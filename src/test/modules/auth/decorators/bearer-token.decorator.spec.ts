import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { BearerToken } from '@auth/decorators/bearer-token.decorator';

describe('BearerToken decorator', () => {
  class TestController {
    test(@BearerToken() token: string): string {
      return token;
    }
  }

  const getFactory = (): ((data: unknown, ctx: ExecutionContext) => string) => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'test',
    ) as Record<
      string,
      { factory?: (data: unknown, ctx: ExecutionContext) => string }
    >;

    const key = Object.keys(metadata)[0];
    return metadata[key].factory!;
  };

  it('debe registrar metadata del parámetro con factory', () => {
    const factory = getFactory();
    expect(typeof factory).toBe('function');
  });

  it('debe extraer el token Bearer del header Authorization', () => {
    const factory = getFactory();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer token-123' } }),
      }),
    } as unknown as ExecutionContext;

    const token = factory(undefined, context);
    expect(token).toBe('token-123');
  });

  it('debe lanzar error si el header Authorization no tiene formato Bearer', () => {
    const factory = getFactory();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Basic abc' } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => factory(undefined, context)).toThrow();
  });
});

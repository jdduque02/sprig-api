import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

describe('CurrentUser decorator', () => {
  class TestController {
    test(@CurrentUser() user: IntrospectResponse): IntrospectResponse {
      return user;
    }
  }

  const getFactory = (): ((
    data: unknown,
    ctx: ExecutionContext,
  ) => IntrospectResponse) => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'test',
    ) as Record<
      string,
      {
        factory?: (data: unknown, ctx: ExecutionContext) => IntrospectResponse;
      }
    >;

    const key = Object.keys(metadata)[0];
    return metadata[key].factory!;
  };

  it('debe registrar metadata del parámetro con factory', () => {
    const factory = getFactory();
    expect(typeof factory).toBe('function');
  });

  it('debe extraer el usuario autenticado desde request.user', () => {
    const factory = getFactory();
    const user = {
      sub: 'kc-uuid',
      userId: 10,
    } as unknown as IntrospectResponse;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, context);

    expect(result).toBe(user);
  });
});

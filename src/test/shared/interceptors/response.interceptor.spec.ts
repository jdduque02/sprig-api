import { ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor';
import { I18nService } from 'nestjs-i18n';

describe('ResponseInterceptor', () => {
  const mockI18nService = {
    t: jest.fn((key: string) => `[${key}]`),
  };

  const createInterceptor = (): ResponseInterceptor =>
    new ResponseInterceptor(mockI18nService as unknown as I18nService);

  const buildContext = (statusCode = 200): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/users' }),
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  it('debe transformar objeto plano a ApiResponseDto con data como array', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const next = { handle: () => of({ id: 1, username: 'juan' }) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result.status).toBe(true);
    expect(result.message).toBe('[shared.SUCCESS]');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toEqual({ id: 1, username: 'juan' });
    expect(result.timestamp).toBeDefined();
  });

  it('debe mantener la respuesta si ya tiene formato ApiResponseDto', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const dto = {
      status: true,
      message: 'Ya formateado',
      data: [{ ok: true }],
      timestamp: new Date(),
    };
    const next = { handle: () => of(dto) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );
    expect(result).toBe(dto);
  });

  it('debe mapear null a data vacío', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(204);
    const next = { handle: () => of(null) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result.status).toBe(true);
    expect(result.message).toBe('[shared.NO_CONTENT]');
    expect(result.data).toEqual([]);
  });

  it('debe preservar total en respuestas paginadas', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const next = { handle: () => of({ data: [{ id: 1 }], total: 1 }) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result.status).toBe(true);
    expect(result.total).toBe(1);
    expect(result.data).toEqual([{ id: 1 }]);
  });

  it('debe mantener el arreglo cuando la respuesta ya es un arreglo', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const next = { handle: () => of([{ id: 1 }, { id: 2 }]) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('debe usar el mensaje por defecto para status no mapeado', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(302);
    const next = { handle: () => of({ id: 1 }) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result.message).toBe('[shared.SUCCESS]');
  });

  it('debe registrar una advertencia cuando la respuesta tiene status false', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const dto = {
      status: false,
      message: 'Respuesta de error formateada',
      data: [],
      timestamp: new Date(),
    };
    const next = { handle: () => of(dto) };

    const result = await firstValueFrom(
      interceptor.intercept(context, next as any),
    );

    expect(result).toBe(dto);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('debe propagar errores sin transformarlos', async () => {
    const interceptor = createInterceptor();
    const context = buildContext(200);
    const next = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      firstValueFrom(interceptor.intercept(context, next as any)),
    ).rejects.toThrow('boom');
  });
});

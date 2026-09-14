import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { ErrorsInterceptor } from '@shared/interceptors/error.interceptor';
import { LoggingService } from '@shared/services/logging.service';
import { I18nService, I18nValidationException } from 'nestjs-i18n';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'trace-id-123'),
}));

describe('ErrorsInterceptor', () => {
  let loggingService: {
    sendLog: jest.Mock<
      Promise<void>,
      [data: unknown, severity: string, context: string]
    >;
  };
  let i18nService: jest.Mocked<I18nService>;
  let interceptor: ErrorsInterceptor;

  const buildContext = (path = '/api/test'): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: path }),
      }),
    }) as unknown as ExecutionContext;

  const buildNext = (source$: Observable<any>): CallHandler => ({
    handle: () => source$,
  });

  beforeEach(() => {
    loggingService = {
      sendLog: jest.fn((_data: unknown, _severity: string, _context: string) =>
        Promise.resolve(undefined),
      ),
    };

    i18nService = {
      t: jest.fn((key: string) => `[${key}]`),
    } as unknown as jest.Mocked<I18nService>;

    interceptor = new ErrorsInterceptor(
      loggingService as unknown as LoggingService,
      i18nService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes through successful responses unchanged', async () => {
    const context = buildContext();
    const payload = { id: 1, name: 'test' };
    const next = buildNext(of(payload));

    const result: unknown = await firstValueFrom(
      interceptor.intercept(context, next),
    );

    expect(result).toEqual(payload);
    expect(loggingService.sendLog).not.toHaveBeenCalled();
  });

  it('catches HttpException and re-throws with status preserved', async () => {
    const context = buildContext('/users');
    const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        status: HttpStatus.FORBIDDEN,
        path: '/users',
      });
    }
  });

  it('catches non-HTTP error and wraps in InternalServerErrorException with trace_id', async () => {
    const context = buildContext('/db/query');
    const error = new Error('connection refused');
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.trace_id).toBe('trace-id-123');
      expect(body.path).toBe('/db/query');
    }
  });

  it('catches I18nValidationException with details', async () => {
    const context = buildContext('/register');
    const i18nErrors = [
      {
        property: 'email',
        constraints: { isEmail: 'Invalid email format' },
      },
      {
        property: 'password',
        constraints: { minLength: 'Too short' },
      },
    ];
    const error = new I18nValidationException(i18nErrors as never);
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.details).toEqual([
        { property: 'email', constraints: { isEmail: 'Invalid email format' } },
        { property: 'password', constraints: { minLength: 'Too short' } },
      ]);
    }
  });

  it('catches HttpException with string response', async () => {
    const context = buildContext('/raw');
    const error = new HttpException('Not found', HttpStatus.NOT_FOUND);
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.message).toBe('Not found');
      expect(body.path).toBe('/raw');
    }
  });

  it('catches HttpException with object response containing message', async () => {
    const context = buildContext('/validate');
    const error = new HttpException(
      { message: 'Validation failed', details: [{ field: 'name' }] },
      HttpStatus.BAD_REQUEST,
    );
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.message).toBe('Validation failed');
      expect(body.details).toEqual([{ field: 'name' }]);
    }
  });

  it('captures stack trace from plain Error', async () => {
    const context = buildContext('/stack');
    const error = new Error('something broke');
    const next = buildNext(throwError(() => error));

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('Expected exception to be thrown');
    } catch {
      expect(loggingService.sendLog).toHaveBeenCalledTimes(1);
      const logData = loggingService.sendLog.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(logData.stack).toBe(error.stack);
    }
  });

  it('calls loggingService.sendLog with ERROR for 500, WARNING for others', async () => {
    const context500 = buildContext('/crash');
    const next500 = buildNext(throwError(() => new Error('crash')));

    try {
      await firstValueFrom(interceptor.intercept(context500, next500));
    } catch {
      // expected
    }

    expect(loggingService.sendLog).toHaveBeenCalledTimes(1);
    expect(loggingService.sendLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: HttpStatus.INTERNAL_SERVER_ERROR }),
      'ERROR',
      'ErrorsInterceptor',
    );

    jest.clearAllMocks();

    const context400 = buildContext('/bad-request');
    const next400 = buildNext(
      throwError(() => new HttpException('Bad', HttpStatus.BAD_REQUEST)),
    );

    try {
      await firstValueFrom(interceptor.intercept(context400, next400));
    } catch {
      // expected
    }

    expect(loggingService.sendLog).toHaveBeenCalledTimes(1);
    expect(loggingService.sendLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: HttpStatus.BAD_REQUEST }),
      'WARNING',
      'ErrorsInterceptor',
    );
  });
});

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { I18nService, I18nValidationException } from 'nestjs-i18n';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';

interface FilterResponseBody {
  status: number;
  error: string;
  message: unknown;
  details: unknown;
  path: string;
  trace_id?: string;
}

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'trace-123'),
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: { originalUrl: string };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    request = {
      originalUrl: '/user/1/financial-profile',
    };

    host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
  });

  it('debe retornar body ya formateado sin modificarlo', () => {
    const alreadyFormatted = {
      status: 401,
      error: 'Unauthorized',
      message: 'Token inválido',
      timestamp: '2026-04-19T00:00:00.000Z',
      path: '/x',
    };
    const exception = new HttpException(
      alreadyFormatted,
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(response.json).toHaveBeenCalledWith(alreadyFormatted);
  });

  it('debe formatear correctamente cuando getResponse() es string', () => {
    const exception = new HttpException(
      'Mensaje plano',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody;
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(body.status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.error).toBe('Http');
    expect(body.message).toBe('Mensaje plano');
    expect(body.details).toEqual([]);
    expect(body.path).toBe('/user/1/financial-profile');
  });

  it('debe mapear array de mensajes a details con mensaje genérico de validación', () => {
    const payload = {
      message: ['email must be an email', 'password should not be empty'],
      error: 'Bad Request',
    };
    const exception = new HttpException(payload, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody;
    expect(body.message).toBe('Datos de entrada inválidos.');
    expect(body.details).toEqual(payload.message);
    expect(body.error).toBe('Bad Request');
  });

  it('debe usar message/error del objeto cuando message es string', () => {
    const payload = {
      message: 'No autorizado',
      error: 'Unauthorized',
    };
    const exception = new HttpException(payload, HttpStatus.UNAUTHORIZED);

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody;
    expect(body.message).toBe('No autorizado');
    expect(body.error).toBe('Unauthorized');
    expect(body.details).toEqual([]);
  });

  it('debe agregar trace_id para errores 500', () => {
    const exception = new HttpException(
      { message: 'Error interno', error: 'Internal Server Error' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody;
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(body.trace_id).toBe('trace-123');
  });

  it('debe formatear I18nValidationException con detalles de los errores de validación', () => {
    const exception = new I18nValidationException([
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      },
      {
        property: 'password',
        constraints: { isNotEmpty: 'password should not be empty' },
      },
    ] as never);

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody & { details: { property: string }[] };
    expect(response.status).toHaveBeenCalledWith(exception.getStatus());
    expect(body.error).toBe('I18nValidationException');
    expect(body.details).toEqual([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
      {
        property: 'password',
        constraints: { isNotEmpty: 'password should not be empty' },
      },
    ]);
    expect(body.message).toBe(
      'Campos con errores de validación: email, password',
    );
    expect(body.path).toBe('/user/1/financial-profile');
  });

  it('debe usar errors=[] cuando I18nValidationException no trae errores', () => {
    const exception = new I18nValidationException(
      undefined as unknown as never,
    );

    filter.catch(exception, host);

    const body = (
      response.json.mock.calls[0] as unknown[]
    )[0] as FilterResponseBody;
    expect(body.details).toEqual([]);
    expect(body.message).toBe('Campos con errores de validación: ');
  });

  it('debe usar this.i18n inyectado por constructor cuando I18nContext.current no resuelve nada', () => {
    const i18n = {
      t: jest.fn().mockReturnValue('mensaje traducido'),
    } as unknown as I18nService;
    const filterWithI18n = new HttpExceptionFilter(i18n);
    const exception = new HttpException(
      'Mensaje plano',
      HttpStatus.BAD_REQUEST,
    );

    filterWithI18n.catch(exception, host);

    expect(i18n.t).toHaveBeenCalledWith('shared.UNEXPECTED_ERROR', {
      args: undefined,
    });
  });
});

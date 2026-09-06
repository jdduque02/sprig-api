import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  I18nService,
  I18nContext,
  I18nTranslator,
  I18nValidationException,
} from 'nestjs-i18n';

/**
 * Filtro global que captura excepciones lanzadas por Guards, Pipes y Controllers
 * y las formatea con la misma estructura que ErrorsInterceptor.
 *
 * Los Guards lanzan excepciones ANTES de que los interceptores puedan captularlas,
 * por lo que este filtro garantiza un formato de error consistente en toda la app.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional() @Inject(I18nService) private readonly i18n?: I18nService,
  ) {}

  private getI18n(host?: ArgumentsHost): I18nTranslator | undefined {
    return I18nContext.current(host) ?? this.i18n;
  }

  /**
   * Traduce una clave i18n resolviendo el idioma real de la request
   * (headers x-lang/Accept-Language o locale del usuario autenticado,
   * ver UserLocaleResolver). Si no hay contexto de request (p.ej. jobs
   * o websockets sin resolver aplicable), i18n.t() cae al fallbackLanguage
   * configurado ('es').
   */
  private translate(
    key: string,
    args?: Record<string, unknown>,
    host?: ArgumentsHost,
  ): string {
    const i18nContext = I18nContext.current(host);
    const i18n = i18nContext ?? this.i18n;
    if (!i18n) return '';
    const lang = i18nContext?.lang;
    const result: string = i18n.t(key, lang ? { lang, args } : { args });
    return result !== key ? result : '';
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const responseData = exception.getResponse();
    const timestamp = new Date().toISOString();
    const path = request.originalUrl;

    // Si el cuerpo ya fue formateado por ErrorsInterceptor, se pasa directamente
    if (
      typeof responseData === 'object' &&
      responseData !== null &&
      'error' in responseData &&
      'timestamp' in responseData
    ) {
      response.status(status).json(responseData);
      return;
    }

    // I18nValidationException: extraer detalles de validación del objeto errors
    if (exception instanceof I18nValidationException) {
      const validationErrors = exception.errors ?? [];
      const details = validationErrors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));

      const fields = details.map((d) => d.property).join(', ');
      const body: Record<string, unknown> = {
        status,
        error: 'I18nValidationException',
        message:
          this.translate('shared.INVALID_INPUT', { fields }, host) ||
          `Campos con errores de validación: ${fields}`,
        details,
        timestamp,
        path,
      };

      response.status(status).json(body);
      return;
    }

    let error = exception.name.replace('Exception', '');
    let message =
      this.translate('shared.UNEXPECTED_ERROR', undefined, host) ||
      'Error inesperado.';
    let details: unknown[] = [];

    if (typeof responseData === 'string') {
      message = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
      const resp = responseData as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(resp.message)) {
        // Errores de validación (class-validator)
        details = resp.message;
        const fields = details
          .map((d: any) => d.property)
          .filter(Boolean)
          .join(', ');
        message = fields
          ? this.translate('shared.INVALID_INPUT', { fields }, host) ||
            `Campos con errores de validación: ${fields}`
          : this.translate(
              'shared.INVALID_INPUT',
              { fields: 'desconocidos' },
              host,
            ) || 'Datos de entrada inválidos.';
      } else {
        message = resp.message ?? message;
      }
      error = resp.error ?? error;
    }

    const body: Record<string, unknown> = {
      status,
      error,
      message,
      details,
      timestamp,
      path,
    };

    if (status === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      body['trace_id'] = uuidv4();
    }

    response.status(status).json(body);
  }
}

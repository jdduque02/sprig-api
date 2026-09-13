import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  InternalServerErrorException,
  HttpStatus,
  Inject,
} from '@nestjs/common';

import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { LoggingService } from '@shared/services/logging.service';
import { I18nContext, I18nService, I18nValidationException } from 'nestjs-i18n';
import { Request } from 'express';
@Injectable()
/**
 * Intercepts and handles errors thrown during request processing in a NestJS application.
 *
 * This interceptor captures exceptions, logs detailed error information using the provided
 * `LoggingService`, and transforms the error response sent to the client. For internal server
 * errors (HTTP 500), it generates a unique trace ID and includes it in the response for easier
 * tracking. For other HTTP exceptions, it preserves the original status and message.
 *
 * @remarks
 * - Logs error details including status, error name, message, details, timestamp, request path, trace ID, and stack trace (for 500 errors).
 * - Sends logs as 'ERROR' for 500 errors and 'WARNING' for others.
 * - Returns a standardized error response structure to the client.
 *
 * @example
 * ```typescript
 * @UseInterceptors(ErrorsInterceptor)
 * ```
 *
 * @param loggingService - Service used to send error logs.
 *
 * @implements NestInterceptor
 */
export class ErrorsInterceptor implements NestInterceptor {
  constructor(
    private readonly loggingService: LoggingService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  /**
   * Traduce una clave i18n resolviendo el idioma real de la request
   * (headers x-lang/Accept-Language o locale del usuario autenticado,
   * ver UserLocaleResolver). Si no hay contexto de request disponible,
   * i18n.t() cae al fallbackLanguage configurado ('es').
   */
  private translate(
    key: string,
    args?: Record<string, unknown>,
    context?: ExecutionContext,
  ): string {
    const i18nContext = I18nContext.current(context);
    const i18n = i18nContext ?? this.i18n;
    if (!i18n) return '';
    const lang = i18nContext?.lang;
    const result: string = i18n.t(key, lang ? { lang, args } : { args });
    return result !== key ? result : '';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: Request = context.switchToHttp().getRequest();
    const path = request.originalUrl;

    return next.handle().pipe(
      catchError((err) => {
        const timestamp = new Date().toISOString();
        const traceId = uuidv4();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let error = 'Internal Server Error';
        let message: string | object =
          this.translate('shared.UNEXPECTED_SERVER', undefined, context) ??
          'Ocurrió un error inesperado. Por favor, inténtelo de nuevo más tarde.';
        let details: any[] = [];
        let stackTrace: string | undefined = undefined;

        if (err instanceof I18nValidationException) {
          status = err.getStatus();
          error = err.name;
          details = (err.errors ?? []).map((e) => ({
            property: e.property,
            constraints: e.constraints,
          }));
          const fields = details.map((d) => d.property).join(', ');
          message =
            this.translate('shared.INVALID_INPUT', { fields }, context) ??
            `Campos con errores de validación: ${fields}`;
        } else if (err instanceof HttpException) {
          status = err.getStatus();
          const responseData = err.getResponse();
          error = err.name;
          if (typeof responseData === 'string') {
            message = responseData;
          } else if (
            responseData &&
            typeof responseData === 'object' &&
            'message' in responseData
          ) {
            const resp = responseData as { message?: string; details?: any[] };
            message = typeof resp.message === 'string' ? resp.message : message;
            details = Array.isArray(resp.details) ? resp.details : [];
          }
        } else if (err && typeof err === 'object' && 'stack' in err) {
          const errorWithStack = err as Error;
          stackTrace =
            typeof errorWithStack.stack === 'string'
              ? errorWithStack.stack
              : undefined;
        }

        const logData = {
          status,
          error,
          message,
          details,
          timestamp,
          path,
          trace_id:
            status === HttpStatus.INTERNAL_SERVER_ERROR ? traceId : undefined,
          stack: stackTrace,
        };

        void this.loggingService.sendLog(
          logData,
          status === HttpStatus.INTERNAL_SERVER_ERROR ? 'ERROR' : 'WARNING',
          'ErrorsInterceptor',
        );

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
          return throwError(
            () =>
              new InternalServerErrorException({
                status,
                error,
                message,
                timestamp,
                path,
                trace_id: traceId,
              }),
          );
        } else {
          return throwError(
            () =>
              new HttpException(
                { status, error, message, details, timestamp, path },
                status,
              ),
          );
        }
      }),
    );
  }
}

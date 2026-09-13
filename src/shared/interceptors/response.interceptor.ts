import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ApiResponseDto } from '@shared/dto/api-response.dto';

/**
 * Guard de tipo para verificar si es una respuesta API válida según ApiResponseDto
 */
function isApiResponseDto(data: unknown): data is ApiResponseDto {
  return (
    data !== null &&
    typeof data === 'object' &&
    'status' in data &&
    typeof (data as Record<string, unknown>).status === 'boolean' &&
    'message' in data &&
    typeof (data as Record<string, unknown>).message === 'string' &&
    'data' in data &&
    Array.isArray((data as Record<string, unknown>).data) &&
    'timestamp' in data
  );
}

/**
 * Guard de tipo para detectar respuestas paginadas `{ data: T[], total }`.
 */
function isPaginatedResponse(
  data: unknown,
): data is { data: unknown[]; total: number } {
  return (
    data !== null &&
    typeof data === 'object' &&
    'data' in data &&
    Array.isArray((data as Record<string, unknown>).data) &&
    'total' in data &&
    typeof (data as Record<string, unknown>).total === 'number'
  );
}

@Injectable()
export class ResponseInterceptor<TData = unknown> implements NestInterceptor<
  TData,
  ApiResponseDto<TData>
> {
  private readonly logger = new Logger(ResponseInterceptor.name);

  constructor(@Inject(I18nService) private readonly i18n: I18nService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<TData>,
  ): Observable<ApiResponseDto<TData>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data: TData): ApiResponseDto<TData> => {
        const transformedResponse = this.transformResponse(data, response);
        this.logResponse(request, response, startTime, transformedResponse);
        return transformedResponse;
      }),
      catchError((error: unknown) => {
        // En caso de error, el error.interceptor.ts se encargará (o los ExceptionFilters)
        throw error;
      }),
    );
  }

  private transformResponse(
    data: TData,
    response: Response,
  ): ApiResponseDto<TData> {
    // Si ya tiene la estructura del ApiResponseDto
    if (isApiResponseDto(data)) {
      return data as unknown as ApiResponseDto<TData>;
    }

    // Respuestas paginadas { data, total } conservan el total a nivel raíz
    if (isPaginatedResponse(data)) {
      const message = this.getSuccessMessageByStatus(response.statusCode);
      return ApiResponseDto.paginated(
        data.data,
        data.total,
        message,
      ) as unknown as ApiResponseDto<TData>;
    }

    // Adaptar los datos para enviarlos como arreglo como dicta el ApiResponseDto
    const arrayData: TData[] = Array.isArray(data)
      ? data
      : data != null
        ? [data]
        : [];

    // Obtener mensaje basado en el status code de HTTP
    const message = this.getSuccessMessageByStatus(response.statusCode);

    return ApiResponseDto.success(arrayData, message);
  }

  private getSuccessMessageByStatus(status: number): string {
    const statusMessages: Partial<Record<number, string>> = {
      [HttpStatus.OK]: this.i18n.t('shared.SUCCESS'),
      [HttpStatus.CREATED]: this.i18n.t('shared.CREATED'),
      [HttpStatus.ACCEPTED]: this.i18n.t('shared.ACCEPTED'),
      [HttpStatus.NO_CONTENT]: this.i18n.t('shared.NO_CONTENT'),
      [HttpStatus.PARTIAL_CONTENT]: this.i18n.t('shared.PARTIAL_CONTENT'),
    };

    return statusMessages[status] ?? this.i18n.t('shared.SUCCESS');
  }

  private logResponse(
    request: Request,
    response: Response,
    startTime: number,
    apiResponse: ApiResponseDto<any>,
  ): void {
    const duration = Date.now() - startTime;
    const logMessage = `${request.method} ${request.url} - Status HTTP: ${response.statusCode} - ${duration}ms`;

    if (apiResponse.status) {
      this.logger.log(`${logMessage}`);
    } else {
      this.logger.warn(`${logMessage} - Error: ${apiResponse.message}`);
    }
  }
}

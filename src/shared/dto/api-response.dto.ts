/**
 * Contrato global de respuesta de la API.
 * Todas las respuestas del microservicio deben ajustarse a esta estructura.
 */
export class ApiResponseDto<T = unknown> {
  status: boolean;
  message: string;
  data: T[];
  total?: number;
  timestamp: Date;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    Object.assign(this, partial);
  }

  /** Respuesta exitosa */
  static success<T>(data: T[], message: string): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      status: true,
      message,
      data,
      timestamp: new Date(),
    });
  }

  /** Respuesta exitosa con paginación */
  static paginated<T>(
    data: T[],
    total: number,
    message: string,
  ): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      status: true,
      message,
      data,
      total,
      timestamp: new Date(),
    });
  }

  /** Respuesta de error */
  static error<T = never>(message: string, data: T[] = []): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      status: false,
      message,
      data,
      timestamp: new Date(),
    });
  }
}

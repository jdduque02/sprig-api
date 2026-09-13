import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

/**
 * Agrupa los decoradores Swagger comunes para endpoints protegidos por IntrospectGuard.
 * Aplica: Bearer auth, respuesta 200 con IntrospectResponse, 401 y 500.
 */
export function ApiIntrospectGuardResponse() {
  return applyDecorators(
    ApiExtraModels(IntrospectResponse),
    ApiBearerAuth(),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Token activo y vigente.',
      type: IntrospectResponse,
    }),
    ApiUnauthorizedResponse({
      description: 'Token expirado, revocado o ausente.',
      type: ErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      description: 'Error al validar el token con Keycloak.',
      type: ErrorResponseDto,
    }),
  );
}

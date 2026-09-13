import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { extractAccessToken } from '@shared/helpers/bearer-token.helper';

/**
 * Extrae el access token del header Authorization o cookie httpOnly.
 * No es registrado por Swagger como parámetro; se documenta mediante @ApiBearerAuth().
 */
export const BearerToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return extractAccessToken(request);
  },
);

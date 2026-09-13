import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

/**
 * Extrae el usuario autenticado del request (poblado por AuthGuard).
 * Requiere que el endpoint esté protegido con @UseGuards(AuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IntrospectResponse => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: IntrospectResponse }>();
    return request.user;
  },
);

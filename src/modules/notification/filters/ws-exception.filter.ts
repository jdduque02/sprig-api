import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const i18n = I18nContext.current();

    const message =
      exception instanceof WsException
        ? exception.getError()
        : exception instanceof Error
          ? exception.message
          : (i18n?.t('notification.WS_INTERNAL_ERROR') ??
            'Error interno del WebSocket');

    this.logger.error(
      `WebSocket error [${client.id}]: ${JSON.stringify(message)}`,
    );

    client.emit('exception', {
      status: 'error',
      message,
    });
  }
}

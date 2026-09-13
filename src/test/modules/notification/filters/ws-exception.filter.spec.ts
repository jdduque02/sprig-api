import { WsExceptionFilter } from '@notification/filters/ws-exception.filter';
import { WsException } from '@nestjs/websockets';
import { ArgumentsHost } from '@nestjs/common';

interface MockWsClient {
  id: string;
  emit: jest.Mock;
}

const buildHost = (clientId = 'socket-1'): ArgumentsHost => {
  const emit = jest.fn();
  const client = { id: clientId, emit };
  return {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ArgumentsHost;
};

describe('WsExceptionFilter', () => {
  let filter: WsExceptionFilter;

  beforeEach(() => {
    filter = new WsExceptionFilter();
    jest.clearAllMocks();
  });

  it('debe emitir el mensaje de WsException al cliente', () => {
    const host = buildHost();
    const client = host.switchToWs().getClient<MockWsClient>();
    const exception = new WsException('Token inválido');

    filter.catch(exception, host);

    expect(client.emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'Token inválido',
    });
  });

  it('debe emitir el mensaje de Error estándar al cliente', () => {
    const host = buildHost();
    const client = host.switchToWs().getClient<MockWsClient>();
    const exception = new Error('Error inesperado');

    filter.catch(exception, host);

    expect(client.emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'Error inesperado',
    });
  });

  it('debe emitir mensaje genérico para excepciones desconocidas', () => {
    const host = buildHost();
    const client = host.switchToWs().getClient<MockWsClient>();

    filter.catch('excepcion-string', host);

    expect(client.emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'Error interno del WebSocket',
    });
  });
});

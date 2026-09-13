import { ConfigService } from '@nestjs/config';
import { PresenceService } from '@shared/services/presence.service';

describe('PresenceService', () => {
  let service: PresenceService;
  const cacheMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const configMock = {
    get: jest.fn((_key: string, def: unknown) => def),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PresenceService(
      cacheMock as never,
      configMock as unknown as ConfigService,
    );
  });

  it('markOnline guarda la presencia', async () => {
    cacheMock.set.mockResolvedValue(undefined);
    await service.markOnline('1');
    expect(cacheMock.set).toHaveBeenCalledWith('online:1', '1', 120_000);
  });

  it('markOffline borra la presencia', async () => {
    cacheMock.del.mockResolvedValue(undefined);
    await service.markOffline('1');
    expect(cacheMock.del).toHaveBeenCalledWith('online:1');
  });

  it('isOnline devuelve true si existe clave', async () => {
    cacheMock.get.mockResolvedValue('1');
    await expect(service.isOnline('1')).resolves.toBe(true);
  });

  it('isOnline devuelve false si no hay clave', async () => {
    cacheMock.get.mockResolvedValue(null);
    await expect(service.isOnline('1')).resolves.toBe(false);
  });

  it('getOnlineMap devuelve los ids online', async () => {
    cacheMock.get.mockImplementation((k: string) =>
      Promise.resolve(k === 'online:1' ? '1' : null),
    );
    const map = await service.getOnlineMap(['1', '2', '3']);
    expect([...map]).toEqual(['1']);
  });

  it('heartbeat marca online', async () => {
    cacheMock.set.mockResolvedValue(undefined);
    await service.heartbeat('42');
    expect(cacheMock.set).toHaveBeenCalledWith('online:42', '1', 120_000);
  });
});

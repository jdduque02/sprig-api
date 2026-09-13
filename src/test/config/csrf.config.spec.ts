import { ConfigService } from '@nestjs/config';
import { getCsrfProtection } from '@config/csrf.config';

// Mockear la librería csrf-csrf completa
jest.mock('csrf-csrf', () => ({
  doubleCsrf: jest.fn(() => ({
    doubleCsrfProtection: jest.fn(),
    generateToken: jest.fn(),
    validateRequest: jest.fn(),
  })),
}));

import { doubleCsrf } from 'csrf-csrf';

interface CsrfOptionsShape {
  getSecret: () => string;
  cookieName: string;
  cookieOptions: { secure: boolean };
  getSessionIdentifier: (req: { cookies: Record<string, string> }) => string;
  ignoredMethods: string[];
}

describe('getCsrfProtection', () => {
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = { get: jest.fn() };
    jest.clearAllMocks();
  });

  it('debe llamar a doubleCsrf y retornar el middleware', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    const middleware = getCsrfProtection(mockConfigService as ConfigService);
    expect(doubleCsrf).toHaveBeenCalledTimes(1);
    expect(middleware).toBeDefined();
  });

  it('debe usar CSRF_SECRET del entorno si está definido', () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) =>
      key === 'CSRF_SECRET' ? 'mi-secreto-csrf' : undefined,
    );
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.getSecret()).toBe('mi-secreto-csrf');
  });

  it('debe usar valor por defecto si CSRF_SECRET no está definido', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.getSecret()).toBe('csrf-super-secret');
  });

  it('debe usar cookieName "x-csrf-token"', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.cookieName).toBe('x-csrf-token');
  });

  it('debe marcar cookie como secure=true en entorno PROD', () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'PROD' : undefined,
    );
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.cookieOptions.secure).toBe(true);
  });

  it('debe marcar cookie como secure=false fuera de PROD', () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'DEV' : undefined,
    );
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.cookieOptions.secure).toBe(false);
  });

  it('debe ignorar métodos seguros GET, HEAD, OPTIONS', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    expect(options.ignoredMethods).toEqual(['GET', 'HEAD', 'OPTIONS']);
  });

  it('debe usar el valor de la cookie como session identifier si existe', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    const req = { cookies: { 'x-csrf-token': 'mi-token' } };
    expect(options.getSessionIdentifier(req)).toBe('mi-token');
  });

  it('debe usar "stateless-session" si la cookie no existe', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    getCsrfProtection(mockConfigService as ConfigService);

    const [options] = (doubleCsrf as jest.Mock).mock.calls[0] as [
      CsrfOptionsShape,
    ];
    const req = { cookies: {} };
    expect(options.getSessionIdentifier(req)).toBe('stateless-session');
  });
});

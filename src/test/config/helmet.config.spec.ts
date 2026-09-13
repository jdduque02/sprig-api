import { getHelmetConfig } from '@config/helmet.config';

interface HelmetConfigShape {
  crossOriginResourcePolicy: { policy: string };
  contentSecurityPolicy: {
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
    };
  };
  frameguard: { action: string };
  hidePoweredBy: boolean;
  hsts: { maxAge: number; includeSubDomains: boolean; preload: boolean };
  dnsPrefetchControl: { allow: boolean };
  noSniff: boolean;
  xssFilter: boolean;
  referrerPolicy: { policy: string };
}

describe('getHelmetConfig', () => {
  it('debe retornar un objeto de configuración definido', () => {
    const config = getHelmetConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('debe tener crossOriginResourcePolicy con policy "cross-origin"', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.crossOriginResourcePolicy).toEqual({
      policy: 'cross-origin',
    });
  });

  it('debe configurar contentSecurityPolicy con directivas básicas', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    const directives = config.contentSecurityPolicy.directives;
    expect(directives.defaultSrc).toContain("'self'");
    expect(directives.scriptSrc).toContain("'self'");
    expect(directives.styleSrc).toContain("'self'");
    expect(directives.imgSrc).toContain("'self'");
  });

  it('debe deshabilitar frameguard (X-Frame-Options: DENY)', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.frameguard).toEqual({ action: 'deny' });
  });

  it('debe activar hidePoweredBy', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.hidePoweredBy).toBe(true);
  });

  it('debe configurar HSTS con maxAge de 2 años', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.hsts.maxAge).toBe(63072000);
    expect(config.hsts.includeSubDomains).toBe(true);
    expect(config.hsts.preload).toBe(true);
  });

  it('debe desactivar dns prefetch', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.dnsPrefetchControl).toEqual({ allow: false });
  });

  it('debe activar noSniff y xssFilter', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.noSniff).toBe(true);
    expect(config.xssFilter).toBe(true);
  });

  it('debe configurar referrerPolicy como strict-origin-when-cross-origin', () => {
    const config = getHelmetConfig() as unknown as HelmetConfigShape;
    expect(config.referrerPolicy).toEqual({
      policy: 'strict-origin-when-cross-origin',
    });
  });
});

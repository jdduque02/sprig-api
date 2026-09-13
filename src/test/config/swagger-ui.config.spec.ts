import {
  getSwaggerCustomCss,
  getSwaggerCustomJs,
} from '@config/swagger-ui.config';
import { BRAND_PALETTE } from '@config/brand';

describe('swagger-ui.config', () => {
  it('getSwaggerCustomCss retorna CSS con el header oculto del topbar', () => {
    const css = getSwaggerCustomCss();
    expect(css).toContain('.swagger-header');
    expect(css).toContain('.topbar { display: none !important; }');
    expect(css).toContain('linear-gradient');
  });

  it('getSwaggerCustomCss usa la paleta de marca y no el gradiente AI', () => {
    const css = getSwaggerCustomCss();
    expect(css).toContain(BRAND_PALETTE.primary);
    expect(css).toContain(BRAND_PALETTE.neutralDark);
    expect(css).not.toContain('#0ea5e9');
    expect(css).not.toContain('#6366f1');
  });

  it('getSwaggerCustomJs inyecta el logo y el título', () => {
    const js = getSwaggerCustomJs('bG9nbw==');
    expect(js).toContain('data:image/svg+xml;base64,bG9nbw==');
    expect(js).toContain('Sprig API');
    expect(js).toContain('getElementById');
  });
});

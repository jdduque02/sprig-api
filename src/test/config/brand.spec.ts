import { BRAND_META, BRAND_PALETTE } from '@config/brand';

describe('brand palette', () => {
  it('exporta los hex de marca documentados', () => {
    expect(BRAND_PALETTE.primary).toBe('#1E5C3A');
    expect(BRAND_PALETTE.accent).toBe('#D4A53A');
    expect(BRAND_PALETTE.neutralLight).toBe('#F4F1E7');
    expect(BRAND_PALETTE.neutralDark).toBe('#1A1A1A');
    expect(BRAND_PALETTE.danger).toBe('#B33A3A');
  });
});

describe('brand meta', () => {
  it('centraliza los tokens de identidad de marca', () => {
    expect(BRAND_META.appName).toBe('Sprig');
    expect(BRAND_META.apiTitle).toBe('Sprig API');
    expect(BRAND_META.docsSiteTitle).toBe('Sprig API Docs');
  });

  it('define la metadata de Swagger y el remitente de mails', () => {
    expect(BRAND_META.docsTagline).toContain(BRAND_META.appName);
    expect(BRAND_META.docsDescription).toContain('API');
    expect(BRAND_META.version).toBe('1');
    expect(BRAND_META.fromEmail).toContain('@');
  });
});

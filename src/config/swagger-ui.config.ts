import { BRAND_PALETTE } from '@config/brand';

export const getSwaggerCustomCss = (): string => `
  .swagger-header {
    background: linear-gradient(135deg, ${BRAND_PALETTE.primary}, ${BRAND_PALETTE.neutralDark});
    color: ${BRAND_PALETTE.white};
    padding: 24px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(15, 61, 46, 0.18);
  }
  .swagger-header img {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: ${BRAND_PALETTE.white};
    padding: 4px;
  }
  .swagger-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: ${BRAND_PALETTE.white};
  }
  .swagger-header p {
    margin: 2px 0 0;
    opacity: .85;
    font-size: .9rem;
    color: ${BRAND_PALETTE.white};
  }
  .topbar { display: none !important; }
`;

export const getSwaggerCustomJs = (logoBase64: string): string => `
(function() {
  var header = document.createElement('div');
  header.className = 'swagger-header';
  header.innerHTML =
    '<img src="data:image/svg+xml;base64,${logoBase64}" alt="Sprig" />' +
    '<div>' +
      '<h1>Sprig API</h1>' +
      '<p>Documentación interactiva &mdash; explora y prueba los endpoints en vivo</p>' +
    '</div>';
  var ui = document.getElementById('swagger-ui');
  if (ui) ui.parentNode.insertBefore(header, ui);
})();
`;

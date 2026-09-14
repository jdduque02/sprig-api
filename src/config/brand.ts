/**
 * Brand palette — single source of truth for Sprig surfaces
 * (Swagger UI, logo, mail templates).
 */
export const BRAND_PALETTE = {
  primary: '#1E5C3A',
  primaryLight: '#2F7D53',
  accent: '#D4A53A',
  accentSoft: '#E8B94A',
  neutralLight: '#F4F1E7',
  neutralDark: '#1A1A1A',
  danger: '#B33A3A',
  white: '#FFFFFF',
  surfaceGreen: '#E6EFE6',
  /** Body text on bone — warm muted charcoal */
  bodyMuted: '#555A5E',
  /** Dividers / borders on bone */
  divider: '#E6E8EC',
  /** Footer / secondary text */
  footerMuted: '#555A5E',
} as const;

/**
 * Brand metadata — single source of truth for Sprig product surfaces
 * (Swagger UI, logo, mail templates, mail from header).
 */
export const BRAND_META = {
  /** Nombre corto del producto (copyright, alt de logo, copy). */
  appName: 'Sprig',
  /** Título de la API en al menos una superficie (Swagger). */
  apiTitle: 'Sprig API',
  /** Título del tab del navegador en Swagger UI. */
  docsSiteTitle: 'Sprig API Docs',
  /** Tagline del header de Swagger UI. */
  docsTagline:
    'Documentación interactiva — explora y prueba los endpoints en vivo',
  /** Introducción del documento OpenAPI (description de Swagger). */
  docsDescription: 'Documentación interactiva de la API de **Sprig**.',
  /** Versión por defecto si no hay env VERSION. */
  version: '1',
  /** Mailbox del remitente de correos transaccionales. */
  fromEmail: 'no-reply@sprig.local',
} as const;

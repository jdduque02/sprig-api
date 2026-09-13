# Descripción del servicio — brand pack (Sprig)

Documento de referencia de marca para **Sprig**, la plataforma de gestión financiera personal.

## Qué es

API backend de **gestión financiera personal** pensada para personas y hogares en Latinoamérica (enfoque Colombia). Centraliza cuentas bancarias, activos, pasivos, presupuestos, objetivos de ahorro, transacciones, importación de extractos, noticias financieras y comunicación por correo. La identidad se gestiona con Keycloak; el panel de administración permite listar usuarios con metadata, cambiar roles, publicar noticias y enviar correos masivos.

## Paleta de colores

| Rol | Hex | Uso |
|-----|-----|-----|
| Primario | `#1E5C3A` | Verde bosque (botones, navbar, acciones principales) |
| Primario claro | `#2F7D53` | Verde natural (hover, dinero, crecimiento) |
| Acento | `#D4A53A` | Dorado Sprig (metas, valores destacados, gradientes) |
| Acento suave | `#E8B94A` | Dorado suave (variantes de acento) |
| Fondo | `#F4F1E7` | Crema (background general) |
| Superficie | `#FFFFFF` | Blanco (cards, superficies elevadas) |
| Superficie verde | `#E6EFE6` | Verde claro (cards informativas, badges) |
| Texto | `#1A1A1A` | Negro Sprig (texto principal) |
| Texto secundario | `#555A5E` | Gris texto (texto auxiliar, placeholders) |
| Borde | `#E6E8EC` | Gris claro (bordes, divisores) |
| Error | `#B33A3A` | Rojo (errores, deuda — nunca dominante en logo) |

### Uso por contexto

- **Navbar / botones primarios**: `#1E5C3A`
- **Hover / estados activos**: `#2F7D53`
- **Dinero / crecimiento**: `#2F7D53`
- **Metas / valores destacados**: `#D4A53A`
- **Background**: `#F4F1E7`
- **Cards**: `#FFFFFF`
- **Cards informativas**: `#E6EFE6`
- **Bordes**: `#E6E8EC`

### Fuente de tokens en código

| Superficie | Archivo | Uso de tokens |
|---|---|---|
| Web (CSS) | `cost-manager-web/src/styles.css` | Variables CSS `:root` (light) y `.dark` |
| Backend | `api-cost-manager/src/config/brand.ts` | `BRAND_PALETTE` para Swagger y emails |
| Móvil (pendiente) | `cost-manager-app-movil/tailwind.config.js` | Tokens `brand.*` de Tailwind |

## Isotipo Sprig

El isotipo consiste en:
- **Fruto**: círculo dorado `#D4A53A` con contorno verde `#1E5C3A`
- **Tallo**: curva verde `#1E5C3A`
- **Hojas**: dos formas verdes `#1E5C3A` con líneas internas crema `#F4F1E7`
- **Fondo (app icon)**: rectángulo redondeado crema `#F4F1E7`

Variantes disponibles en `Sprig_Icons_HD/`:
- `sprig_isotipo` — isotipo sobre fondo transparente
- `sprig_app_icon` — isotipo + fondo crema
- `sprig_app_icon_inverted` — colores invertidos (fondo oscuro)
- `sprig_app_icon_light` — versión clara
- `sprig_app_icon_monochrome` — monocromático
- Iconos funcionales: `budget_wallet`, `money_bag`, `receipt`, `reports_bars`, `reports_pie`

## Aplicación de la paleta

| Superficie | Archivo | Uso de tokens |
|---|---|---|
| Header Swagger | `src/config/swagger-ui.config.ts` | Gradiente `primary → neutralDark`, texto `white`, sombra tintada forest |
| Logo API | `public/logo.svg` | Isotipo Sprig (fruto dorado, hojas verdes) |
| Plantilla OTP | `src/modules/mail/templates/otp-password-reset.tsx` | Fondo/box `neutralLight`, heading `neutralDark`, código `primary`, cuerpo/footer muted |

## Contraste WCAG

| Par | Ratio | Estado |
|-----|-------|--------|
| Verde bosque / crema | ~8.5:1 | AAA |
| Negro Sprig / crema | ~15:1 | AAA |
| Blanco / verde bosque | ~8.5:1 | AAA |
| Gris texto / blanco | ~5.5:1 | AA |

## Tagline

"Haz florecer tus finanzas."

## Qué no comunicar en el logo

- Gráficas de velas / trading agresivo.
- Cohetes, diamantes, "to the moon".
- Billetes realistas o banderas.
- Tipografía script cursiva ilegible a tamaño favicon.

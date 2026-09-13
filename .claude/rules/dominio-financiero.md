# Dominio financiero colombiano

## Moneda
Montos `numeric` crudos en **COP**. El backend nunca formatea moneda — eso vive solo en el
frontend `cost-manager-web/src/lib/format.ts` (`Intl.NumberFormat("es-CO", ...)`). No agregues
formateo de moneda en este repo.

## DIAN / UVT
Módulo `intelligence`, entidad `tax-summary.entity.ts` (`uvt_value`, `income_in_uvt`,
`must_declare`, `estimated_tax`). Si calculas o modificas estos valores:
- Usa el valor UVT y los umbrales de declaración de renta del **año fiscal vigente**.
- Nunca hardcodees esas cifras sin dejar explícita la fuente y el año en el código o el PR.
- No inventes reglas adicionales (retención en la fuente, IVA) si no se piden explícitamente.
- Verifica primero si ya existe un servicio que las calcule — antes se reportaban sin productor.

## Entidades sin dueño claro
`financial-summary.entity.ts` (`total_income`, `expense_ratio`, `savings_rate`, `insights`) y
`summary-category-breakdown.entity.ts`: históricamente han sido entidades sin productor o
huérfanas. Confirma fórmulas y estado actual (repo/servicio real) con el usuario antes de
asumir que ya existen o de construir analítica desde cero.

## Extractos bancarios
`src/modules/finance/service/bank-statement-parser.ts` — históricamente solo soporta
Bancolombia (`parseBancolombia`, `parseBancolombiaCuenta`). Al agregar otro banco:
- Sigue el patrón existente: `MONTH_MAP` en español, limpieza de sufijos `COP|USD|EUR`, una
  función `parseX` dedicada — no crees un pipeline nuevo desde cero.
- El parser usa `pdfjs-dist` v4 (ESM-only) — cuidado con imports CJS al tocar este archivo.
- Invoca la skill `pdf` al extender el parser a un nuevo banco/formato.

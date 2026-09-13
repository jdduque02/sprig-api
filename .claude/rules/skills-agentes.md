# Skills y agente a invocar

## Agente
Usa **`cost-manager-developer`** (`.claude/agents/`) para features y cambios de este repo —
tiene el contexto de dominio de Sprig aplicado automáticamente.

## Skills dentro del flujo
- **`security-review`** — antes de cerrar cambios en `banking`, `auth`, `identity` o cifrado
  (`EncryptionService`) o manejo de tokens/OTP. Prioridad alta por la PII bancaria.
- **`code-review`** — antes de reportar cualquier feature como terminada. No te conformes solo
  con `pnpm lint`.
- **`playwright-skill`** — cuando un cambio de API pueda romper contratos que consume
  `cost-manager-web`.
- **`dataviz`** — al tocar endpoints de `intelligence` (financial-summary, tax-summary,
  category-breakdown) cuya salida alimenta gráficos del dashboard (Highcharts/Recharts).
- **`pdf`** — al extender `bank-statement-parser.ts` a un nuevo banco/formato de extracto en PDF.
- **No uses las skills `finance:*`** (GAAP/SOX corporativo) — no aplican a esta app de finanzas
  personales.

## MCP disponibles
Requieren variables de entorno `DB_*`/`GITHUB_TOKEN` exportadas (`.mcp.json`):
- `postgres` — inspecciona el schema real antes de escribir queries/migraciones nuevas.
- `github` — flujos de PR/issues sobre los repos de Sprig; no usar para acciones destructivas
  (cerrar PRs, borrar ramas) sin confirmación explícita del usuario.

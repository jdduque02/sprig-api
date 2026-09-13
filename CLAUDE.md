# CLAUDE.md — Sprig (api-cost-manager)

Contexto persistente para trabajar en este repo. Cada línea ≤200 caracteres.

## 1. Qué es este proyecto

Backend de **Sprig**, app colombiana de finanzas personales (gastos, ingresos, metas de ahorro, cuentas
bancarias, reportes tributarios DIAN). Monolito modular en NestJS 11 con separación estricta de dominios
(bounded contexts que actúan casi como microservicios). Tiene un frontend hermano, `cost-manager-web`
(no vive en este repo), que consume esta API y es el único responsable de formatear moneda/UI.

## 2. Stack

- NestJS 11 + TypeScript estricto, Node 20+.
- PostgreSQL 16, **esquemas separados por dominio** (`identity`, `catalog`, `finance`, etc.) vía TypeORM.
- Auth: Keycloak (JWT) + `nest-keycloak-connect`. La tabla de usuarios solo guarda `external_id` (sub).
- Redis (cache-manager), RabbitMQ (`@nestjs/microservices` + `amqplib`) para mensajería async entre módulos.
- Swagger (`@nestjs/swagger`), Jest + Supertest, ESLint/Prettier/SonarQube, Husky/Commitlint.
- `@react-pdf/renderer` y `@react-email/*` para PDFs/emails (reportes DIAN, plantillas de correo).
- Gestor de paquetes: **siempre pnpm** (pnpm-lock.yaml + pnpm-workspace.yaml) — nunca npm/yarn.

## 3. Arquitectura (fuente de verdad: `agent.md`)

Léelo antes de tocar arquitectura. Reglas estrictas:

- Ningún módulo accede directo al `Repository<T>` de otro módulo (aislamiento).
- Comunicación cruzada síncrona = inyección de servicios; comunicación async = RabbitMQ (no BullMQ, no instalado).
- `SharedModule` es global y solo expone infraestructura técnica (Redis, crypto, guards, interceptors,
  filters), **nunca lógica de negocio**.
- `finance.transaction_record` está particionada: toda query DEBE filtrar por `created_at` (partition pruning).
- Borrado siempre lógico (`deleted_at` vía TypeORM); borrado físico prohibido.
- Respuestas envueltas globalmente por `TransformInterceptor` (`{ data, meta: { timestamp, version } }`) —
  no formatear el retorno manualmente en el controller.
- Nunca asumir UTC para lógica financiera de usuario; usar el `timezone` de `app_user`
  (helper `todayInTimeZone`).
- Módulos de dominio actuales: `admin`, `audit`, `auth`, `banking`, `catalog`, `finance`, `identity`,
  `intelligence`, `mail`, `news`, `notification`, `support`.

## 4. Dominio financiero colombiano

- Moneda: montos `numeric` crudos en **COP**. El backend nunca formatea moneda; eso vive solo en el
  frontend (`cost-manager-web/src/lib/format.ts`, `Intl.NumberFormat("es-CO", ...)`).
- DIAN/UVT: si calculas `estimated_tax`/`must_declare` (módulo `intelligence`, `tax-summary.entity.ts`),
  usa el valor UVT y los umbrales de declaración de renta del año fiscal vigente — nunca hardcodear sin
  dejar explícita la fuente/año en el código o PR. No inventes reglas adicionales (retención en la fuente,
  IVA) si no se piden explícitamente.
- `financial-summary.entity.ts` (`total_income`, `expense_ratio`, `savings_rate`, `insights`) y
  `summary-category-breakdown.entity.ts`: confirma fórmulas/propietario con el usuario antes de asumir,
  históricamente han sido entidades sin productor claro o huérfanas — verifica el estado actual en vez de
  fiarte de este archivo.
- Extractos bancarios (`src/modules/finance/service/bank-statement-parser.ts`): históricamente solo
  soportaba Bancolombia (`parseBancolombia`, `parseBancolombiaCuenta`). Al agregar otro banco, sigue el
  patrón existente (`MONTH_MAP` en español, limpieza de sufijos `COP|USD|EUR`, función `parseX` dedicada).
- Migrado a `pdfjs-dist` v4 (ESM-only) para el parser de extractos — cuidado con imports CJS al tocar esto.

## 5. Reutilización obligatoria (antes de crear utilidades nuevas)

- `ResponseHelper` — `src/shared/helpers/response.helper.ts`.
- `extractBearerToken`/`extractAccessToken` — `src/shared/helpers/bearer-token.helper.ts`.
- `todayInTimeZone`/`computeObjectiveProgress` — `src/shared/helpers/financial-objective.helper.ts`.
- `EncryptionService` — `src/shared/services/encryption.service.ts` (obligatorio para datos bancarios
  sensibles nuevos, vía pgcrypto/cifrado a nivel de columna en `banking`).
- `IpBlockService`/`PresenceService` — `src/shared/services/`.

## 6. Deuda técnica conocida (repara oportunistamente si tocas esos archivos)

- `src/shared/services/logging.service.ts`: usa `axios` directo en vez de `HttpService`.
- `src/shared/services/file-logger.ts`: `fs.appendFileSync` sin rotación ni límite de tamaño.
- `src/shared/services/encryption.service.ts`: `isEncrypted()` con regex laxa, sin rotación de claves.
- No asumas que estos puntos siguen igual sin verificarlos primero — la deuda se paga con el tiempo.

## 7. Calidad y testing (obligatorio, no negociable)

- Cobertura Jest mínima 80% (branches/functions/lines/statements) — ver `package.json` `coverageThreshold`.
- Complejidad ciclomática/cognitiva máxima 15; corre `pnpm lint` y refactoriza si se excede.
- Toda API pública documentada con `@nestjs/swagger` (`@ApiTags`, `@ApiOperation`, `@ApiProperty`,
  `@ApiResponse`).
- Todo endpoint protegido con `AuthGuard` lleva `@ApiBearerAuth('bearer')` (a nivel de clase o método,
  según dónde esté el guard) — si no, Swagger UI no manda el token al probar "Try it out".
- Toda unidad nueva/modificada lleva tests Jest (`*.spec.ts`); todo endpoint nuevo/modificado lleva al
  menos un test e2e (`test/jest-e2e.json`).
- No des una feature por terminada sin tests, sin pasar el gate de complejidad y sin invocar `code-review`.

## 8. Skills a invocar dentro del flujo

- **`security-review`** — antes de cerrar cambios en `banking`, `auth`, `identity` o cifrado.
- **`code-review`** — antes de reportar cualquier feature como terminada (no te conformes solo con lint).
- **`playwright-skill`** — cuando un cambio de API pueda romper contratos que consume `cost-manager-web`.
- **`dataviz`** — al tocar endpoints de `intelligence` (financial-summary, tax-summary, category-breakdown)
  cuya salida alimenta gráficos del dashboard (frontend usa Highcharts/Recharts).
- **`pdf`** — al extender `bank-statement-parser.ts` a un nuevo banco/formato de extracto en PDF.
- **No uses las skills `finance:*`** (GAAP/SOX corporativo) — no aplican a esta app de finanzas personales.

## 9. Agente y MCP

- Usa el agente **`cost-manager-developer`** (`.claude/agents/`) para features y cambios de este repo —
  tiene este contexto de dominio aplicado automáticamente.
- MCP disponibles (`.mcp.json`, requieren variables de entorno `DB_*`/`GITHUB_TOKEN` exportadas):
  - `postgres` — inspeccionar el schema real antes de escribir queries/migraciones nuevas.
  - `github` — flujos de PR/issues sobre los repos de Sprig; no usar para acciones destructivas
    (cerrar PRs, borrar ramas) sin confirmación explícita del usuario.

## 10. Historial reciente relevante (para no repetir contexto ya resuelto)

- `intelligence`: se agregó cálculo de `financial_summary`, análisis financiero con IA, reporte PDF del
  perfil financiero, y endpoints de cálculo de `tax-summary` (DIAN). Antes de tocar este módulo, revisa
  qué de esto ya tiene servicio/repo real y qué sigue pendiente de fórmula.
- `finance`: pagos de objetivos ahora permiten omitir `objective_id` al crearse.
- `banking`: acceso a `BankAccount` aislado detrás de `BankAccountService` (no repositorio directo).
- Swagger: se corrigió falta de `@ApiBearerAuth` en endpoints protegidos — si agregas un endpoint nuevo,
  no repitas ese olvido (ver sección 7).
- i18n: el idioma se resuelve por el locale guardado del usuario (no por header por defecto).
- Rama de trabajo activa históricamente: `feature/implements_modules_5`.

## 11. Qué NO hacer

- No usar `npm`/`yarn` en vez de `pnpm`.
- No añadir abstracciones, capas o dependencias que no se pidieron; no bajar versiones existentes.
- No modificar CI/CD (`Jenkinsfile`), `docker-compose.yml` o `.mcp.json` sin confirmar con el usuario.
- No hardcodear reglas tributarias colombianas (UVT, umbrales DIAN) sin dejar explícita la fuente/año.
- No dar una feature por terminada sin tests y sin pasar el gate de calidad (sección 7).

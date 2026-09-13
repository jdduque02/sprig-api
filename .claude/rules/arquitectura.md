# Arquitectura

Fuente de verdad: `agent.md` (raíz). Léelo antes de tocar arquitectura.

## Módulos de dominio
`admin`, `audit`, `auth`, `banking`, `catalog`, `finance`, `identity`, `intelligence`, `mail`,
`news`, `notification`, `support`. Monolito modular NestJS 11, cada módulo actúa casi como
un microservicio.

## Reglas estrictas
- Ningún módulo accede directo al `Repository<T>` de otro módulo (aislamiento total).
- Comunicación cruzada síncrona → inyección de servicios del otro módulo (nunca su repo).
- Comunicación cruzada asíncrona → RabbitMQ (`@nestjs/microservices` + `amqplib`). No BullMQ,
  no está instalado; no lo agregues sin confirmar con el usuario.
- `SharedModule` es `@Global()` y solo expone infraestructura técnica (Redis, crypto, guards,
  interceptors, filters) — **nunca lógica de negocio**.
- PostgreSQL 16 con **esquemas separados por dominio** (`identity`, `catalog`, `finance`, etc.)
  vía TypeORM.
- `finance.transaction_record` está particionada: toda query DEBE filtrar por `created_at`
  para habilitar partition pruning. Verifica el `WHERE` antes de dar por buena una query nueva.
- Borrado siempre lógico (`deleted_at` vía TypeORM). Borrado físico prohibido, sin excepciones.
- Respuestas envueltas globalmente por `TransformInterceptor` (`{ data, meta: { timestamp,
  version } }`) — no formatees el retorno manualmente en el controller.
- Nunca asumir UTC para lógica financiera de usuario; usa el `timezone` de `app_user` vía el
  helper `todayInTimeZone`.
- Auth: Keycloak (JWT) + `nest-keycloak-connect`. La tabla de usuarios solo guarda `external_id`
  (el `sub` de Keycloak) — nunca contraseñas ni credenciales.

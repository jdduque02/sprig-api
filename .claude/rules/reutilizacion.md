# Reutilización obligatoria

Antes de crear una utilidad, servicio o helper nuevo, revisa si ya existe uno de estos:

- `ResponseHelper` — `src/shared/helpers/response.helper.ts`.
- `extractBearerToken` / `extractAccessToken` — `src/shared/helpers/bearer-token.helper.ts`.
- `todayInTimeZone` / `computeObjectiveProgress` — `src/shared/helpers/financial-objective.helper.ts`.
- `EncryptionService` — `src/shared/services/encryption.service.ts`. Obligatorio para cualquier
  dato bancario sensible nuevo, vía pgcrypto/cifrado a nivel de columna en el módulo `banking`.
- `IpBlockService` / `PresenceService` — `src/shared/services/`.

Si necesitas algo similar pero no idéntico, prefiere extender el helper existente antes de
duplicar lógica en un módulo de dominio.

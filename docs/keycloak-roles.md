# Keycloak — roles `user` / `admin`

## Provisionamiento (Fase 0)

1. Abrir Admin Console: `http://localhost:8080` (o `KEYCLOAK_URL`).
2. Realm: el configurado en `KEYCLOAK_REALM` (p. ej. `master` en local).
3. **Realm roles** → Create role:
   - `user` (default para registros)
   - `admin` (panel administrativo)
4. Asignar `admin` (+ `user`) a tu cuenta de administración.
5. Client `KEYCLOAK_CLIENT_ID` (`cost_manager`):
   - Service account enabled
   - Client authentication ON
   - Service account roles → `realm-management` → `realm-admin` (o el set mínimo: manage-users, view-users, query-users, manage-realm)
6. Verificar que el access token incluya:

```json
"realm_access": { "roles": ["user", "admin"] }
```

El backend ya lee `realm_access.roles` en `AdminGuard` y guarda un snapshot en `identity.app_user.roles` en cada login.

## Export (recomendado)

```bash
# Dentro del contenedor Keycloak
/opt/keycloak/bin/kc.sh export --dir /tmp/export --realm <REALM>
```

Versionar el JSON resultante en el repo (p. ej. `infra/keycloak/realm-export.json`).

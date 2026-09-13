# Qué NO hacer

- No usar `npm`/`yarn` en vez de `pnpm`.
- No añadir abstracciones, capas o dependencias que no se pidieron; no bajar versiones existentes.
- No modificar CI/CD (`Jenkinsfile`), `docker-compose.yml` o `.mcp.json` sin confirmar con el
  usuario.
- No hardcodear reglas tributarias colombianas (UVT, umbrales DIAN) sin dejar explícita la
  fuente/año.
- No dar una feature por terminada sin tests y sin pasar el gate de calidad
  ([calidad-testing.md](calidad-testing.md)).
- No acceder al `Repository<T>` de otro módulo directamente ([arquitectura.md](arquitectura.md)).
- No hacer borrado físico de datos; siempre lógico (`deleted_at`).
- No formatear moneda en el backend — eso es responsabilidad exclusiva del frontend.
- No usar el MCP `github` para acciones destructivas o de escritura sin confirmación explícita.

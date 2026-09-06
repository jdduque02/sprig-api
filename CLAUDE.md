# CLAUDE.md — api-cost-manager (Sprig backend)

Buenas prácticas de este repo (cada línea ≤200 caracteres):

- Usa siempre pnpm (nunca npm/yarn) — el repo usa pnpm-lock.yaml y pnpm-workspace.yaml.
- Lee agent.md antes de tocar arquitectura: monolito modular, aislamiento de módulos, mensajería async por RabbitMQ (no BullMQ).
- finance.transaction_record está particionada: toda consulta debe filtrar por created_at (partition pruning).
- Borrado siempre lógico (deleted_at) vía TypeORM; el borrado físico está prohibido.
- Moneda: montos numeric crudos en COP; el backend no formatea moneda, eso vive solo en el frontend.
- DIAN/UVT: si calculas estimated_tax/must_declare, usa el valor UVT y los umbrales del año fiscal vigente, sin hardcodear sin fuente.
- Reusa ResponseHelper, EncryptionService, extractBearerToken y todayInTimeZone antes de crear utilidades nuevas.
- Todo endpoint protegido con AuthGuard lleva @ApiBearerAuth('bearer') (a nivel de clase o de método, según dónde esté el guard) — si no, Swagger UI no manda el token al probar "Try it out".
- Cobertura Jest mínima 80% (branches/functions/lines/statements); complejidad ciclomática/cognitiva máxima 15.
- Invoca la skill security-review antes de cerrar cambios en banking, auth, identity o cifrado.
- Invoca la skill code-review antes de reportar cualquier feature como terminada.
- No uses las skills finance:* (GAAP/SOX) — no aplican a esta app de finanzas personales colombiana.
- Usa el agente cost-manager-developer (.claude/agents/) para features y cambios de este repo.
- MCP disponibles: postgres y github (.mcp.json) — requieren variables de entorno (DB_*, GITHUB_TOKEN) exportadas por ti.

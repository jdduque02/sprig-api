# Reglas del proyecto Sprig (api-cost-manager)

Definiciones de proyecto organizadas por tema, derivadas de `CLAUDE.md` (raíz) y `agent.md`
(fuente de verdad de arquitectura). Úsalas como referencia rápida por dominio en vez de releer
todo `CLAUDE.md`. Si hay conflicto, `CLAUDE.md` y `agent.md` mandan sobre estos archivos.

- [arquitectura.md](arquitectura.md) — aislamiento de módulos, esquemas DB, particionamiento, respuestas globales.
- [dominio-financiero.md](dominio-financiero.md) — COP, DIAN/UVT, entidades sin dueño claro, extractos bancarios.
- [buenas-practicas.md](buenas-practicas.md) — DRY, complejidad ciclomática/cognitiva ≤15 (SonarQube), otras prácticas.
- [reutilizacion.md](reutilizacion.md) — helpers y servicios obligatorios antes de crear utilidades nuevas.
- [deuda-tecnica.md](deuda-tecnica.md) — puntos conocidos a reparar oportunistamente.
- [calidad-testing.md](calidad-testing.md) — cobertura, complejidad, Swagger, e2e (no negociable).
- [skills-agentes.md](skills-agentes.md) — qué skill invocar y cuándo; agente `cost-manager-developer`.
- [prohibiciones.md](prohibiciones.md) — qué NO hacer nunca en este repo.

# Calidad y testing (obligatorio, no negociable)

- Cobertura Jest mínima **80%** (branches/functions/lines/statements) — ver `coverageThreshold`
  en `package.json`.
- Complejidad ciclomática/cognitiva máxima **15** (SonarQube) y DRY — ver
  [buenas-practicas.md](buenas-practicas.md) para cómo refactorizar cuando se excede.
- Toda API pública documentada con `@nestjs/swagger`: `@ApiTags`, `@ApiOperation`,
  `@ApiProperty`, `@ApiResponse`.
- Todo endpoint protegido con `AuthGuard` lleva `@ApiBearerAuth('bearer')` (a nivel de clase o
  método, según dónde esté el guard) — si falta, Swagger UI no manda el token en "Try it out".
- Toda unidad nueva/modificada lleva tests Jest (`*.spec.ts`).
- Todo endpoint nuevo/modificado lleva al menos un test e2e (`test/jest-e2e.json`).
- No des una feature por terminada sin tests, sin pasar el gate de complejidad y sin invocar la
  skill `code-review` (ver [skills-agentes.md](skills-agentes.md)).

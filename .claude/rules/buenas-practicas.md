# Buenas prácticas y DRY

## Complejidad de código (SonarQube)
- Complejidad ciclomática **y** cognitiva máxima **15** por función/método — es el umbral que
  aplica SonarQube en este repo, no una sugerencia.
- Corre `pnpm lint` (y revisa el reporte de Sonar si está disponible) antes de dar por
  terminada cualquier función con múltiples `if`/`switch`/loops anidados o condiciones
  compuestas (`&&`/`||` encadenados).
- Si una función supera el umbral, refactoriza extrayendo funciones puras con nombre
  descriptivo (early returns, guard clauses, extraer condiciones a variables/helpers con
  nombre) en vez de silenciar la regla o desactivar el linter.
- Prefiere aplanar la lógica: early return sobre `if/else` anidados, `Array.prototype` methods
  (`map`/`filter`/`reduce`) sobre loops manuales con acumuladores condicionales, y extraer
  validaciones repetidas a un método privado o a un helper de `src/shared/helpers/`.

## DRY (Don't Repeat Yourself)
- Antes de escribir lógica nueva, busca si ya existe en el módulo actual, en `src/shared/` o en
  otro módulo de dominio (ver [reutilizacion.md](reutilizacion.md) para la lista concreta de
  helpers/servicios obligatorios).
- Si detectas la misma lógica duplicada en 2+ lugares al tocar un archivo, extráela a:
  - un método privado del mismo service, si es específica del módulo;
  - un helper en `src/shared/helpers/`, si es transversal y no tiene lógica de negocio de un
    dominio específico (recuerda: `SharedModule` nunca contiene lógica de negocio, solo
    infraestructura/utilidades genéricas — ver [arquitectura.md](arquitectura.md)).
- DTOs, validadores (`class-validator`) y mapeos repetidos entre entidad↔DTO van en un único
  lugar por módulo (p. ej. un mapper o método `toDto()`), no copiados en cada endpoint.
- No dupliques constantes (UVT, umbrales DIAN, `MONTH_MAP`, sufijos de moneda, roles) — deben
  vivir en un único archivo de constantes del módulo correspondiente.
- Tests: extrae fixtures/mocks repetidos (usuario mock, JWT mock, DTOs de ejemplo) a helpers de
  test compartidos en vez de recrearlos en cada `*.spec.ts`.

## Otras buenas prácticas del repo
- Nombres explícitos en español o inglés consistentes con el módulo que estás tocando (revisa
  el archivo vecino antes de mezclar idiomas en nombres de variables/métodos nuevos).
- Funciones pequeñas y con una sola responsabilidad; si un método hace "y además", probablemente
  debe dividirse.
- No captures excepciones genéricas (`catch (e) {}`) sin manejarlas o loguearlas vía el
  `Logger`/`LoggingInterceptor` existente — nunca las silencies en `banking`/`auth`/`identity`.
- Tipado estricto: evita `any`; si es inevitable temporalmente, dilo explícitamente en el PR.
- No agregues abstracciones (factories, interfaces genéricas, capas nuevas) para eliminar
  duplicación de solo 2 usos si aumenta la complejidad general — DRY no es excusa para
  sobre-diseñar (ver [prohibiciones.md](prohibiciones.md)).

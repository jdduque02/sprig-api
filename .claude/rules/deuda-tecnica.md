# Deuda técnica conocida

Repara oportunistamente si tocas estos archivos (no los reescribas por iniciativa propia si no
estás ya trabajando ahí). Verifica primero que el punto siga vigente — la deuda se paga con el
tiempo y estas notas pueden quedar desactualizadas.

- `src/shared/services/logging.service.ts`: usa `axios` directo en vez de `HttpService`.
- `src/shared/services/file-logger.ts`: `fs.appendFileSync` sin rotación ni límite de tamaño.
- `src/shared/services/encryption.service.ts`: `isEncrypted()` con regex laxa, sin rotación de
  claves.

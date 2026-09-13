/**
 * Umbrales de latencia por tipo de ruta (ms). Para partition-pruned queries
 * sobre `finance.transaction_record` o reportes con PDF/IA se usa PERF.SLOW.
 * Ajustar aquí si el hardware de CI es consistentemente más lento.
 */
export const PERF = {
  FAST: 300,
  NORMAL: 800,
  SLOW: 3000,
} as const;

export interface Measured<T> {
  result: T;
  durationMs: number;
}

export async function measure<T>(fn: () => Promise<T>): Promise<Measured<T>> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  return { result, durationMs: Number(end - start) / 1_000_000 };
}

export function expectFasterThan(durationMs: number, thresholdMs: number) {
  expect(durationMs).toBeLessThan(thresholdMs);
}

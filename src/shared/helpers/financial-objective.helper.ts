import { FinancialObjective } from '@finance/entities/financial-objective.entity';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Evalúa si una meta quedó completada según su saldo actual y monto objetivo,
 * mutando `is_completed`/`completed_at` en el objeto recibido. Se usa como
 * punto único de verdad para el auto-completado, compartido por los
 * repositorios que ajustan el saldo de metas.
 */
export function applyCompletion(
  objective: Pick<
    FinancialObjective,
    'current_balance' | 'target_amount' | 'is_completed' | 'completed_at'
  >,
): void {
  const target = Number(objective.target_amount ?? 0);
  // Una meta sin monto objetivo es abierta: nunca se auto-completa.
  if (objective.target_amount == null || target <= 0) {
    objective.is_completed = false;
    objective.completed_at = null;
    return;
  }
  const reached = Number(objective.current_balance ?? 0) >= target;
  if (reached) {
    objective.is_completed = true;
    if (!objective.completed_at) objective.completed_at = new Date();
  } else {
    objective.is_completed = false;
    objective.completed_at = null;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del usuario. */
export function todayInTimeZone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface FinancialObjectiveProgress {
  amount_remaining: number | null;
  progress_percent: number | null;
  days_remaining: number | null;
}

/**
 * Campos calculados de una meta para la respuesta de la API:
 *   - amount_remaining:  lo que falta ahorrar (mín. 0). null si no hay monto.
 *   - progress_percent:  % de avance (0-100). null si no hay monto objetivo.
 *   - days_remaining:    días calendario restantes hasta end_date (0 si ya
 *                        venció o no hay fecha). Comparación en UTC.
 */
export function computeObjectiveProgress(
  objective: Pick<
    FinancialObjective,
    'current_balance' | 'target_amount' | 'end_date'
  >,
): FinancialObjectiveProgress {
  let amount_remaining: number | null = null;
  let progress_percent: number | null = null;
  if (objective.target_amount != null) {
    const current = Number(objective.current_balance ?? 0);
    const target = Number(objective.target_amount);
    amount_remaining = Math.max(0, round2(target - current));
    progress_percent = target > 0 ? round2((current / target) * 100) : 0;
  }

  let days_remaining: number | null = null;
  if (objective.end_date) {
    const end = new Date(objective.end_date).getTime();
    const today = Date.now();
    days_remaining = Math.max(0, Math.ceil((end - today) / MS_PER_DAY));
  }

  return { amount_remaining, progress_percent, days_remaining };
}

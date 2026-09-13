import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { nextOccurrence } from '@finance/service/fixed-reminder.scheduler';
import { TransactionTypeEnum } from '@shared/enums';

const DAY_MS = 24 * 60 * 60 * 1000;
// Tope de ocurrencias por transacción fija dentro de la ventana proyectada
// (90 días). La frecuencia más densa soportada es DAILY, que en 90 días
// produce como máximo 90 ocurrencias — este margen evita un loop infinito
// si `nextOccurrence` devolviera una fecha que no avanza por un dato corrupto.
const MAX_OCCURRENCES_PER_TRANSACTION = 120;

export interface FixedOccurrence {
  /** Fecha de la ocurrencia proyectada, formato YYYY-MM-DD. */
  date: string;
  /** Monto con signo: positivo = entra dinero, negativo = sale dinero. */
  signedAmount: number;
}

/**
 * Formatea un `Date` como YYYY-MM-DD usando sus componentes LOCALES (no
 * UTC) — consistente con cómo `nextOccurrence`/`startOfDay` construyen y
 * leen fechas, para no desalinear el día por el offset de zona horaria del
 * proceso Node.
 */
function formatLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Signo de una transacción fija sobre el saldo disponible: los ingresos
 * suman, los gastos e inversiones fijas (aportes periódicos) restan. No se
 * proyectan transferencias fijas (mismo criterio que el resto del forecast:
 * solo ingreso/gasto/inversión afectan el saldo líquido proyectado).
 */
function signedAmountFor(
  tx: Pick<TransactionRecord, 'type' | 'amount'>,
): number | null {
  const amount = Number(tx.amount ?? 0);
  if (tx.type === TransactionTypeEnum.INCOME) return amount;
  if (
    tx.type === TransactionTypeEnum.EXPENSE ||
    tx.type === TransactionTypeEnum.INVESTMENT
  ) {
    return -amount;
  }
  return null;
}

/**
 * Proyecta todas las ocurrencias futuras de una transacción fija dentro de
 * la ventana [today, today + windowDays], reutilizando el motor de
 * recurrencia de `finance` (`nextOccurrence`) sin duplicar su lógica.
 */
function projectOccurrencesForTransaction(
  tx: TransactionRecord,
  today: Date,
  windowEnd: Date,
): FixedOccurrence[] {
  const signedAmount = signedAmountFor(tx);
  if (signedAmount === null) return [];

  const occurrences: FixedOccurrence[] = [];
  let cursor = today;
  for (let i = 0; i < MAX_OCCURRENCES_PER_TRANSACTION; i++) {
    const occurrence = nextOccurrence(tx, cursor);
    if (!occurrence || occurrence.getTime() > windowEnd.getTime()) break;

    occurrences.push({
      date: formatLocalIso(occurrence),
      signedAmount,
    });

    const advanced = new Date(occurrence.getTime() + DAY_MS);
    if (advanced.getTime() <= cursor.getTime()) break; // salvaguarda anti-loop
    cursor = advanced;
  }
  return occurrences;
}

/**
 * Proyecta las ocurrencias de TODAS las transacciones fijas del usuario
 * dentro de la ventana [today, today + windowDays].
 */
export function projectFixedOccurrences(
  fixedTransactions: TransactionRecord[],
  todayIso: string,
  windowDays: number,
): FixedOccurrence[] {
  // `nextOccurrence`/`startOfDay` (finance) extraen año/mes/día con los
  // getters LOCALES de `Date` (no UTC) — hay que construir `today` a partir
  // de sus componentes locales para que su calendario coincida con
  // `todayIso` (ya resuelto en la zona horaria del usuario vía
  // todayInTimeZone), en vez de interpretarlo como medianoche UTC.
  const [year, month, day] = todayIso.split('-').map(Number);
  const today = new Date(year, month - 1, day);
  const windowEnd = new Date(today.getTime() + windowDays * DAY_MS);

  const occurrences: FixedOccurrence[] = [];
  for (const tx of fixedTransactions) {
    occurrences.push(...projectOccurrencesForTransaction(tx, today, windowEnd));
  }
  return occurrences;
}

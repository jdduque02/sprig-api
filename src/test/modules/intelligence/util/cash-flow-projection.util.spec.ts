import { projectFixedOccurrences } from '@intelligence/util/cash-flow-projection.util';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { FrequencyEnum, TransactionTypeEnum } from '@shared/enums';

const buildFixedTx = (overrides = {}): TransactionRecord =>
  ({
    id: 1,
    user_id: 10,
    type: TransactionTypeEnum.EXPENSE,
    amount: 100000,
    is_fixed: true,
    frequency: FrequencyEnum.MONTHLY,
    due_day: 15,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as unknown as TransactionRecord;

describe('projectFixedOccurrences', () => {
  it('debe proyectar una única ocurrencia mensual dentro de una ventana de 30 días', () => {
    const tx = buildFixedTx({ due_day: 20 });
    // "hoy" = 2026-09-13, así que la próxima ocurrencia mensual (día 20) cae
    // dentro de la ventana de 30 días.
    const occurrences = projectFixedOccurrences([tx], '2026-09-13', 30);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date).toBe('2026-09-20');
    expect(occurrences[0].signedAmount).toBe(-100000);
  });

  it('debe marcar el ingreso con signo positivo y el gasto/inversión con signo negativo', () => {
    const income = buildFixedTx({
      id: 1,
      type: TransactionTypeEnum.INCOME,
      amount: 5000000,
      due_day: 20,
    });
    const investment = buildFixedTx({
      id: 2,
      type: TransactionTypeEnum.INVESTMENT,
      amount: 300000,
      due_day: 20,
    });
    const occurrences = projectFixedOccurrences(
      [income, investment],
      '2026-09-13',
      30,
    );

    const incomeOccurrence = occurrences.find((o) => o.signedAmount > 0);
    const investmentOccurrence = occurrences.find((o) => o.signedAmount < 0);
    expect(incomeOccurrence?.signedAmount).toBe(5000000);
    expect(investmentOccurrence?.signedAmount).toBe(-300000);
  });

  it('no debe proyectar transacciones fijas de tipo transfer', () => {
    const transfer = buildFixedTx({
      type: TransactionTypeEnum.TRANSFER,
      due_day: 20,
    });
    const occurrences = projectFixedOccurrences([transfer], '2026-09-13', 30);
    expect(occurrences).toEqual([]);
  });

  it('debe proyectar múltiples ocurrencias de una transacción DIARIA dentro de la ventana', () => {
    const daily = buildFixedTx({
      frequency: FrequencyEnum.DAILY,
      due_day: null,
    });
    const occurrences = projectFixedOccurrences([daily], '2026-09-13', 5);

    // Ventana [today, today + 5 días] inclusiva en ambos extremos -> 6
    // ocurrencias (día 0 = hoy, hasta día 5). Los días 1..N son los que
    // consume CashFlowForecastService al armar el acumulador diario (day 0
    // se descarta ahí porque el saldo actual ya lo incluye).
    expect(occurrences).toHaveLength(6);
    expect(occurrences.map((o) => o.date)).toEqual([
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('debe proyectar múltiples ocurrencias mensuales de la misma transacción dentro de una ventana de 90 días', () => {
    const monthly = buildFixedTx({ due_day: 13 });
    const occurrences = projectFixedOccurrences([monthly], '2026-09-13', 90);

    // Día 13 de cada mes cae ~3 veces en 90 días desde el 13/09.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(occurrences.every((o) => o.signedAmount === -100000)).toBe(true);
  });

  it('debe devolver un array vacío si no hay transacciones fijas', () => {
    expect(projectFixedOccurrences([], '2026-09-13', 90)).toEqual([]);
  });

  it('no debe proyectar ocurrencias fuera de la ventana solicitada', () => {
    const yearly = buildFixedTx({
      frequency: FrequencyEnum.YEARLY,
      due_day: 1,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    // La próxima ocurrencia anual (01/01/2027) cae fuera de una ventana de 30 días.
    const occurrences = projectFixedOccurrences([yearly], '2026-09-13', 30);
    expect(occurrences).toEqual([]);
  });
});

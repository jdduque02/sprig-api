import { RuleBasedFinancialNarrativeProvider } from '@intelligence/service/rule-based-financial-narrative.provider';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';

const buildSummary = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    financial_period_id: 5,
    total_income: 5000000,
    total_expense: 3000000,
    total_debt: 200000,
    net_worth: 1300000,
    expense_ratio: 60,
    debt_ratio: 4,
    savings_rate: 40,
    recommended_max_expense: 4000000,
    recommended_savings: 1000000,
    is_over_spending: false,
    is_over_indebted: false,
    insights: [],
    calculated_at: new Date(),
    is_final: false,
    ...overrides,
  }) as FinancialSummary;

describe('RuleBasedFinancialNarrativeProvider', () => {
  let provider: RuleBasedFinancialNarrativeProvider;

  beforeEach(() => {
    provider = new RuleBasedFinancialNarrativeProvider();
  });

  it('genera una narrativa sin alertas cuando todo está dentro de lo recomendado', async () => {
    const result = await provider.generate({
      summary: buildSummary(),
      categoryBreakdown: [],
    });

    expect(result.narrative).toContain('5000000');
    expect(result.narrative).not.toContain('Atención');
  });

  it('incluye párrafo de alerta cuando hay sobregasto', async () => {
    const result = await provider.generate({
      summary: buildSummary({ is_over_spending: true }),
      categoryBreakdown: [],
    });

    expect(result.narrative).toContain('Atención');
  });

  it('incluye párrafo de alerta cuando hay sobreendeudamiento', async () => {
    const result = await provider.generate({
      summary: buildSummary({ is_over_indebted: true }),
      categoryBreakdown: [],
    });

    expect(result.narrative).toContain('Atención');
    expect(result.narrative).toContain('endeudamiento');
  });

  it('indica que no se pudo calcular la tasa de ahorro si savings_rate es null', async () => {
    const result = await provider.generate({
      summary: buildSummary({ savings_rate: null }),
      categoryBreakdown: [],
    });

    expect(result.narrative).toContain('No se pudo calcular tu tasa de ahorro');
  });

  it('identifica la categoría de mayor gasto', async () => {
    const result = await provider.generate({
      summary: buildSummary(),
      categoryBreakdown: [
        {
          category_id: 1,
          income: 0,
          expenses: 100000,
          investments: 0,
          count: 2,
        },
        {
          category_id: 2,
          income: 0,
          expenses: 900000,
          investments: 0,
          count: 5,
        },
      ],
    });

    expect(result.narrative).toContain('#2');
  });

  it('deriva recomendaciones de los insights cuando existen', async () => {
    const result = await provider.generate({
      summary: buildSummary({
        insights: [
          {
            type: 'overspending',
            severity: 'high',
            message: 'x',
            suggested_action: 'Recorta gastos hormiga',
          },
        ],
      }),
      categoryBreakdown: [],
    });

    expect(result.recommendations).toEqual(['Recorta gastos hormiga']);
  });

  it('devuelve recomendaciones genéricas cuando no hay insights', async () => {
    const result = await provider.generate({
      summary: buildSummary({ insights: [] }),
      categoryBreakdown: [],
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

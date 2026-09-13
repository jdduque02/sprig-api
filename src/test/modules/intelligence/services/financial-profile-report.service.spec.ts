// `@react-pdf/renderer` (y su árbol de dependencias, p. ej. @react-pdf/hyphenate)
// se distribuye solo como ESM; el runtime de Jest no puede cargarlo aunque
// Node sí (require(esm) nativo). Se mockea por completo: este test verifica
// la orquestación del servicio (qué se le pasa a la plantilla), no el render
// real del PDF — eso se valida manualmente contra el servidor corriendo.
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));

import { renderToBuffer } from '@react-pdf/renderer';
import { FinancialProfileReportService } from '@intelligence/service/financial-profile-report.service';
import {
  FinancialProfileReportDocument,
  FinancialProfileReportProps,
} from '@intelligence/templates/financial-profile-report.template';
import { ProfileBucketEnum } from '@shared/enums';

interface MockReactElement {
  type: unknown;
  props: FinancialProfileReportProps;
}

const mockRenderToBuffer = renderToBuffer as unknown as jest.Mock<
  Promise<Buffer>,
  [MockReactElement]
>;

function lastRenderedElement(): MockReactElement {
  return mockRenderToBuffer.mock.calls[0][0];
}

const financialAiAnalysisService = { analyze: jest.fn() };
const financialPeriodService = {
  findOne: jest.fn(),
  findOrCreateCurrent: jest.fn(),
};
const transactionRecordService = { getSummary: jest.fn(), findAll: jest.fn() };
const financialObjectiveService = { findAll: jest.fn() };
const bankAccountService = { findAll: jest.fn() };
const financialAssetService = { findAll: jest.fn() };
const financialLiabilityService = { findAll: jest.fn() };
const financialProfileService = { findByUserId: jest.fn() };
const userService = { findUser: jest.fn() };
const categoryService = { findAll: jest.fn() };

const buildPeriod = (overrides = {}) => ({
  id: 5,
  user_id: 10,
  year: 2026,
  month: 4,
  ...overrides,
});

const buildAnalysis = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  financial_period_id: 5,
  total_income: 5000000,
  total_expense: 3000000,
  narrative: 'Narrativa de prueba.',
  insights: [],
  recommendations: [],
  provider: 'rule-based',
  ...overrides,
});

const buildProfile = (overrides = {}) => ({
  id: '1',
  user_id: '10',
  profile_name: '50-30-20',
  needs_ratio: 50,
  wants_ratio: 30,
  savings_ratio: 20,
  investment_ratio: 10,
  max_debt_ratio: 40,
  ...overrides,
});

const buildUser = (overrides = {}) => ({
  id: '10',
  username: 'juan_perez',
  email: 'juan@example.com',
  full_name: 'Juan Pérez',
  ...overrides,
});

// El resumen del período (abril 2026): resolvePeriodDateRange(2026, 4) da
// date_from = '2026-04-01' — se usa para diferenciar, en el mock, la llamada
// de getSummary del período de la del año completo.
const PERIOD_DATE_FROM = '2026-04-01';

const buildPeriodTxSummary = (overrides = {}) => ({
  totals: { income: 5000000, expenses: 3000000, investments: 0, count: 5 },
  by_category: [
    { category_id: 1, income: 0, expenses: 2000000, investments: 0, count: 3 },
    { category_id: 99, income: 0, expenses: 1000000, investments: 0, count: 2 },
  ],
  series: [],
  ...overrides,
});

const buildYearlyTxSummary = (overrides = {}) => ({
  totals: { income: 20000000, expenses: 12000000, investments: 0, count: 40 },
  by_category: [
    // "Mercado" (wants): 8,000,000 de 12,000,000 = 66.7% -> debe marcarse.
    { category_id: 1, income: 0, expenses: 8000000, investments: 0, count: 20 },
    // "Arriendo" (needs): 4,000,000 de 12,000,000 = 33.3%, pero es "needs" -> no se marca.
    { category_id: 2, income: 0, expenses: 4000000, investments: 0, count: 12 },
  ],
  series: [],
  ...overrides,
});

describe('FinancialProfileReportService', () => {
  let service: FinancialProfileReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderToBuffer.mockResolvedValue(Buffer.from('%PDF-mock'));
    financialPeriodService.findOrCreateCurrent.mockResolvedValue(buildPeriod());
    financialAiAnalysisService.analyze.mockResolvedValue(buildAnalysis());
    financialProfileService.findByUserId.mockResolvedValue(buildProfile());
    userService.findUser.mockResolvedValue(buildUser());
    bankAccountService.findAll.mockResolvedValue([
      { id: 1, bank_name: 'Bancolombia', display_balance: '1000000' },
    ]);
    financialAssetService.findAll.mockResolvedValue([
      { id: 1, name: 'CDT', current_value: 500000 },
    ]);
    financialLiabilityService.findAll.mockResolvedValue([
      { id: 1, name: 'Tarjeta', current_balance: 200000 },
    ]);
    financialObjectiveService.findAll.mockResolvedValue([
      { id: 1, name: 'Fondo de emergencia', is_completed: false },
      { id: 2, name: 'Meta cumplida', is_completed: true },
    ]);
    transactionRecordService.getSummary.mockImplementation(
      (_userId: number, query: { date_from?: string }) =>
        Promise.resolve(
          query.date_from === PERIOD_DATE_FROM
            ? buildPeriodTxSummary()
            : buildYearlyTxSummary(),
        ),
    );
    transactionRecordService.findAll.mockResolvedValue({
      data: [
        {
          id: 101,
          category_id: 1,
          type: 'expense',
          amount: 50000,
          description: 'Almuerzo',
          transaction_date: '2026-09-01',
        },
      ],
      total: 1,
    });
    categoryService.findAll.mockResolvedValue([
      { id: 1, name: 'Mercado', profile_bucket: ProfileBucketEnum.WANTS },
      { id: 2, name: 'Arriendo', profile_bucket: ProfileBucketEnum.NEEDS },
    ]);

    service = new FinancialProfileReportService(
      financialAiAnalysisService as never,
      financialPeriodService as never,
      transactionRecordService as never,
      financialObjectiveService as never,
      bankAccountService as never,
      financialAssetService as never,
      financialLiabilityService as never,
      financialProfileService as never,
      userService as never,
      categoryService as never,
    );
  });

  it('devuelve el buffer generado por renderToBuffer', async () => {
    const buffer = await service.generate(10);

    expect(buffer).toEqual(Buffer.from('%PDF-mock'));
  });

  it('usa el período actual cuando no se pasa periodId', async () => {
    await service.generate(10);

    expect(financialPeriodService.findOrCreateCurrent).toHaveBeenCalledWith(10);
    expect(financialPeriodService.findOne).not.toHaveBeenCalled();
    expect(financialAiAnalysisService.analyze).toHaveBeenCalledWith(10, {
      periodId: 5,
    });
  });

  it('usa el período indicado por periodId', async () => {
    financialPeriodService.findOne.mockResolvedValue(buildPeriod({ id: 9 }));

    await service.generate(10, { periodId: 9 });

    expect(financialPeriodService.findOne).toHaveBeenCalledWith(9, 10);
    expect(financialAiAnalysisService.analyze).toHaveBeenCalledWith(10, {
      periodId: 9,
    });
  });

  it('arma el documento con el perfil, el análisis y solo las metas activas', async () => {
    await service.generate(10);

    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
    const element = lastRenderedElement();
    expect(element.type).toBe(FinancialProfileReportDocument);
    expect(element.props.profile).toMatchObject({ profile_name: '50-30-20' });
    expect(element.props.analysis).toMatchObject({ id: 1 });
    expect(element.props.activeObjectives).toEqual([
      expect.objectContaining({ id: 1, is_completed: false }),
    ]);
  });

  it('resuelve las categorías contra el catálogo, sin romper si falta un match', async () => {
    await service.generate(10);

    const element = lastRenderedElement();
    const categoryById = element.props.categoryById;
    expect(categoryById.get(1)?.name).toBe('Mercado');
    expect(categoryById.get(99)).toBeUndefined();
    expect(element.props.byCategory).toHaveLength(2);
  });

  it('arma el consolidado anual marcando solo categorías discrecionales con gasto alto', async () => {
    await service.generate(10);

    expect(transactionRecordService.getSummary).toHaveBeenCalledTimes(2);
    const element = lastRenderedElement();
    const review = element.props.yearlyCategoryReview;

    const mercado = review.find((r) => r.category_id === 1);
    const arriendo = review.find((r) => r.category_id === 2);
    expect(mercado).toMatchObject({ shouldReview: true, sharePercent: 66.67 });
    expect(arriendo).toMatchObject({ shouldReview: false });
  });

  it('trae los movimientos de los últimos 30 días', async () => {
    await service.generate(10);

    expect(transactionRecordService.findAll).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ page: 1, limit: 500 }),
    );
    const element = lastRenderedElement();
    expect(element.props.recentTransactions).toHaveLength(1);
    expect(element.props.recentTransactionsTruncated).toBe(false);
  });

  it('excluye las transferencias entre cuentas propias del listado de movimientos recientes', async () => {
    transactionRecordService.findAll.mockResolvedValue({
      data: [
        {
          id: 101,
          category_id: 1,
          type: 'expense',
          amount: 50000,
          description: 'Almuerzo',
          transaction_date: '2026-09-01',
        },
        {
          id: 102,
          category_id: null,
          type: 'transfer',
          amount: 2000000,
          description: 'Traslado entre cuentas',
          transaction_date: '2026-09-02',
        },
      ],
      total: 2,
    });

    await service.generate(10);

    const element = lastRenderedElement();
    expect(element.props.recentTransactions).toHaveLength(1);
    expect(element.props.recentTransactions[0].id).toBe(101);
  });

  it('marca los movimientos recientes como truncados cuando el total supera el tope de la consulta', async () => {
    transactionRecordService.findAll.mockResolvedValue({
      data: [
        {
          id: 101,
          category_id: 1,
          type: 'expense',
          amount: 50000,
          description: 'Almuerzo',
          transaction_date: '2026-09-01',
        },
      ],
      total: 501,
    });

    await service.generate(10);

    const element = lastRenderedElement();
    expect(element.props.recentTransactionsTruncated).toBe(true);
  });
});

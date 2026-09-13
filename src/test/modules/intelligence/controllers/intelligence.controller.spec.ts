// NestJS necesita importar la clase real (emitDecoratorMetadata) para el DI,
// aunque el test la mockee después — @react-pdf/renderer es ESM-only y Jest
// no puede cargarlo (ver financial-profile-report.service.spec.ts), así que
// se mockea aquí también solo para que la carga del módulo no falle.
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));

import { BadRequestException } from '@nestjs/common';
import { IntelligenceController } from '@intelligence/controller/intelligence.controller';
import { IntelligenceService } from '@intelligence/service/intelligence.service';
import { FinancialAiAnalysisService } from '@intelligence/service/financial-ai-analysis.service';
import { FinancialProfileReportService } from '@intelligence/service/financial-profile-report.service';
import { TaxSummaryCalculatorService } from '@intelligence/service/tax-summary-calculator.service';

const mockService = {
  findFinancialSummary: jest.fn(),
  findFinancialSummaryByPeriod: jest.fn(),
  findTaxSummary: jest.fn(),
};

const mockAiAnalysisService = {
  analyze: jest.fn(),
};

const mockReportService = {
  generate: jest.fn(),
};

const mockTaxCalculatorService = {
  calculateAndPersist: jest.fn(),
  update: jest.fn(),
};

const mockRes = {
  setHeader: jest.fn(),
  send: jest.fn(),
};

const currentUser = { sub: 'kc-uuid', userId: 10 };

describe('IntelligenceController', () => {
  let controller: IntelligenceController;

  beforeEach(() => {
    controller = new IntelligenceController(
      mockService as unknown as IntelligenceService,
      mockAiAnalysisService as unknown as FinancialAiAnalysisService,
      mockReportService as unknown as FinancialProfileReportService,
      mockTaxCalculatorService as unknown as TaxSummaryCalculatorService,
    );
    jest.clearAllMocks();
  });

  it('obtiene resumen financiero', async () => {
    const summary = { id: 1, user_id: 10 };
    mockService.findFinancialSummary.mockResolvedValue(summary);
    await expect(
      controller.getFinancialSummary(10, currentUser as never),
    ).resolves.toEqual(summary);
    expect(mockService.findFinancialSummary).toHaveBeenCalledWith(10);
  });

  it('obtiene resumen por período', async () => {
    const summary = { id: 1, financial_period_id: 5 };
    mockService.findFinancialSummaryByPeriod.mockResolvedValue(summary);
    await expect(
      controller.getFinancialSummaryByPeriod(10, 5, currentUser as never),
    ).resolves.toEqual(summary);
    expect(mockService.findFinancialSummaryByPeriod).toHaveBeenCalledWith(
      10,
      5,
    );
  });

  it('obtiene resumen fiscal sin año', async () => {
    const summary = { id: 1 };
    mockService.findTaxSummary.mockResolvedValue(summary);
    await expect(
      controller.getTaxSummary(10, currentUser as never),
    ).resolves.toEqual(summary);
    expect(mockService.findTaxSummary).toHaveBeenCalledWith(10, undefined);
  });

  it('obtiene resumen fiscal con año', async () => {
    mockService.findTaxSummary.mockResolvedValue({ id: 1 });
    await controller.getTaxSummary(10, currentUser as never, '2024');
    expect(mockService.findTaxSummary).toHaveBeenCalledWith(10, 2024);
  });

  it('calcula y persiste el resumen fiscal usando año y UVT por defecto', async () => {
    const currentYear = new Date().getFullYear();
    const calculatedSummary = {
      id: 1,
      user_id: 10,
      fiscal_year: currentYear,
      total_income: 50_000_000,
      calculation_notes: {
        validation: { has_income_data: true },
        calculated_at: '2026-01-01T00:00:00.000Z',
        income_sources: ['salario'],
        assets_breakdown: [{ type: 'cuenta_ahorros', amount: 10_000_000 }],
        liabilities_breakdown: [],
      },
    };
    mockTaxCalculatorService.calculateAndPersist.mockResolvedValue(
      calculatedSummary,
    );

    const result = await controller.calculateTaxSummary(
      10,
      currentUser as never,
    );

    expect(mockTaxCalculatorService.calculateAndPersist).toHaveBeenCalledWith(
      10,
      currentYear,
      undefined,
    );
    expect(result).toEqual({
      id: 1,
      user_id: 10,
      fiscal_year: currentYear,
      total_income: 50_000_000,
      calculation_notes: calculatedSummary.calculation_notes,
      validation: { has_income_data: true },
      calculation_details: {
        calculated_at: '2026-01-01T00:00:00.000Z',
        income_sources: ['salario'],
        assets_breakdown: [{ type: 'cuenta_ahorros', amount: 10_000_000 }],
        liabilities_breakdown: [],
      },
    });
  });

  it('calcula el resumen fiscal con año y UVT explícitos en query params', async () => {
    mockTaxCalculatorService.calculateAndPersist.mockResolvedValue({
      calculation_notes: {
        validation: {},
        calculated_at: '2024-01-01T00:00:00.000Z',
        income_sources: [],
        assets_breakdown: [],
        liabilities_breakdown: [],
      },
    });

    await controller.calculateTaxSummary(
      10,
      currentUser as never,
      '2024',
      '47065',
    );

    expect(mockTaxCalculatorService.calculateAndPersist).toHaveBeenCalledWith(
      10,
      2024,
      47065,
    );
  });

  it('edita un resumen fiscal existente', async () => {
    const updated = { id: 1, user_id: 10, total_income: 80000000 };
    mockTaxCalculatorService.update.mockResolvedValue(updated);

    const dto = { total_income: 80000000 };
    await expect(
      controller.updateTaxSummary(10, 1, dto as never, currentUser as never),
    ).resolves.toEqual(updated);
    expect(mockTaxCalculatorService.update).toHaveBeenCalledWith(10, 1, dto);
  });

  it('obtiene análisis de IA sin periodId', async () => {
    const analysis = { id: 1, narrative: 'texto', provider: 'rule-based' };
    mockAiAnalysisService.analyze.mockResolvedValue(analysis);

    await expect(
      controller.getAiAnalysis(10, currentUser as never),
    ).resolves.toEqual(analysis);
    expect(mockAiAnalysisService.analyze).toHaveBeenCalledWith(10, {
      periodId: undefined,
    });
  });

  it('obtiene análisis de IA con periodId', async () => {
    mockAiAnalysisService.analyze.mockResolvedValue({ id: 1 });

    await controller.getAiAnalysis(10, currentUser as never, '9');

    expect(mockAiAnalysisService.analyze).toHaveBeenCalledWith(10, {
      periodId: 9,
    });
  });

  it('rechaza un periodId no numérico con BadRequestException', async () => {
    await expect(
      controller.getAiAnalysis(10, currentUser as never, 'abc'),
    ).rejects.toThrow(BadRequestException);
    expect(mockAiAnalysisService.analyze).not.toHaveBeenCalled();
  });

  it('descarga el reporte PDF con los headers correctos', async () => {
    const buffer = Buffer.from('%PDF-1.7 fake');
    mockReportService.generate.mockResolvedValue(buffer);

    await controller.getReport(
      10,
      currentUser as never,
      undefined,
      mockRes as never,
    );

    expect(mockReportService.generate).toHaveBeenCalledWith(10, {
      periodId: undefined,
    });
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="reporte-financiero-10.pdf"',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });

  it('descarga el reporte PDF de un período específico', async () => {
    mockReportService.generate.mockResolvedValue(Buffer.from('%PDF'));

    await controller.getReport(10, currentUser as never, '9', mockRes as never);

    expect(mockReportService.generate).toHaveBeenCalledWith(10, {
      periodId: 9,
    });
  });

  it('rechaza un periodId no numérico en el reporte con BadRequestException', async () => {
    await expect(
      controller.getReport(10, currentUser as never, 'abc', mockRes as never),
    ).rejects.toThrow(BadRequestException);
    expect(mockReportService.generate).not.toHaveBeenCalled();
  });
});

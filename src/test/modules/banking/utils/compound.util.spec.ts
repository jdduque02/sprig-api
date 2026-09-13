import {
  accruedInterestDaily,
  cdtMaturityInterest,
  compoundFactor,
  futureValue,
  periodicRate,
  projectYield,
} from '@banking/utils/compound.util';

describe('compound.util', () => {
  describe('periodicRate', () => {
    it('EA: convierte a tasa diaria', () => {
      const r = periodicRate(12, 'EA', 'daily');
      expect(r).toBeCloseTo(Math.pow(1.12, 1 / 365) - 1, 10);
    });

    it('EA: convierte a tasa mensual', () => {
      const r = periodicRate(12, 'EA', 'monthly');
      expect(r).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 10);
    });

    it('EA: frecuencia anual retorna la misma tasa efectiva', () => {
      const r = periodicRate(12, 'EA', 'annual');
      expect(r).toBeCloseTo(0.12, 10);
    });

    it('nominal: divide entre 365 para frecuencia diaria', () => {
      const r = periodicRate(36.5, 'nominal', 'daily');
      expect(r).toBeCloseTo(0.001, 10);
    });

    it('nominal: divide entre 12 para frecuencia mensual', () => {
      const r = periodicRate(12, 'nominal', 'monthly');
      expect(r).toBeCloseTo(0.01, 10);
    });

    it('nominal: divide entre 1 para frecuencia anual', () => {
      const r = periodicRate(10, 'nominal', 'annual');
      expect(r).toBeCloseTo(0.1, 10);
    });

    it('MV: retorna la tasa mensual equivalente cuando la frecuencia es mensual', () => {
      const r = periodicRate(12, 'MV', 'monthly');
      const expected = Math.pow(1.12, 1 / 12) - 1;
      expect(r).toBeCloseTo(expected, 10);
    });

    it('MV: convierte a diaria a partir de la mensual', () => {
      const r = periodicRate(12, 'MV', 'daily');
      const monthly = Math.pow(1.12, 1 / 12) - 1;
      const expected = Math.pow(1 + monthly, 1 / 30) - 1;
      expect(r).toBeCloseTo(expected, 10);
    });

    it('MV: usa el valor anual como fallback para otras frecuencias', () => {
      const r = periodicRate(12, 'MV', 'annual');
      expect(r).toBeCloseTo(0.12, 10);
    });
  });

  describe('compoundFactor', () => {
    it('retorna 1 si la tasa es <= 0', () => {
      expect(compoundFactor(0, 'EA', 'monthly', 12)).toBe(1);
      expect(compoundFactor(-5, 'EA', 'monthly', 12)).toBe(1);
    });

    it('retorna 1 si los periodos son <= 0', () => {
      expect(compoundFactor(12, 'EA', 'monthly', 0)).toBe(1);
      expect(compoundFactor(12, 'EA', 'monthly', -3)).toBe(1);
    });

    it('calcula el factor compuesto para periodos positivos', () => {
      const factor = compoundFactor(12, 'EA', 'monthly', 12);
      expect(factor).toBeCloseTo(1.12, 2);
    });
  });

  describe('futureValue', () => {
    it('multiplica principal por el factor compuesto', () => {
      const fv = futureValue(1000000, 12, 'EA', 'monthly', 12);
      expect(fv).toBeCloseTo(1120000, 0);
    });
  });

  describe('accruedInterestDaily', () => {
    it('retorna 0 si la tasa es <= 0', () => {
      expect(accruedInterestDaily(1000, 0, 'EA', 30)).toBe(0);
    });

    it('retorna 0 si los días son <= 0', () => {
      expect(accruedInterestDaily(1000, 12, 'EA', 0)).toBe(0);
    });

    it('retorna 0 si el principal es <= 0', () => {
      expect(accruedInterestDaily(0, 12, 'EA', 30)).toBe(0);
    });

    it('calcula el interés acumulado para un número de días positivo', () => {
      const interest = accruedInterestDaily(1000000, 12, 'EA', 30);
      expect(interest).toBeGreaterThan(0);
    });
  });

  describe('cdtMaturityInterest', () => {
    it('retorna 0 si la tasa es <= 0', () => {
      expect(cdtMaturityInterest(1000000, 0, 'EA', 90)).toBe(0);
    });

    it('retorna 0 si el plazo es <= 0', () => {
      expect(cdtMaturityInterest(1000000, 12, 'EA', 0)).toBe(0);
    });

    it('retorna 0 si el principal es <= 0', () => {
      expect(cdtMaturityInterest(0, 12, 'EA', 90)).toBe(0);
    });

    it('calcula el interés a partir de una tasa EA', () => {
      const interest = cdtMaturityInterest(1000000, 12, 'EA', 365);
      expect(interest).toBeCloseTo(120000, 0);
    });

    it('convierte una tasa nominal a EA antes de calcular', () => {
      const interest = cdtMaturityInterest(1000000, 12, 'nominal', 365);
      expect(interest).toBeGreaterThan(0);
    });

    it('convierte una tasa MV a EA antes de calcular', () => {
      const interest = cdtMaturityInterest(1000000, 1, 'MV', 365);
      expect(interest).toBeGreaterThan(0);
    });
  });

  describe('projectYield', () => {
    it('proyecta saldos futuros a 1, 3, 5 y 10 años con tasa positiva', () => {
      const result = projectYield(1000000, 12, 'EA', 'monthly');
      expect(Object.keys(result)).toEqual(['1y', '3y', '5y', '10y']);
      expect(result['1y']).toBeCloseTo(1120000, 0);
      expect(result['10y']).toBeGreaterThan(result['5y']);
    });

    it('retorna el principal redondeado sin crecimiento si la tasa es 0', () => {
      const result = projectYield(1000000, 0, 'EA', 'monthly');
      expect(result['1y']).toBe(1000000);
      expect(result['10y']).toBe(1000000);
    });

    it('usa 365 periodos por año para frecuencia diaria', () => {
      const result = projectYield(1000000, 12, 'EA', 'daily');
      expect(result['1y']).toBeGreaterThan(1000000);
    });

    it('usa 1 periodo por año para frecuencia anual', () => {
      const result = projectYield(1000000, 12, 'EA', 'annual');
      expect(result['1y']).toBeCloseTo(1120000, 0);
    });
  });
});

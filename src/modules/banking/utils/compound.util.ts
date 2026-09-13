/**
 * Compound interest calculation utilities.
 *
 * Supports three rate_type conventions:
 * - EA  (Efectiva Anual):  the annual rate is an effective annual rate
 * - nominal:               the annual rate is nominal, compounded at `yield_frequency`
 * - MV  (Mes Vencido):     monthly rate (stored value is treated as EA and converted)
 *
 * All inputs use annual_rate as a percentage (e.g. 12.5 = 12.5%).
 */

export type RateType = 'EA' | 'nominal' | 'MV';
export type YieldFrequency = 'daily' | 'monthly' | 'annual';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert an EA (effective annual) rate to a periodic rate for the given frequency.
 */
function eaToPeriodic(eaRate: number, frequency: YieldFrequency): number {
  const r = eaRate / 100;
  if (frequency === 'daily') return Math.pow(1 + r, 1 / 365) - 1;
  if (frequency === 'monthly') return Math.pow(1 + r, 1 / 12) - 1;
  return r; // annual → same as EA
}

/**
 * Convert a nominal annual rate to a periodic rate for the given frequency.
 * Nominal means r/n where n = periods per year.
 */
function nominalToPeriodic(
  nominalRate: number,
  frequency: YieldFrequency,
): number {
  const r = nominalRate / 100;
  const n = frequency === 'daily' ? 365 : frequency === 'monthly' ? 12 : 1;
  return r / n;
}

/**
 * Get the periodic rate for a given annual_rate, rate_type, and yield_frequency.
 */
export function periodicRate(
  annualRatePercent: number,
  rateType: RateType,
  frequency: YieldFrequency,
): number {
  if (rateType === 'EA') return eaToPeriodic(annualRatePercent, frequency);
  if (rateType === 'nominal')
    return nominalToPeriodic(annualRatePercent, frequency);
  // MV — treat stored value as EA, convert to monthly, then to requested freq
  const monthlyRate = eaToPeriodic(annualRatePercent, 'monthly');
  if (frequency === 'monthly') return monthlyRate;
  if (frequency === 'daily') return Math.pow(1 + monthlyRate, 1 / 30) - 1;
  return annualRatePercent / 100; // annual fallback
}

/**
 * Compound interest factor for a given principal over N periods.
 * factor = (1 + periodicRate)^N
 */
export function compoundFactor(
  annualRatePercent: number,
  rateType: RateType,
  frequency: YieldFrequency,
  periods: number,
): number {
  if (annualRatePercent <= 0 || periods <= 0) return 1;
  const r = periodicRate(annualRatePercent, rateType, frequency);
  return Math.pow(1 + r, periods);
}

/**
 * Future value = principal × compoundFactor.
 */
export function futureValue(
  principal: number,
  annualRatePercent: number,
  rateType: RateType,
  frequency: YieldFrequency,
  periods: number,
): number {
  return round2(
    principal * compoundFactor(annualRatePercent, rateType, frequency, periods),
  );
}

/**
 * Compute accrued interest over a number of days (for daily accrual jobs).
 * interest = round2(principal × ((1 + dailyRate)^days - 1))
 */
export function accruedInterestDaily(
  principal: number,
  annualRatePercent: number,
  rateType: RateType,
  days: number,
): number {
  if (annualRatePercent <= 0 || days <= 0 || principal <= 0) return 0;
  const r = periodicRate(annualRatePercent, rateType, 'daily');
  return round2(principal * (Math.pow(1 + r, days) - 1));
}

/**
 * Interest at CDT maturity.
 * interest = round2(principal × ((1 + EA)^(term_days/365) - 1))
 * For non-EA rate_type, the rate is first converted to EA.
 */
export function cdtMaturityInterest(
  principal: number,
  annualRatePercent: number,
  rateType: RateType,
  termDays: number,
): number {
  if (annualRatePercent <= 0 || termDays <= 0 || principal <= 0) return 0;
  // Convert to EA if needed
  let eaRate = annualRatePercent;
  if (rateType === 'nominal') {
    // Nominal annual compounded daily → EA = (1 + r/365)^365 - 1
    eaRate = (Math.pow(1 + annualRatePercent / 100 / 365, 365) - 1) * 100;
  } else if (rateType === 'MV') {
    // MV → EA = (1 + monthly)^12 - 1
    const monthly = annualRatePercent / 100;
    eaRate = (Math.pow(1 + monthly, 12) - 1) * 100;
  }
  const r = eaRate / 100;
  return round2(principal * (Math.pow(1 + r, termDays / 365) - 1));
}

/**
 * Project balances at future horizons (1y, 3y, 5y, 10y).
 * Returns { "1y": ..., "3y": ..., "5y": ..., "10y": ... }
 */
export function projectYield(
  principal: number,
  annualRatePercent: number,
  rateType: RateType,
  frequency: YieldFrequency,
): Record<string, number> {
  const result: Record<string, number> = {};
  const years = [1, 3, 5, 10];

  for (const y of years) {
    const periodsPerYear =
      frequency === 'daily' ? 365 : frequency === 'monthly' ? 12 : 1;
    const totalPeriods = periodsPerYear * y;
    if (annualRatePercent > 0) {
      result[`${y}y`] = futureValue(
        principal,
        annualRatePercent,
        rateType,
        frequency,
        totalPeriods,
      );
    } else {
      result[`${y}y`] = round2(principal);
    }
  }

  return result;
}

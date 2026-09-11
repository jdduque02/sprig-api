/**
 * Rango de fechas (primer y último día del mes) de un período financiero
 * mensual, para consultar TransactionRecordService.getSummary sin duplicar
 * este cálculo en cada servicio que necesita el resumen del período.
 */
export function resolvePeriodDateRange(
  year: number,
  month: number,
): { date_from: string; date_to: string } {
  const mm = String(month).padStart(2, '0');
  const date_from = `${year}-${mm}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date_to = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return { date_from, date_to };
}

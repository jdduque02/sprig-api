import { ApiProperty } from '@nestjs/swagger';

/**
 * Punto diario de la serie temporal del forecast — pensado para alimentar
 * un gráfico de línea/área (Highcharts/Recharts) en el dashboard: `date` en
 * el eje X, `projected_balance` como serie principal, e
 * `income`/`expense` del día como series secundarias (stacked bar u overlay).
 */
export class CashFlowForecastPointDto {
  @ApiProperty({ example: '2026-09-14', description: 'Fecha (YYYY-MM-DD).' })
  date!: string;

  @ApiProperty({
    example: 120000,
    description:
      'Ingreso proyectado de ese día (fijo recurrente + promedio variable prorrateado).',
  })
  income!: number;

  @ApiProperty({
    example: 45000,
    description:
      'Gasto proyectado de ese día, en positivo (fijo recurrente + promedio variable prorrateado + inversiones fijas).',
  })
  expense!: number;

  @ApiProperty({
    example: 5320000,
    description: 'Saldo proyectado acumulado a esa fecha.',
  })
  projected_balance!: number;
}

/**
 * Resumen agregado de la ventana de 30/60/90 días — pensado para tarjetas
 * KPI o un gráfico de barras comparativo entre ventanas en el dashboard.
 */
export class CashFlowForecastBucketDto {
  @ApiProperty({ example: 30, enum: [30, 60, 90] })
  window_days!: 30 | 60 | 90;

  @ApiProperty({
    example: '2026-10-14',
    description: 'Fecha final de la ventana (YYYY-MM-DD).',
  })
  window_end_date!: string;

  @ApiProperty({
    example: 3600000,
    description: 'Ingreso proyectado total dentro de la ventana.',
  })
  projected_income!: number;

  @ApiProperty({
    example: 2100000,
    description:
      'Gasto proyectado total dentro de la ventana, en positivo (incluye inversiones fijas).',
  })
  projected_expense!: number;

  @ApiProperty({
    example: 1500000,
    description:
      'Neto proyectado de la ventana (projected_income - projected_expense).',
  })
  projected_net!: number;

  @ApiProperty({
    example: 6500000,
    description:
      'Saldo proyectado acumulado al final de la ventana (current_balance + proyecciones acumuladas).',
  })
  projected_balance!: number;
}

export class CashFlowForecastResponseDto {
  @ApiProperty({
    example: '2026-09-13',
    description:
      'Fecha de referencia ("hoy") en la zona horaria del usuario (todayInTimeZone).',
  })
  as_of_date!: string;

  @ApiProperty({
    example: 5000000,
    description:
      'Saldo actual (suma de display_balance de las cuentas bancarias del usuario).',
  })
  current_balance!: number;

  @ApiProperty({
    example: 3,
    description:
      'Cantidad de meses históricos usados para promediar el gasto/ingreso variable.',
  })
  historical_average_months!: number;

  @ApiProperty({ type: [CashFlowForecastBucketDto] })
  buckets!: CashFlowForecastBucketDto[];

  @ApiProperty({
    type: [CashFlowForecastPointDto],
    description:
      'Serie diaria acumulada hasta el mayor de los buckets solicitados (90 días).',
  })
  daily_series!: CashFlowForecastPointDto[];
}

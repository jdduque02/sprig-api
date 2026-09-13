import { ApiProperty } from '@nestjs/swagger';

export class PerformanceMemoryDto {
  @ApiProperty({ description: 'Resident Set Size en MB', example: 128.4 })
  rssMb!: number;

  @ApiProperty({ description: 'Heap total reservado en MB', example: 64 })
  heapTotalMb!: number;

  @ApiProperty({ description: 'Heap actualmente usado en MB', example: 42.1 })
  heapUsedMb!: number;

  @ApiProperty({
    description: 'Memoria externa (buffers, etc.) en MB',
    example: 3.2,
  })
  externalMb!: number;
}

export class PerformanceCpuDto {
  @ApiProperty({
    description:
      '% de CPU usado por el proceso durante la ventana de muestreo, relativo a los cores disponibles',
    example: 12.5,
  })
  usagePercent!: number;

  @ApiProperty({
    description:
      'Load average del sistema (1, 5, 15 min). En Windows suele ser [0,0,0].',
    example: [0.42, 0.51, 0.38],
  })
  loadAverage!: [number, number, number];

  @ApiProperty({ description: 'Número de cores disponibles', example: 4 })
  cores!: number;
}

export class PerformanceLatencyDto {
  @ApiProperty({
    description: 'Latencia de un round-trip simple contra PostgreSQL (ms)',
    example: 8,
  })
  databaseMs!: number;
}

export class PerformanceResponseDto {
  @ApiProperty({
    description: 'Tiempo activo del proceso en segundos',
    example: 3600,
  })
  uptimeSeconds!: number;

  @ApiProperty({ type: PerformanceMemoryDto })
  memory!: PerformanceMemoryDto;

  @ApiProperty({ type: PerformanceCpuDto })
  cpu!: PerformanceCpuDto;

  @ApiProperty({ type: PerformanceLatencyDto })
  latency!: PerformanceLatencyDto;

  @ApiProperty({
    description:
      'Resultado del health check de Terminus (DB, Redis, RabbitMQ, Keycloak, memoria, disco)',
  })
  health!: Record<string, unknown>;

  @ApiProperty({ description: 'Marca de tiempo ISO 8601 de la muestra' })
  timestamp!: string;
}

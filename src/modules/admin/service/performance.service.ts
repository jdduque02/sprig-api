import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'node:os';
import { HealthService } from '@admin/service/health.service';
import {
  PerformanceCpuDto,
  PerformanceLatencyDto,
  PerformanceMemoryDto,
  PerformanceResponseDto,
} from '@admin/dto/performance-response.dto';

const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_CPU_SAMPLE_MS = 100;

/**
 * Métricas de rendimiento del proceso Node/Nest, pensadas para alimentar un
 * dashboard en `cost-manager-web` (el backend solo entrega JSON crudo, nunca
 * formatea ni genera gráficos).
 *
 * Reutiliza `HealthService` (Terminus) para el estado de las dependencias en
 * vez de duplicar esa lógica, y el `DataSource` global de TypeORM para medir
 * una latencia real de ida y vuelta a PostgreSQL.
 */
@Injectable()
export class PerformanceService {
  constructor(
    private readonly healthService: HealthService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getSnapshot(): Promise<PerformanceResponseDto> {
    const [cpu, latency, health] = await Promise.all([
      this.getCpuUsage(),
      this.getLatency(),
      this.getHealthSnapshot(),
    ]);

    return {
      uptimeSeconds: Math.round(process.uptime()),
      memory: this.getMemoryUsage(),
      cpu,
      latency,
      health,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * `HealthCheckService.check()` (Terminus) lanza `ServiceUnavailableException`
   * cuando alguna dependencia está `down`, en vez de resolver con el resultado.
   * Para el dashboard de rendimiento no queremos perder uptime/memoria/CPU/
   * latencia solo porque una dependencia falló: capturamos el error y
   * devolvemos su body (`{status, info, error, details}`) igual que el
   * endpoint público `/health`.
   */
  private async getHealthSnapshot(): Promise<Record<string, unknown>> {
    try {
      return await this.healthService.check();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return error.getResponse() as Record<string, unknown>;
      }
      throw error;
    }
  }

  private getMemoryUsage(): PerformanceMemoryDto {
    const usage = process.memoryUsage();
    return {
      rssMb: this.toMb(usage.rss),
      heapTotalMb: this.toMb(usage.heapTotal),
      heapUsedMb: this.toMb(usage.heapUsed),
      externalMb: this.toMb(usage.external),
    };
  }

  private async getCpuUsage(
    sampleMs = DEFAULT_CPU_SAMPLE_MS,
  ): Promise<PerformanceCpuDto> {
    const cores = os.cpus().length || 1;
    const startUsage = process.cpuUsage();
    const startTimeNs = process.hrtime.bigint();

    await new Promise<void>((resolve) => setTimeout(resolve, sampleMs));

    const elapsedUsage = process.cpuUsage(startUsage);
    const elapsedTimeUs = Number(process.hrtime.bigint() - startTimeNs) / 1000;
    const totalCpuUs = elapsedUsage.user + elapsedUsage.system;
    const usagePercent =
      elapsedTimeUs > 0
        ? Math.min(100, (totalCpuUs / (elapsedTimeUs * cores)) * 100)
        : 0;

    const loadAverage = os.loadavg() as [number, number, number];

    return {
      usagePercent: this.round(usagePercent),
      loadAverage,
      cores,
    };
  }

  private async getLatency(): Promise<PerformanceLatencyDto> {
    const start = Date.now();
    await this.dataSource.query('SELECT 1');
    return { databaseMs: Date.now() - start };
  }

  private toMb(bytes: number): number {
    return this.round(bytes / BYTES_PER_MB);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

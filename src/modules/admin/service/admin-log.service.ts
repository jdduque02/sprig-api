import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SystemLogQueryDto,
  SystemLogSource,
} from '@admin/dto/system-log-query.dto';
import {
  SystemLogEntryDto,
  SystemLogStatsDto,
} from '@admin/dto/system-log-response.dto';

interface FallbackLogEntry {
  severity: string;
  data: unknown;
  context: string;
  source: string;
  timestamp: string;
}

interface NestLogEntry {
  pid: number;
  timestamp: string;
  level: string;
  context: string;
  message: string;
}

interface AuditLogEntry {
  action?: string;
  schema_name?: string;
  table_name?: string;
  record_id?: number | string;
  old_data?: unknown;
  new_data?: unknown;
  changed_by?: string;
  created_at?: string;
}

@Injectable()
export class AdminLogService {
  private readonly logger = new Logger(AdminLogService.name);
  private readonly logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
  }

  findAll(
    query: SystemLogQueryDto,
  ): Promise<{ data: SystemLogEntryDto[]; total: number }> {
    const entries: SystemLogEntryDto[] = [];

    if (
      query.source === SystemLogSource.ALL ||
      query.source === SystemLogSource.APP
    ) {
      entries.push(...this.readFallbackLogs());
      entries.push(...this.readNestLogs());
    }

    if (query.source === SystemLogSource.AUDIT) {
      entries.push(...this.readAuditLogs());
    }

    const filtered = this.applyFilters(entries, query);

    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return query.sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
    });

    const total = filtered.length;
    const start = (query.page! - 1) * query.limit!;
    const data = filtered.slice(start, start + query.limit!);

    return Promise.resolve({ data, total });
  }

  getStats(): Promise<SystemLogStatsDto> {
    const entries = this.readFallbackLogs();
    entries.push(...this.readNestLogs());
    entries.push(...this.readAuditLogs());

    const stats: SystemLogStatsDto = {
      total: entries.length,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    for (const entry of entries) {
      const sev = entry.severity?.toUpperCase();
      if (sev === 'INFO') stats.info++;
      else if (sev === 'WARN') stats.warn++;
      else if (sev === 'ERROR') stats.error++;
      else if (sev === 'DEBUG') stats.debug++;
    }

    if (entries.length > 0) {
      const sorted = entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      stats.newestEntry = sorted[0]?.timestamp;
      stats.oldestEntry = sorted[sorted.length - 1]?.timestamp;
    }

    return Promise.resolve(stats);
  }

  streamLogs(): Promise<SystemLogEntryDto[]> {
    const entries = this.readFallbackLogs();
    entries.push(...this.readNestLogs());
    return Promise.resolve(
      entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    );
  }

  private readFallbackLogs(): SystemLogEntryDto[] {
    const entries: SystemLogEntryDto[] = [];
    const filePath = path.join(this.logsDir, 'fallback-logs.json');

    try {
      if (!fs.existsSync(filePath)) return entries;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed: FallbackLogEntry = JSON.parse(
            lines[i],
          ) as FallbackLogEntry;
          entries.push({
            id: `app-${i}`,
            severity: parsed.severity ?? 'INFO',
            message:
              typeof parsed.data === 'string'
                ? parsed.data
                : JSON.stringify(parsed.data ?? ''),
            context: parsed.context ?? '',
            data:
              typeof parsed.data === 'object'
                ? (parsed.data as Record<string, unknown>)
                : undefined,
            source: parsed.source ?? 'app',
            timestamp: parsed.timestamp ?? new Date().toISOString(),
          });
        } catch {
          this.logger.warn(`Línea inválida en fallback-logs.json: ${i}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo leer fallback-logs.json: ${(err as Error).message}`,
      );
    }

    return entries;
  }

  private readNestLogs(): SystemLogEntryDto[] {
    const entries: SystemLogEntryDto[] = [];
    const filePath = path.join(this.logsDir, 'nest-logs.log');

    try {
      if (!fs.existsSync(filePath)) return entries;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed: NestLogEntry = JSON.parse(lines[i]) as NestLogEntry;
          entries.push({
            id: `nest-${i}`,
            severity: parsed.level?.toUpperCase() ?? 'INFO',
            message: parsed.message ?? '',
            context: parsed.context ?? '',
            source: 'nest',
            timestamp: parsed.timestamp ?? new Date().toISOString(),
          });
        } catch {
          this.logger.warn(`Línea inválida en nest-logs.log: ${i}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo leer nest-logs.log: ${(err as Error).message}`,
      );
    }

    return entries;
  }

  private readAuditLogs(): SystemLogEntryDto[] {
    const entries: SystemLogEntryDto[] = [];
    const filePath = path.join(this.logsDir, 'audit-logs.json');

    try {
      if (!fs.existsSync(filePath)) return entries;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i]) as AuditLogEntry;
          entries.push({
            id: `audit-${i}`,
            severity: parsed.action === 'DELETE' ? 'WARN' : 'INFO',
            message: `[AUDIT] ${parsed.action} ${parsed.schema_name}.${parsed.table_name}#${parsed.record_id}`,
            context: `audit.${parsed.table_name}`,
            data: {
              action: parsed.action,
              schema_name: parsed.schema_name,
              table_name: parsed.table_name,
              record_id: parsed.record_id,
              old_data: parsed.old_data,
              new_data: parsed.new_data,
              changed_by: parsed.changed_by,
            },
            source: 'audit',
            timestamp: parsed.created_at ?? new Date().toISOString(),
          });
        } catch {
          this.logger.warn(`Línea inválida en audit-logs.json: ${i}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo leer audit-logs.json: ${(err as Error).message}`,
      );
    }

    return entries;
  }

  private applyFilters(
    entries: SystemLogEntryDto[],
    query: SystemLogQueryDto,
  ): SystemLogEntryDto[] {
    let result = entries;

    if (query.severity) {
      result = result.filter((e) => e.severity === String(query.severity));
    }

    if (query.context) {
      const ctx = query.context.toLowerCase();
      result = result.filter((e) => e.context?.toLowerCase().includes(ctx));
    }

    if (query.search) {
      const s = query.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.message?.toLowerCase().includes(s) ||
          e.context?.toLowerCase().includes(s) ||
          JSON.stringify(e.data ?? '')
            .toLowerCase()
            .includes(s),
      );
    }

    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= start);
    }

    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= end);
    }

    return result;
  }
}

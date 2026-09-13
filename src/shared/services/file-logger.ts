import { LoggerService, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FileLogger implements LoggerService {
  private readonly logger = new Logger(FileLogger.name);
  private readonly logDir: string;
  private readonly logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'nest-logs.log');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message: string, context?: string) {
    this.writeEntry('LOG', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.writeEntry('ERROR', message, context, trace);
  }

  warn(message: string, context?: string) {
    this.writeEntry('WARN', message, context);
  }

  debug(message: string, context?: string) {
    this.writeEntry('DEBUG', message, context);
  }

  verbose(message: string, context?: string) {
    this.writeEntry('VERBOSE', message, context);
  }

  private writeEntry(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ) {
    const entry = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      level,
      context: context ?? '',
      message,
      ...(trace ? { trace } : {}),
    };

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    } catch {
      this.logger.error(`No se pudo escribir log a archivo`);
    }
  }
}

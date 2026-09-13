/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { retry, catchError } from 'rxjs/operators';
import { firstValueFrom, from, throwError } from 'rxjs';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ==================== INTERFACES Y TIPOS ====================

/**
 * Niveles de severidad disponibles para los logs
 */
export enum LogSeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * Estructura de datos para un log
 */
export interface LogData {
  severity: LogSeverity;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  source: string;
}

/**
 * Configuración del servicio de logging
 */
export interface LoggingConfig {
  logServiceUrl: string;
  isDevEnvironment: boolean;
  serviceName: string;
  maxRetries: number;
}

/**
 * Interfaz para proveedores de logging remoto
 * Principio de Inversión de Dependencias (DIP)
 */
export interface IRemoteLogProvider {
  sendLog(logData: LogData): Promise<void>;
}

/**
 * Interfaz para proveedores de logging local
 * Principio de Inversión de Dependencias (DIP)
 */
export interface ILocalLogProvider {
  saveLog(logData: LogData): Promise<void>;
}

/**
 * Interfaz para factory de configuración
 * Principio de Inversión de Dependencias (DIP)
 */
export interface IConfigurationFactory {
  createLoggingConfig(): LoggingConfig;
}

// ==================== IMPLEMENTACIONES CONCRETAS ====================

/**
 * Proveedor de logging remoto usando HTTP
 * Principio de Responsabilidad Única (SRP)
 */
@Injectable()
export class HttpRemoteLogProvider implements IRemoteLogProvider {
  private readonly logger = new Logger(HttpRemoteLogProvider.name);

  async sendLog(logData: LogData): Promise<void> {
    const config = this.getConfig();

    try {
      await firstValueFrom(
        from(
          axios.post(config.logServiceUrl, logData, {
            timeout: 5000,
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        ).pipe(
          retry(config.maxRetries),
          catchError((error) => {
            this.logger.error(`Error en petición HTTP: ${error.message}`);
            return throwError(
              () => new Error(`Error enviando log remoto: ${error.message}`),
            );
          }),
        ),
      );
    } catch (error) {
      throw new Error(`Fallo al enviar log remoto: ${error.message}`);
    }
  }

  private getConfig(): LoggingConfig {
    // Esta implementación podría inyectar IConfigurationFactory
    // Por simplicidad, mantenemos lógica básica aquí
    return {
      logServiceUrl: process.env.LOG_SERVICE_URL || 'http://localhost:3000',
      maxRetries: 3,
      isDevEnvironment: process.env.APP_DEV === 'true',
      serviceName: 'module-service',
    };
  }
}

/**
 * Proveedor de logging local usando sistema de archivos
 * Principio de Responsabilidad Única (SRP)
 */
@Injectable()
export class FileLocalLogProvider implements ILocalLogProvider {
  private readonly logger = new Logger(FileLocalLogProvider.name);
  private readonly logDirectory = path.join(process.cwd(), 'logs');
  private readonly logFileName = 'fallback-logs.json';

  async saveLog(logData: LogData): Promise<void> {
    try {
      await this.ensureLogDirectoryExists();
      const logFilePath = path.join(this.logDirectory, this.logFileName);
      const logEntry = this.formatLogEntry(logData);

      await fs.promises.appendFile(logFilePath, logEntry);
      this.logger.log(`Log guardado localmente: ${logFilePath}`);
    } catch (error) {
      this.logger.error(`Error guardando log local: ${error.message}`);
      throw new Error(`No se pudo guardar el log localmente: ${error.message}`);
    }
  }

  private async ensureLogDirectoryExists(): Promise<void> {
    try {
      await fs.promises.access(this.logDirectory);
    } catch {
      await fs.promises.mkdir(this.logDirectory, { recursive: true });
    }
  }

  private formatLogEntry(logData: LogData): string {
    return (
      JSON.stringify({
        ...logData,
        timestamp: logData.timestamp.toISOString(),
      }) + '\n'
    );
  }
}

/**
 * Factory para crear configuración de logging
 * Principio de Responsabilidad Única (SRP)
 */
@Injectable()
export class ConfigurationFactory implements IConfigurationFactory {
  constructor(private readonly configService: ConfigService) {}

  createLoggingConfig(): LoggingConfig {
    return {
      logServiceUrl: this.configService.get<string>(
        'LOG_SERVICE_URL',
        'http://localhost:3000',
      ),
      isDevEnvironment:
        this.configService.get<string>('APP_DEV', 'false') === 'true',
      serviceName: this.configService.get<string>(
        'SERVICE_NAME',
        'module-service',
      ),
      maxRetries: this.configService.get<number>('LOG_MAX_RETRIES', 3),
    };
  }
}

/**
 * Builder para crear objetos LogData
 * Principio de Responsabilidad Única (SRP)
 */
export class LogDataBuilder {
  private logData: Partial<LogData> = {};

  static create(): LogDataBuilder {
    return new LogDataBuilder();
  }

  withSeverity(severity: LogSeverity): LogDataBuilder {
    this.logData.severity = severity;
    return this;
  }

  withMessage(message: string): LogDataBuilder {
    this.logData.message = message;
    return this;
  }

  withData(data: Record<string, any>): LogDataBuilder {
    this.logData.data = data;
    return this;
  }

  withSource(source: string): LogDataBuilder {
    this.logData.source = source;
    return this;
  }

  build(): LogData {
    if (!this.logData.severity || !this.logData.message) {
      throw new Error('Severity y message son campos obligatorios');
    }

    return {
      severity: this.logData.severity,
      message: this.logData.message,
      data: this.logData.data || {},
      timestamp: new Date(),
      source: this.logData.source || 'unknown',
    };
  }
}

// ==================== SERVICIO PRINCIPAL ====================

/**
 * Servicio principal de logging que orquesta el envío de logs
 *
 * Aplica principios SOLID:
 * - SRP: Solo se encarga de coordinar el logging
 * - OCP: Abierto para extensión (nuevos providers) cerrado para modificación
 * - LSP: Los providers implementan interfaces bien definidas
 * - ISP: Interfaces específicas y cohesivas
 * - DIP: Depende de abstracciones, no de implementaciones concretas
 *
 * @example
 * ```typescript
 * // Uso con interfaz original (mensaje, tipo)
 * await loggingService.sendLog('Usuario autenticado correctamente', 'INFO');
 * await loggingService.sendLog('Error en base de datos', 'ERROR');
 *
 * // Uso con datos adicionales
 * await loggingService.sendLog('Operación completada', 'INFO', { userId: 123, duration: '2.5s' });
 *
 * // Uso con métodos de conveniencia
 * await loggingService.logInfo('Operación completada');
 * await loggingService.logError('Error procesando datos', { userId: 123, action: 'update' });
 * ```
 */
@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly config: LoggingConfig;

  constructor(
    private readonly remoteLogProvider: IRemoteLogProvider,
    private readonly localLogProvider: ILocalLogProvider,
    private readonly configurationFactory: IConfigurationFactory,
  ) {
    this.config = this.configurationFactory.createLoggingConfig();
  }

  /**
   * Función principal de logging que acepta mensaje y tipo
   * Compatible con la interfaz original (mensaje, tipo)
   *
   * @param message - El mensaje del log
   * @param type - El tipo de log: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG'
   * @param data - Datos adicionales opcionales
   */
  async sendLog(
    message: string,
    type: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' = 'INFO',
    data?: Record<string, any>,
  ): Promise<void> {
    // Convertir string a enum para mantener tipado fuerte
    const severity = LogSeverity[type];

    if (!severity) {
      throw new Error(
        `Tipo de log inválido: ${type}. Tipos válidos: INFO, ERROR, WARN, DEBUG`,
      );
    }

    await this.processLog(severity, message, data);
  }

  /**
   * Envía un log con severidad INFO
   * Método de conveniencia
   */
  async logInfo(message: string, data?: Record<string, any>): Promise<void> {
    await this.sendLog(message, 'INFO', data);
  }

  /**
   * Envía un log con severidad WARN
   * Método de conveniencia
   */
  async logWarn(message: string, data?: Record<string, any>): Promise<void> {
    await this.sendLog(message, 'WARN', data);
  }

  /**
   * Envía un log con severidad ERROR
   * Método de conveniencia
   */
  async logError(message: string, data?: Record<string, any>): Promise<void> {
    await this.sendLog(message, 'ERROR', data);
  }

  /**
   * Envía un log con severidad DEBUG
   * Método de conveniencia
   */
  async logDebug(message: string, data?: Record<string, any>): Promise<void> {
    await this.sendLog(message, 'DEBUG', data);
  }

  /**
   * Método interno para procesar logs
   * Implementa estrategia de fallback: intenta remoto, si falla guarda local
   */
  private async processLog(
    severity: LogSeverity,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const logData = LogDataBuilder.create()
      .withSeverity(severity)
      .withMessage(message)
      .withData(data || {})
      .withSource(this.buildSourceName())
      .build();

    try {
      await this.remoteLogProvider.sendLog(logData);
      this.logger.debug(`Log enviado remotamente: ${message}`);
    } catch (error) {
      this.logger.warn(
        `Error enviando log remoto, guardando localmente: ${error.message}`,
      );
      try {
        await this.localLogProvider.saveLog(logData);
      } catch (localError) {
        this.logger.error(
          `Error crítico: no se pudo guardar log ni remoto ni local: ${localError.message}`,
        );
        throw new Error('Sistema de logging no disponible');
      }
    }
  }

  /**
   * Construye el nombre de la fuente basado en la configuración
   */
  private buildSourceName(): string {
    const suffix = this.config.isDevEnvironment ? '_dev' : '';
    return `${this.config.serviceName}${suffix}`;
  }
}

// ==================== MÓDULO DE CONFIGURACIÓN ====================

/**
 * Módulo que configura todos los providers necesarios para el logging
 * Facilita la inyección de dependencias y testing
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IRemoteLogProvider',
      useClass: HttpRemoteLogProvider,
    },
    {
      provide: 'ILocalLogProvider',
      useClass: FileLocalLogProvider,
    },
    {
      provide: 'IConfigurationFactory',
      useClass: ConfigurationFactory,
    },
    {
      provide: LoggingService,
      useFactory: (
        remoteProvider: IRemoteLogProvider,
        localProvider: ILocalLogProvider,
        configFactory: IConfigurationFactory,
      ) => {
        return new LoggingService(remoteProvider, localProvider, configFactory);
      },
      inject: [
        'IRemoteLogProvider',
        'ILocalLogProvider',
        'IConfigurationFactory',
      ],
    },
  ],
  exports: [LoggingService],
})
export class LoggingModule {}

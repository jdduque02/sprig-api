import axios from 'axios';
import * as fs from 'node:fs';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  ConfigurationFactory,
  FileLocalLogProvider,
  HttpRemoteLogProvider,
  LogDataBuilder,
  LoggingModule,
  LogSeverity,
  LoggingService,
} from '@shared/interceptors/logging.interceptor';

jest.mock('axios');

describe('logging.interceptor units', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LogDataBuilder', () => {
    it('debe construir un LogData válido con defaults', () => {
      const log = LogDataBuilder.create()
        .withSeverity(LogSeverity.INFO)
        .withMessage('ok')
        .build();

      expect(log.severity).toBe(LogSeverity.INFO);
      expect(log.message).toBe('ok');
      expect(log.source).toBe('unknown');
      expect(log.data).toEqual({});
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('debe lanzar error si faltan campos obligatorios', () => {
      expect(() => LogDataBuilder.create().withMessage('x').build()).toThrow(
        'Severity y message son campos obligatorios',
      );
    });
  });

  describe('ConfigurationFactory', () => {
    it('debe mapear valores desde ConfigService', () => {
      const configService = {
        get: jest.fn((key: string, defaultValue: unknown) => {
          const map: Record<string, unknown> = {
            LOG_SERVICE_URL: 'http://logger:3000',
            APP_DEV: 'true',
            SERVICE_NAME: 'cost-manager',
            LOG_MAX_RETRIES: 5,
          };
          return key in map ? map[key] : defaultValue;
        }),
      };

      const factory = new ConfigurationFactory(configService as any);
      const cfg = factory.createLoggingConfig();

      expect(cfg).toEqual({
        logServiceUrl: 'http://logger:3000',
        isDevEnvironment: true,
        serviceName: 'cost-manager',
        maxRetries: 5,
      });
    });
  });

  describe('HttpRemoteLogProvider', () => {
    it('debe enviar log remoto exitosamente', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const provider = new HttpRemoteLogProvider();

      await expect(
        provider.sendLog({
          severity: LogSeverity.INFO,
          message: 'test',
          timestamp: new Date(),
          source: 'svc',
          data: {},
        }),
      ).resolves.toBeUndefined();
    });

    it('debe lanzar error si falla el envío remoto', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('network fail'));
      const provider = new HttpRemoteLogProvider();

      await expect(
        provider.sendLog({
          severity: LogSeverity.INFO,
          message: 'test',
          timestamp: new Date(),
          source: 'svc',
          data: {},
        }),
      ).rejects.toThrow('Fallo al enviar log remoto');
    });
  });

  describe('FileLocalLogProvider', () => {
    it('debe guardar el log localmente en fallback-logs.json', async () => {
      const accessSpy = jest
        .spyOn(fs.promises, 'access')
        .mockResolvedValue(undefined);
      const mkdirSpy = jest
        .spyOn(fs.promises, 'mkdir')
        .mockResolvedValue(undefined);
      const appendSpy = jest
        .spyOn(fs.promises, 'appendFile')
        .mockResolvedValue(undefined);

      const provider = new FileLocalLogProvider();
      await provider.saveLog({
        severity: LogSeverity.ERROR,
        message: 'fallo',
        timestamp: new Date(),
        source: 'svc',
        data: { id: 1 },
      });

      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(mkdirSpy).not.toHaveBeenCalled();

      accessSpy.mockRestore();
      mkdirSpy.mockRestore();
      appendSpy.mockRestore();
    });

    it('debe crear el directorio de logs si no existe (access rechaza)', async () => {
      const accessSpy = jest
        .spyOn(fs.promises, 'access')
        .mockRejectedValue(new Error('ENOENT'));
      const mkdirSpy = jest
        .spyOn(fs.promises, 'mkdir')
        .mockResolvedValue(undefined);
      const appendSpy = jest
        .spyOn(fs.promises, 'appendFile')
        .mockResolvedValue(undefined);

      const provider = new FileLocalLogProvider();
      await provider.saveLog({
        severity: LogSeverity.INFO,
        message: 'nuevo directorio',
        timestamp: new Date(),
        source: 'svc',
        data: {},
      });

      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true }),
      );
      expect(appendSpy).toHaveBeenCalledTimes(1);

      accessSpy.mockRestore();
      mkdirSpy.mockRestore();
      appendSpy.mockRestore();
    });

    it('debe lanzar error si falla el guardado local (appendFile falla)', async () => {
      const accessSpy = jest
        .spyOn(fs.promises, 'access')
        .mockResolvedValue(undefined);
      const appendSpy = jest
        .spyOn(fs.promises, 'appendFile')
        .mockRejectedValue(new Error('disk full'));

      const provider = new FileLocalLogProvider();

      await expect(
        provider.saveLog({
          severity: LogSeverity.ERROR,
          message: 'fallo critico',
          timestamp: new Date(),
          source: 'svc',
          data: {},
        }),
      ).rejects.toThrow('No se pudo guardar el log localmente');

      accessSpy.mockRestore();
      appendSpy.mockRestore();
    });
  });

  describe('LoggingService', () => {
    it('debe usar fallback local si falla proveedor remoto', async () => {
      const remoteProvider = {
        sendLog: jest.fn().mockRejectedValue(new Error('remote down')),
      };
      const localProvider = {
        saveLog: jest.fn().mockResolvedValue(undefined),
      };
      const configurationFactory = {
        createLoggingConfig: jest.fn().mockReturnValue({
          logServiceUrl: 'http://logger:3000',
          isDevEnvironment: false,
          serviceName: 'svc',
          maxRetries: 3,
        }),
      };

      const service = new LoggingService(
        remoteProvider,
        localProvider,
        configurationFactory,
      );

      await service.sendLog('evento', 'INFO', { a: 1 });

      expect(remoteProvider.sendLog).toHaveBeenCalledTimes(1);
      expect(localProvider.saveLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar error si tipo de log es inválido', async () => {
      const service = new LoggingService(
        { sendLog: jest.fn() },
        { saveLog: jest.fn() },
        {
          createLoggingConfig: jest.fn().mockReturnValue({
            logServiceUrl: 'http://logger:3000',
            isDevEnvironment: false,
            serviceName: 'svc',
            maxRetries: 3,
          }),
        },
      );

      await expect(service.sendLog('evento', 'INVALID' as any)).rejects.toThrow(
        'Tipo de log inválido',
      );
    });

    it('debe registrar el log remotamente sin recurrir al fallback local', async () => {
      const remoteProvider = {
        sendLog: jest.fn().mockResolvedValue(undefined),
      };
      const localProvider = { saveLog: jest.fn() };
      const configurationFactory = {
        createLoggingConfig: jest.fn().mockReturnValue({
          logServiceUrl: 'http://logger:3000',
          isDevEnvironment: false,
          serviceName: 'svc',
          maxRetries: 3,
        }),
      };

      const service = new LoggingService(
        remoteProvider,
        localProvider,
        configurationFactory,
      );

      await service.sendLog('evento exitoso', 'INFO');

      expect(remoteProvider.sendLog).toHaveBeenCalledTimes(1);
      expect(localProvider.saveLog).not.toHaveBeenCalled();
    });

    it('debe lanzar "Sistema de logging no disponible" si fallan remoto y local', async () => {
      const remoteProvider = {
        sendLog: jest.fn().mockRejectedValue(new Error('remote down')),
      };
      const localProvider = {
        saveLog: jest.fn().mockRejectedValue(new Error('disk full')),
      };
      const configurationFactory = {
        createLoggingConfig: jest.fn().mockReturnValue({
          logServiceUrl: 'http://logger:3000',
          isDevEnvironment: false,
          serviceName: 'svc',
          maxRetries: 3,
        }),
      };

      const service = new LoggingService(
        remoteProvider,
        localProvider,
        configurationFactory,
      );

      await expect(service.sendLog('evento critico', 'ERROR')).rejects.toThrow(
        'Sistema de logging no disponible',
      );
      expect(localProvider.saveLog).toHaveBeenCalledTimes(1);
    });

    it('debe exponer métodos de conveniencia logInfo/logWarn/logError/logDebug', async () => {
      const remoteProvider = {
        sendLog: jest.fn().mockResolvedValue(undefined),
      };
      const localProvider = { saveLog: jest.fn() };
      const configurationFactory = {
        createLoggingConfig: jest.fn().mockReturnValue({
          logServiceUrl: 'http://logger:3000',
          isDevEnvironment: true,
          serviceName: 'svc',
          maxRetries: 3,
        }),
      };

      const service = new LoggingService(
        remoteProvider,
        localProvider,
        configurationFactory,
      );

      await service.logInfo('info msg', { a: 1 });
      await service.logWarn('warn msg', { a: 2 });
      await service.logError('error msg', { a: 3 });
      await service.logDebug('debug msg', { a: 4 });

      expect(remoteProvider.sendLog).toHaveBeenCalledTimes(4);
      expect(remoteProvider.sendLog).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          severity: LogSeverity.INFO,
          message: 'info msg',
        }),
      );
      expect(remoteProvider.sendLog).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          severity: LogSeverity.WARN,
          message: 'warn msg',
        }),
      );
      expect(remoteProvider.sendLog).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          severity: LogSeverity.ERROR,
          message: 'error msg',
        }),
      );
      expect(remoteProvider.sendLog).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          severity: LogSeverity.DEBUG,
          message: 'debug msg',
        }),
      );
    });
  });

  describe('LoggingModule', () => {
    it('resuelve LoggingService a través de la factory de DI del módulo', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true }), LoggingModule],
      }).compile();

      const loggingService = moduleRef.get(LoggingService);

      expect(loggingService).toBeInstanceOf(LoggingService);

      await moduleRef.close();
    });
  });
});

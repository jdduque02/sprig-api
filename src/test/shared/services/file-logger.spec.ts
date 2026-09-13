import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileLogger } from '@shared/services/file-logger';

jest.mock('node:fs');

const mockedFs = jest.mocked(fs);

describe('FileLogger', () => {
  let logger: FileLogger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('debe crear el directorio de logs si no existe', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockReturnValue(undefined);

      logger = new FileLogger();

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true },
      );
    });

    it('no debe crear el directorio si ya existe', () => {
      mockedFs.existsSync.mockReturnValue(true);

      logger = new FileLogger();

      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('debe construir rutas correctas para logDir y logFile', () => {
      mockedFs.existsSync.mockReturnValue(true);

      logger = new FileLogger();

      const logDir = path.join(process.cwd(), 'logs');
      const logFile = path.join(logDir, 'nest-logs.log');
      expect((logger as any).logDir).toBe(logDir);
      expect((logger as any).logFile).toBe(logFile);
    });
  });

  describe('log', () => {
    it('debe escribir entrada con nivel LOG', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.log('hello', 'App');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('LOG');
      expect(entry.message).toBe('hello');
      expect(entry.context).toBe('App');
      expect(entry.pid).toBe(process.pid);
      expect(entry.timestamp).toBeDefined();
    });
  });

  describe('error', () => {
    it('debe escribir entrada con nivel ERROR y trace', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.error('fail', 'stack-trace', 'Ctx');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('ERROR');
      expect(entry.message).toBe('fail');
      expect(entry.context).toBe('Ctx');
      expect(entry.trace).toBe('stack-trace');
    });

    it('debe omitir trace si no se provee', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.error('fail');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('ERROR');
      expect(entry.trace).toBeUndefined();
    });
  });

  describe('warn', () => {
    it('debe escribir entrada con nivel WARN', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.warn('careful', 'Ctx');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('WARN');
      expect(entry.message).toBe('careful');
      expect(entry.context).toBe('Ctx');
    });
  });

  describe('debug', () => {
    it('debe escribir entrada con nivel DEBUG', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.debug('trace info', 'Dbg');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('DEBUG');
      expect(entry.message).toBe('trace info');
      expect(entry.context).toBe('Dbg');
    });
  });

  describe('verbose', () => {
    it('debe escribir entrada con nivel VERBOSE', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockReturnValue(undefined);

      logger.verbose('detail', 'Verb');

      const call = mockedFs.appendFileSync.mock.calls[0];
      const entry = JSON.parse(call[1] as string);
      expect(entry.level).toBe('VERBOSE');
      expect(entry.message).toBe('detail');
      expect(entry.context).toBe('Verb');
    });
  });

  describe('manejo de errores', () => {
    it('debe manejar fallo de appendFileSync sin lanzar excepción', () => {
      mockedFs.existsSync.mockReturnValue(true);
      logger = new FileLogger();
      mockedFs.appendFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });

      const loggerErrorSpy = jest
        .spyOn((logger as any).logger, 'error')
        .mockImplementation(() => {});

      expect(() => logger.log('test')).not.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'No se pudo escribir log a archivo',
      );
      loggerErrorSpy.mockRestore();
    });
  });
});

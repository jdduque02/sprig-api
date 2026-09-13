import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '@shared/services/logging.service';
import axios from 'axios';
import * as fs from 'node:fs';

jest.mock('axios');
jest.mock('node:fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = jest.mocked(fs);

interface ServiceWithLogger {
  logger: { error: jest.Mock };
}

describe('LoggingService', () => {
  let service: LoggingService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LoggingService>(LoggingService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendLog', () => {
    it('should send log via axios when LOG_SERVICE_URL is defined', async () => {
      configService.get
        .mockReturnValueOnce('false') // APP_DEV
        .mockReturnValueOnce('http://log-service.example.com'); // LOG_SERVICE_URL

      const postMock = jest.fn().mockResolvedValue({ status: 200 });
      mockedAxios.post = postMock;

      await service.sendLog({ message: 'test' }, 'INFO', 'TestContext');

      expect(postMock).toHaveBeenCalledWith(
        'http://log-service.example.com',
        expect.objectContaining({
          severity: 'INFO',
          data: { message: 'test' },
          context: 'TestContext',
          source: 'cost-manager',
        }),
      );
    });

    it('should append "_dev" to source when APP_DEV is "true"', async () => {
      configService.get
        .mockReturnValueOnce('true') // APP_DEV
        .mockReturnValueOnce('http://log-service.example.com'); // LOG_SERVICE_URL

      const postMock = jest.fn().mockResolvedValue({ status: 200 });
      mockedAxios.post = postMock;

      await service.sendLog({ message: 'test' }, 'INFO', 'TestContext');

      expect(postMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ source: 'cost-manager_dev' }),
      );
    });

    it('should use default severity "INFO" when not provided', async () => {
      configService.get
        .mockReturnValueOnce('false')
        .mockReturnValueOnce('http://log-service.example.com');

      const postMock = jest.fn().mockResolvedValue({ status: 200 });
      mockedAxios.post = postMock;

      await service.sendLog({ message: 'test' }, undefined, 'TestContext');

      expect(postMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ severity: 'INFO' }),
      );
    });

    it('should save log locally when LOG_SERVICE_URL is not defined', async () => {
      configService.get
        .mockReturnValueOnce('false') // APP_DEV
        .mockReturnValueOnce(undefined); // LOG_SERVICE_URL

      const postMock = jest.fn();
      mockedAxios.post = postMock;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.appendFile.mockImplementation(
        (_p: any, _d: any, cb: (error: Error | null) => void) => {
          cb(null);
          return undefined;
        },
      );

      await service.sendLog({ message: 'test' }, 'ERROR', 'TestContext');

      expect(postMock).not.toHaveBeenCalled();
      expect(mockedFs.appendFile).toHaveBeenCalled();
    });

    it('should create log directory if it does not exist', async () => {
      configService.get
        .mockReturnValueOnce('false')
        .mockReturnValueOnce(undefined);

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.appendFile.mockImplementation(
        (_p: any, _d: any, cb: (error: Error | null) => void) => {
          cb(null);
          return undefined;
        },
      );

      await service.sendLog({ message: 'test' }, 'WARN', 'TestContext');

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it('should save log locally when axios fails after retries', async () => {
      configService.get
        .mockReturnValueOnce('false')
        .mockReturnValueOnce('http://log-service.example.com');

      const postMock = jest.fn().mockRejectedValue(new Error('Network error'));
      mockedAxios.post = postMock;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.appendFile.mockImplementation(
        (_p: any, _d: any, cb: (error: Error | null) => void) => {
          cb(null);
          return undefined;
        },
      );

      await service.sendLog({ message: 'test' }, 'ERROR', 'TestContext');

      // retry(3) realiza 1 intento original + 3 reintentos = 4 llamadas totales
      expect(postMock).toHaveBeenCalledTimes(4);
      expect(mockedFs.appendFile).toHaveBeenCalled();
    });

    it('should log error when appendFile fails', async () => {
      configService.get
        .mockReturnValueOnce('false')
        .mockReturnValueOnce(undefined);

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.appendFile.mockImplementation(
        (_p: any, _d: any, cb: (error: Error | null) => void) => {
          cb(new Error('disk full'));
          return undefined;
        },
      );

      const loggerErrorSpy = jest
        .spyOn((service as unknown as ServiceWithLogger).logger, 'error')
        .mockImplementation(() => {});

      await service.sendLog({ message: 'test' }, 'INFO', 'TestContext');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('disk full'),
      );

      loggerErrorSpy.mockRestore();
    });

    it('should log error when LOG_SERVICE_URL is not defined', async () => {
      configService.get
        .mockReturnValueOnce('false')
        .mockReturnValueOnce(undefined);

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.appendFile.mockImplementation(
        (_p: any, _d: any, cb: (error: Error | null) => void) => {
          cb(null);
          return undefined;
        },
      );

      const loggerErrorSpy = jest
        .spyOn((service as unknown as ServiceWithLogger).logger, 'error')
        .mockImplementation(() => {});

      await service.sendLog({ message: 'test' }, 'WARN', 'TestContext');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'LOG_SERVICE_URL is not defined',
      );

      loggerErrorSpy.mockRestore();
    });
  });
});

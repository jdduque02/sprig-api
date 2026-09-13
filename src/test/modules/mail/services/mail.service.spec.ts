import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import * as nodemailer from 'nodemailer';
import { EmailTemplate } from '@mail/entities/email-template.entity';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import {
  DEFAULT_OTP_SUBJECT,
  MailService,
  OTP_EMAIL_TEMPLATE_KEY,
} from '@mail/service/mail.service';

type TemplateProps = {
  name?: string;
  otpCode?: string;
  year?: string;
};

jest.mock('@react-email/render', () => ({
  render: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('@mail/templates/otp-password-reset', () => ({
  __esModule: true,
  default: (props: TemplateProps) => props,
}));

const mockRender = render as jest.MockedFunction<
  (element: TemplateProps) => Promise<string>
>;

const mockCreateTransport = nodemailer.createTransport as unknown as jest.Mock;

type MockTemplateRepo = {
  findOne: jest.Mock<any, any>;
  save: jest.Mock<any, any>;
  create: jest.Mock<any, any>;
};

type SendPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const mockTemplate = (html: string): EmailTemplate =>
  ({
    key: OTP_EMAIL_TEMPLATE_KEY,
    subject: DEFAULT_OTP_SUBJECT,
    html_body: html,
  }) as unknown as EmailTemplate;

describe('MailService', () => {
  let service: MailService;
  let templateRepo: MockTemplateRepo;
  let userRepository: { findAllActiveEmails: jest.Mock };

  const configMock = {
    get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    templateRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity: EmailTemplate) => Promise.resolve(entity)),
      create: jest.fn((entity: Partial<EmailTemplate>) => entity),
    };

    userRepository = {
      findAllActiveEmails: jest.fn().mockResolvedValue([]),
    };

    mockRender.mockImplementation((props: TemplateProps) =>
      Promise.resolve(
        `<html>OTP=${props.otpCode ?? ''}|NAME=${props.name ?? ''}|YEAR=${props.year ?? ''}</html>`,
      ),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configMock },
        { provide: getRepositoryToken(EmailTemplate), useValue: templateRepo },
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe('onApplicationBootstrap', () => {
    it('crea la plantilla por defecto con marcadores cuando no existe', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await service.onApplicationBootstrap();

      expect(mockRender).toHaveBeenCalledWith({
        name: '{{name}}',
        otpCode: '{{otp}}',
        year: '{{year}}',
      });
      const savedCall = (templateRepo.save.mock.calls[0] as EmailTemplate[])[0];
      expect(savedCall.html_body).toContain('{{otp}}');
      expect(savedCall.html_body).toContain('{{name}}');
      expect(savedCall.html_body).toContain('{{year}}');
    });

    it('repara una plantilla previa sin marcador {{otp}}', async () => {
      templateRepo.findOne.mockResolvedValue(
        mockTemplate('<html>codigo 123456</html>'),
      );

      await service.onApplicationBootstrap();

      const savedCall = (templateRepo.save.mock.calls[0] as EmailTemplate[])[0];
      expect(savedCall.html_body).toContain('{{otp}}');
    });

    it('no sobrescribe una plantilla que ya tiene el marcador {{otp}}', async () => {
      templateRepo.findOne.mockResolvedValue(
        mockTemplate('<html>{{otp}}</html>'),
      );

      await service.onApplicationBootstrap();

      expect(templateRepo.save).not.toHaveBeenCalled();
    });

    it('usa el asunto por defecto al reparar una plantilla sin asunto', async () => {
      templateRepo.findOne.mockResolvedValue({
        key: OTP_EMAIL_TEMPLATE_KEY,
        subject: null,
        html_body: '<html>codigo fijo 123456</html>',
      });

      await service.onApplicationBootstrap();

      const savedCall = (templateRepo.save.mock.calls[0] as EmailTemplate[])[0];
      expect(savedCall.subject).toBe(DEFAULT_OTP_SUBJECT);
      expect(savedCall.html_body).toContain('{{otp}}');
    });

    it('registra el error si falla la consulta de la plantilla', async () => {
      templateRepo.findOne.mockRejectedValue(new Error('db caído'));
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('sendOtp', () => {
    it('sustituye los marcadores de la plantilla personalizada por el código real', async () => {
      templateRepo.findOne.mockResolvedValue(
        mockTemplate('<html>otp={{otp}}|name={{name}}|year={{year}}</html>'),
      );
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      await service.sendOtp('user@test.com', '482913', 'juan');

      expect(mockRender).not.toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith({
        to: 'user@test.com',
        subject: DEFAULT_OTP_SUBJECT,
        html: '<html>otp=482913|name=juan|year=2026</html>',
        text: 'Su código de recuperación es 482913',
      });
    });

    it('usa la react-email con el código real cuando la plantilla no tiene {{otp}}', async () => {
      templateRepo.findOne.mockResolvedValue(
        mockTemplate('<html>codigo fijo 123456</html>'),
      );
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      await service.sendOtp('user@test.com', '135790', 'maria');

      expect(mockRender).toHaveBeenCalledWith({
        name: 'maria',
        otpCode: '135790',
        year: '2026',
      });
      expect(sendSpy).toHaveBeenCalledWith({
        to: 'user@test.com',
        subject: DEFAULT_OTP_SUBJECT,
        html: '<html>OTP=135790|NAME=maria|YEAR=2026</html>',
        text: 'Su código de recuperación es 135790',
      });
    });

    it('usa la react-email con el código real cuando no hay plantilla personalizada', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      await service.sendOtp('user@test.com', '246801');

      expect(mockRender).toHaveBeenCalledWith({
        name: undefined,
        otpCode: '246801',
        year: '2026',
      });
      expect(sendSpy).toHaveBeenCalledWith({
        to: 'user@test.com',
        subject: DEFAULT_OTP_SUBJECT,
        html: '<html>OTP=246801|NAME=|YEAR=2026</html>',
        text: 'Su código de recuperación es 246801',
      });
    });

    it('usa el asunto por defecto si la plantilla personalizada no tiene asunto', async () => {
      templateRepo.findOne.mockResolvedValue({
        key: OTP_EMAIL_TEMPLATE_KEY,
        subject: null,
        html_body: '<html>otp={{otp}}|name={{name}}|year={{year}}</html>',
      });
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      await service.sendOtp('user@test.com', '482913', 'juan');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: DEFAULT_OTP_SUBJECT,
          html: '<html>otp=482913|name=juan|year=2026</html>',
        }),
      );
    });

    it('deja el nombre vacío si la plantilla personalizada no recibe name', async () => {
      templateRepo.findOne.mockResolvedValue(
        mockTemplate('<html>otp={{otp}}|name={{name}}|year={{year}}</html>'),
      );
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      await service.sendOtp('user@test.com', '482913');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<html>otp=482913|name=|year=2026</html>',
        }),
      );
    });
  });

  describe('sendBroadcast', () => {
    it('guarda la plantilla y envía a todos los usuarios activos', async () => {
      userRepository.findAllActiveEmails.mockResolvedValue([
        { email: 'a@test.com', full_name: 'Ana' },
        { email: 'b@test.com', full_name: null },
      ]);
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockResolvedValue(undefined);

      const result = await service.sendBroadcast({
        subject: 'Novedades',
        html_body: '<p>Hola {{name}} — {{year}}</p>',
      });

      expect(templateRepo.save).toHaveBeenCalled();
      expect(result.recipients).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.key).toMatch(/^broadcast_/);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@test.com',
          subject: 'Novedades',
          html: expect.stringContaining('Ana') as string,
        }),
      );
    });

    it('cuenta fallos sin detener el envío al resto', async () => {
      userRepository.findAllActiveEmails.mockResolvedValue([
        { email: 'ok@test.com', full_name: 'Ok' },
        { email: 'fail@test.com', full_name: 'Fail' },
      ]);
      const sendSpy = jest
        .spyOn(
          service as unknown as { send: (p: SendPayload) => Promise<void> },
          'send',
        )
        .mockImplementation((p: SendPayload) => {
          if (p.to === 'fail@test.com') throw new Error('SMTP down');
        });

      const result = await service.sendBroadcast({
        subject: 'X',
        html_body: '<p>hi</p>',
      });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors?.[0]).toContain('fail@test.com');
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('send — correo deshabilitado', () => {
    it('registra el envío en logs cuando no hay transporter', async () => {
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await (
        service as unknown as { send: (p: SendPayload) => Promise<void> }
      ).send({
        to: 'user@test.com',
        subject: 'Asunto',
        html: '<p>otp</p>',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mail][mock]'),
      );
      logSpy.mockRestore();
    });
  });

  describe('MailService — transporter habilitado', () => {
    const buildEnabledService = async (
      extra: Record<string, unknown> = {},
    ): Promise<MailService> => {
      const configMock = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'MAIL_ENABLED') return 'true';
          if (key === 'MAIL_HOST') return 'smtp.test.com';
          if (key in extra) return extra[key];
          return defaultValue;
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: configMock },
          {
            provide: getRepositoryToken(EmailTemplate),
            useValue: templateRepo,
          },
          { provide: UserRepository, useValue: userRepository },
        ],
      }).compile();
      return module.get<MailService>(MailService);
    };

    it('crea el transporter con la configuración SMTP', async () => {
      const transporter = { sendMail: jest.fn() };
      mockCreateTransport.mockReturnValue(transporter);

      const svc = await buildEnabledService();

      expect(svc.enabled).toBe(true);
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 465,
        secure: true,
        auth: { user: '', pass: '' },
      });
    });

    it('deshabilita el correo si falta el host aunque MAIL_ENABLED sea true', async () => {
      const configMock = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'MAIL_ENABLED') return 'true';
          return defaultValue;
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: configMock },
          {
            provide: getRepositoryToken(EmailTemplate),
            useValue: templateRepo,
          },
          { provide: UserRepository, useValue: userRepository },
        ],
      }).compile();

      const svc = module.get<MailService>(MailService);

      expect(svc.enabled).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('envía con secure=false y el remitente personalizado', async () => {
      const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
      mockCreateTransport.mockReturnValue(transporter);

      const svc = await buildEnabledService({
        MAIL_SECURE: 'false',
        MAIL_FROM: 'x@test.com',
      });

      await (
        svc as unknown as { send: (p: SendPayload) => Promise<void> }
      ).send({ to: 'a@b.com', subject: 'S', html: '<p>hi</p>' });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false }),
      );
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'x@test.com',
          to: 'a@b.com',
          subject: 'S',
          html: '<p>hi</p>',
        }),
      );
    });

    it('usa el remitente por defecto si no hay MAIL_FROM', async () => {
      const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
      mockCreateTransport.mockReturnValue(transporter);

      const svc = await buildEnabledService();

      await (
        svc as unknown as { send: (p: SendPayload) => Promise<void> }
      ).send({ to: 'a@b.com', subject: 'S', html: '<p>hi</p>', text: 'txt' });

      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Sprig <no-reply@sprig.local>',
        }),
      );
    });

    it('envía el texto por defecto extrayendo el código del HTML', async () => {
      const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
      mockCreateTransport.mockReturnValue(transporter);

      const svc = await buildEnabledService();

      await (
        svc as unknown as { send: (p: SendPayload) => Promise<void> }
      ).send({ to: 'a@b.com', subject: 'S', html: 'código 482913 listo' });

      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Su código de recuperación es 482913',
        }),
      );
    });

    it('deja el texto por defecto vacío si el HTML no tiene código de 6 dígitos', async () => {
      const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
      mockCreateTransport.mockReturnValue(transporter);

      const svc = await buildEnabledService();

      await (
        svc as unknown as { send: (p: SendPayload) => Promise<void> }
      ).send({ to: 'a@b.com', subject: 'S', html: 'sin numeros aqui' });

      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Su código de recuperación es ',
        }),
      );
    });

    it('relanza el error si el envío por SMTP falla', async () => {
      const transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('smtp down')),
      };
      mockCreateTransport.mockReturnValue(transporter);
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      const svc = await buildEnabledService();

      await expect(
        (svc as unknown as { send: (p: SendPayload) => Promise<void> }).send({
          to: 'a@b.com',
          subject: 'S',
          html: '<p>hi</p>',
        }),
      ).rejects.toThrow('smtp down');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('envía un broadcast usando el transporte real', async () => {
      const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
      mockCreateTransport.mockReturnValue(transporter);
      userRepository.findAllActiveEmails.mockResolvedValue([
        { email: 'a@test.com', full_name: 'Ana' },
      ]);

      const svc = await buildEnabledService();

      const result = await svc.sendBroadcast({
        subject: 'Novedades',
        html_body: '<p>Hola {{name}}</p>',
      });

      expect(result.sent).toBe(1);
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@test.com',
          html: '<p>Hola Ana</p>',
        }),
      );
    });
  });
});

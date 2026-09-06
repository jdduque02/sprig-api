import { NotFoundException } from '@nestjs/common';
import { render } from '@react-email/render';
import { MailTemplateController } from '@mail/controller/mail-template.controller';
import { EmailTemplate } from '@mail/entities/email-template.entity';
import {
  DEFAULT_OTP_SUBJECT,
  OTP_EMAIL_TEMPLATE_KEY,
} from '@mail/service/mail.service';
import { UpdateEmailTemplateDto } from '@mail/dto/update-email-template.dto';

jest.mock('@react-email/render', () => ({
  render: jest.fn(),
}));

jest.mock('@mail/templates/otp-password-reset', () => ({
  __esModule: true,
  default: (props: unknown) => props,
}));

const mockRender = render as jest.MockedFunction<typeof render>;

const mockRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((e: Partial<EmailTemplate>) => e),
};

const mockI18n = { t: jest.fn((key: string) => key) };

describe('MailTemplateController', () => {
  let controller: MailTemplateController;

  beforeEach(() => {
    controller = new MailTemplateController(
      mockRepo as never,
      mockI18n as never,
    );
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('devuelve la plantilla almacenada si existe', async () => {
      mockRepo.findOne.mockResolvedValue({
        key: 'otp_password_reset',
        subject: 'Asunto custom',
        html_body: '<p>{{otp}}</p>',
        updated_at: new Date('2026-01-01'),
      });

      const result = await controller.findOne(OTP_EMAIL_TEMPLATE_KEY);
      expect(result.subject).toBe('Asunto custom');
      expect(result.html_body).toBe('<p>{{otp}}</p>');
    });

    it('devuelve la plantilla por defecto OTP cuando no hay almacenada', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRender.mockResolvedValue('<html>default</html>');

      const result = await controller.findOne(OTP_EMAIL_TEMPLATE_KEY);
      expect(result).toMatchObject({
        key: OTP_EMAIL_TEMPLATE_KEY,
        subject: DEFAULT_OTP_SUBJECT,
        html_body: '<html>default</html>',
        is_default: true,
      });
    });

    it('lanza NotFoundException si la key no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(controller.findOne('unknown_key')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('traduce el mensaje de error usando la clave mail.TEMPLATE_NOT_FOUND', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(controller.findOne('unknown_key')).rejects.toThrow();
      expect(mockI18n.t).toHaveBeenCalledWith('mail.TEMPLATE_NOT_FOUND', {
        args: { key: 'unknown_key' },
      });
    });
  });

  describe('upsert', () => {
    const dto: UpdateEmailTemplateDto = {
      subject: 'Nuevo asunto',
      html_body: '<p>hola {{name}}</p>',
    };

    it('actualiza una plantilla existente', async () => {
      const existing = {
        key: 'k1',
        subject: 'old',
        html_body: 'old',
        updated_at: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((e: EmailTemplate) => e);

      const result = await controller.upsert('k1', dto);
      expect(existing.subject).toBe(dto.subject);
      expect(existing.html_body).toBe(dto.html_body);
      expect(result.subject).toBe(dto.subject);
    });

    it('crea una plantilla nueva si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.save.mockImplementation((e: EmailTemplate) => ({
        ...e,
        updated_at: new Date(),
      }));

      const result = await controller.upsert('new_key', dto);
      expect(mockRepo.create).toHaveBeenCalledWith({
        key: 'new_key',
        subject: dto.subject,
        html_body: dto.html_body,
      });
      expect(result.key).toBe('new_key');
    });
  });
});

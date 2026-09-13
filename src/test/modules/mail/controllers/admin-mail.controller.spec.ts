import { AdminMailController } from '@mail/controller/admin-mail.controller';
import { MailService } from '@mail/service/mail.service';
import { BroadcastEmailDto } from '@mail/dto/broadcast-email.dto';

const mockMailService = {
  sendBroadcast: jest.fn(),
};

describe('AdminMailController', () => {
  let controller: AdminMailController;

  beforeEach(() => {
    controller = new AdminMailController(
      mockMailService as unknown as MailService,
    );
    jest.clearAllMocks();
  });

  it('debe enviar un broadcast delegando al servicio', async () => {
    const dto: BroadcastEmailDto = {
      subject: 'Novedades',
      html_body: '<p>Hola</p>',
    };
    const response = {
      key: 'broadcast_1',
      subject: dto.subject,
      recipients: 3,
      sent: 3,
      failed: 0,
    };
    mockMailService.sendBroadcast.mockResolvedValue(response);

    const result = await controller.broadcast(dto);
    expect(mockMailService.sendBroadcast).toHaveBeenCalledWith(dto);
    expect(result).toEqual(response);
  });
});

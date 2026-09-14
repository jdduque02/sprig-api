import { Test, TestingModule } from '@nestjs/testing';
import { AdminMailController } from '@mail/controller/admin-mail.controller';
import { MailService } from '@mail/service/mail.service';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';

describe('AdminMailController', () => {
  let controller: AdminMailController;

  const mockMailService = {
    sendBroadcast: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMailController],
      providers: [{ provide: MailService, useValue: mockMailService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminMailController>(AdminMailController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('broadcast', () => {
    it('delega a mailService.sendBroadcast', async () => {
      const dto = {
        subject: 'Test Subject',
        html_body: 'Test Body',
      };
      const expected = { success: true, sent: 1 };
      mockMailService.sendBroadcast.mockResolvedValue(expected);
      const result = await controller.broadcast(dto);
      expect(mockMailService.sendBroadcast).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});

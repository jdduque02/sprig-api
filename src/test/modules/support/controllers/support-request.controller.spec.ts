import { SupportRequestController } from '@support/controller/support-request.controller';
import { SupportRequestService } from '@support/service/support-request.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const currentUser = { userId: 10 };

describe('SupportRequestController', () => {
  let controller: SupportRequestController;

  beforeEach(() => {
    controller = new SupportRequestController(
      mockService as unknown as SupportRequestService,
    );
    jest.clearAllMocks();
  });

  it('create usa el userId del usuario actual', async () => {
    const dto = { subject: 'Ayuda' };
    mockService.create.mockResolvedValue({ id: 1 });
    await controller.create(currentUser as never, dto as never);
    expect(mockService.create).toHaveBeenCalledWith(10, dto);
  });

  it('findAll lista las solicitudes del usuario', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll(currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10);
  });

  it('findOne busca por id y userId', async () => {
    mockService.findOne.mockResolvedValue({ id: 2 });
    await controller.findOne(currentUser as never, 2);
    expect(mockService.findOne).toHaveBeenCalledWith(2, 10);
  });

  it('remove elimina la solicitud del usuario', async () => {
    await controller.remove(currentUser as never, 4);
    expect(mockService.remove).toHaveBeenCalledWith(4, 10);
  });
});

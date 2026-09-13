import { AdminSupportRequestController } from '@support/controller/admin-support-request.controller';
import { SupportRequestService } from '@support/service/support-request.service';

const mockService = {
  findAllAdmin: jest.fn(),
  updateAdmin: jest.fn(),
};

describe('AdminSupportRequestController', () => {
  let controller: AdminSupportRequestController;

  beforeEach(() => {
    controller = new AdminSupportRequestController(
      mockService as unknown as SupportRequestService,
    );
    jest.clearAllMocks();
  });

  it('findAll lista todas las solicitudes', async () => {
    const list = [{ id: 1 }];
    mockService.findAllAdmin.mockResolvedValue(list);
    await expect(controller.findAll()).resolves.toEqual(list);
  });

  it('update actualiza con id y dto', async () => {
    const dto = { status: 'RESOLVED' };
    mockService.updateAdmin.mockResolvedValue({ id: 9, ...dto });
    await expect(controller.update(9, dto as never)).resolves.toMatchObject(
      dto,
    );
    expect(mockService.updateAdmin).toHaveBeenCalledWith(9, dto);
  });
});

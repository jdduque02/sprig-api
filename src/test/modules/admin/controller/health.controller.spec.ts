import { HealthController } from '@admin/controller/health.controller';
import { HealthService } from '@admin/service/health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const mockHealthService = {
    check: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(
      mockHealthService as unknown as HealthService,
    );
  });

  it('debe delegar en HealthService.check', async () => {
    const payload = { status: 'ok', info: {}, error: {}, details: {} };
    mockHealthService.check.mockResolvedValue(payload);

    const result = await controller.check();

    expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload);
  });
});

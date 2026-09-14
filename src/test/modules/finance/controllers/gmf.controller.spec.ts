import { GmfController } from '@finance/controller/gmf.controller';
import { GmfService } from '@finance/service/gmf.service';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockGmfService = {
  getSummary: jest.fn(),
};

const currentUser: IntrospectResponse = { active: true, sub: 'kc-uuid' };

describe('GmfController', () => {
  let controller: GmfController;

  beforeEach(() => {
    controller = new GmfController(mockGmfService as unknown as GmfService);
    jest.clearAllMocks();
  });

  it('delega el cálculo del resumen de GMF al servicio', async () => {
    const summary = {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
      gmf_rate: 0.004,
      total_debited_amount: 1000000,
      total_gmf_paid: 4000,
      estimated_savings_if_exempt: 4000,
      by_account: [],
    };
    mockGmfService.getSummary.mockResolvedValue(summary);

    const result = await controller.getSummary(
      10,
      { date_from: '2026-01-01', date_to: '2026-01-31' },
      currentUser,
    );

    expect(mockGmfService.getSummary).toHaveBeenCalledWith(10, {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    });
    expect(result).toEqual(summary);
  });
});

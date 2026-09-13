import { CashArqueoService } from '@finance/service/cash-arqueo.service';
import { CashArqueoRepository } from '@finance/repositories/cash-arqueo.repository';

const mockRepo = {
  create: jest.fn(),
  getReconciliation: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  softDelete: jest.fn(),
};

describe('CashArqueoService', () => {
  let service: CashArqueoService;

  beforeEach(() => {
    service = new CashArqueoService(
      mockRepo as unknown as CashArqueoRepository,
    );
    jest.clearAllMocks();
  });

  it('create resuelve el mes y pasa la reconciliación', async () => {
    const reconciliation = { expected_amount: 50000 };
    mockRepo.getReconciliation.mockResolvedValue(reconciliation);
    mockRepo.create.mockResolvedValue({ id: 1 });
    const dto = { arqueo_date: '2026-08-15', counted_amount: 50000 };
    await service.create(10, dto);
    expect(mockRepo.getReconciliation).toHaveBeenCalledWith(10, '2026-08');
    expect(mockRepo.create).toHaveBeenCalledWith(10, dto, reconciliation);
  });

  it('create usa el mes actual si no hay fecha', async () => {
    mockRepo.getReconciliation.mockResolvedValue({ expected_amount: 0 });
    mockRepo.create.mockResolvedValue({ id: 2 });
    const now = new Date().toISOString().slice(0, 7);
    await service.create(10, {} as never);
    expect(mockRepo.getReconciliation).toHaveBeenCalledWith(10, now);
  });

  it('getReconciliation delega', async () => {
    mockRepo.getReconciliation.mockResolvedValue({ expected_amount: 0 });
    await service.getReconciliation(10, '2026-08');
    expect(mockRepo.getReconciliation).toHaveBeenCalledWith(10, '2026-08');
  });

  it('findAll delega', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    await service.findAll(10);
    expect(mockRepo.findAll).toHaveBeenCalledWith(10);
  });

  it('findOne delega', async () => {
    mockRepo.findById.mockResolvedValue({ id: 3 });
    await service.findOne(3, 10);
    expect(mockRepo.findById).toHaveBeenCalledWith(3, 10);
  });

  it('remove delega', async () => {
    await service.remove(3, 10);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(3, 10);
  });
});

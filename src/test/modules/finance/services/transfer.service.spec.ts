import { TransferService } from '@finance/service/transfer.service';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';

const mockRepo = {
  createTransfer: jest.fn(),
  findTransfers: jest.fn(),
  findTransferById: jest.fn(),
  updateTransfer: jest.fn(),
  softDeleteTransfer: jest.fn(),
  cloneTransfer: jest.fn(),
};

const buildRecord = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    transfer_group_id: 'grp-1',
    origin_account_id: 100,
    destination_account_id: null,
    source_bank: 'Banco A',
    source_account: 'AHORROS',
    destination_bank: null,
    destination_account: null,
    amount: '50000',
    transaction_date: '2026-08-01',
    description: 'Transferencia',
    reference_code: 'REF-1',
    objective_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as never;

describe('TransferService', () => {
  let service: TransferService;

  beforeEach(() => {
    service = new TransferService(
      mockRepo as unknown as TransactionRecordRepository,
    );
    jest.clearAllMocks();
  });

  it('create delega y mapea la respuesta', async () => {
    mockRepo.createTransfer.mockResolvedValue([
      buildRecord(),
      buildRecord({
        id: 2,
        origin_account_id: null,
        destination_account_id: 200,
        destination_bank: 'Banco B',
        destination_account: 'CORRIENTE',
      }),
    ]);
    const result = await service.create(10, {} as never);
    expect(result.transfer_group_id).toBe('grp-1');
    expect(result.amount).toBe(50000);
    expect(result.source.id).toBe(1);
    expect(result.destination.id).toBe(2);
  });

  it('findAll agrupa los pares por transfer_group_id', async () => {
    mockRepo.findTransfers.mockResolvedValue({
      data: [
        buildRecord(),
        buildRecord({ id: 2 }),
        buildRecord({ id: 3, transfer_group_id: 'grp-2' }),
      ],
      total: 3,
    });
    const result = await service.findAll(10);
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].transfer_group_id).toBe('grp-1');
    expect(result.data[1].transfer_group_id).toBe('grp-2');
  });

  it('findAll agrupa registros sin grupo por id propio', async () => {
    mockRepo.findTransfers.mockResolvedValue({
      data: [
        buildRecord({ id: 1, transfer_group_id: null }),
        buildRecord({ id: 2, transfer_group_id: null }),
      ],
      total: 2,
    });
    const result = await service.findAll(10);
    expect(result.data).toHaveLength(2);
  });

  it('findOne delega y mapea', async () => {
    mockRepo.findTransferById.mockResolvedValue([
      buildRecord(),
      buildRecord({ id: 2 }),
    ]);
    const result = await service.findOne(1, 10);
    expect(result.source.id).toBe(1);
    expect(mockRepo.findTransferById).toHaveBeenCalledWith(1, 10);
  });

  it('update delega con id, userId y dto', async () => {
    const dto = { amount: 70000 };
    mockRepo.updateTransfer.mockResolvedValue([
      buildRecord({ amount: '70000' }),
      buildRecord({ id: 2, amount: '70000' }),
    ]);
    await service.update(1, 10, dto);
    expect(mockRepo.updateTransfer).toHaveBeenCalledWith(1, 10, dto);
  });

  it('clone delega con id, userId y dto, y mapea la respuesta', async () => {
    const dto = { amount: 90000 };
    mockRepo.cloneTransfer.mockResolvedValue([
      buildRecord({ id: 9, amount: '90000' }),
      buildRecord({
        id: 10,
        amount: '90000',
        origin_account_id: null,
        destination_account_id: 200,
      }),
    ]);

    const result = await service.clone(1, 10, dto);

    expect(mockRepo.cloneTransfer).toHaveBeenCalledWith(1, 10, dto);
    expect(result.source.id).toBe(9);
    expect(result.destination.id).toBe(10);
  });

  it('remove hace soft delete de la transferencia', async () => {
    await service.remove(1, 10);
    expect(mockRepo.softDeleteTransfer).toHaveBeenCalledWith(1, 10);
  });

  it('toResponseDto usa fallback cuando no hay origen/destino', async () => {
    mockRepo.createTransfer.mockResolvedValue([
      buildRecord({ origin_account_id: null, destination_account_id: null }),
    ]);
    const result = await service.create(10, {} as never);
    expect(result.source.id).toBe(1);
    expect(result.destination.id).toBe(1);
    expect(result.objective_id).toBeNull();
  });

  it('toResponseDto maneja campos nulos en ambos lados', async () => {
    mockRepo.createTransfer.mockResolvedValue([
      buildRecord({
        source_bank: null,
        source_account: null,
        amount: undefined,
        description: undefined,
        reference_code: undefined,
      }),
      buildRecord({
        id: 2,
        destination_account_id: 200,
        destination_bank: null,
        destination_account: null,
        amount: undefined,
        description: undefined,
        reference_code: undefined,
      }),
    ]);
    const result = await service.create(10, {} as never);
    expect(result.amount).toBe(0);
    expect(result.description).toBeNull();
    expect(result.reference_code).toBeNull();
    expect(result.source.bank_name).toBeNull();
    expect(result.source.account_type).toBeNull();
    expect(result.source.amount).toBe(0);
    expect(result.source.description).toBeNull();
    expect(result.source.reference_code).toBeNull();
    expect(result.destination.bank_name).toBeNull();
    expect(result.destination.account_type).toBeNull();
    expect(result.destination.objective_id).toBeNull();
  });
});

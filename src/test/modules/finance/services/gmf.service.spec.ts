import { Test, TestingModule } from '@nestjs/testing';
import { GmfService } from '@finance/service/gmf.service';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { BankAccountService } from '@banking/service/bank-account.service';

const mockTransactionRecordRepository = {
  getDebitTotalsByAccount: jest.fn(),
};

const mockBankAccountService = {
  findOptional: jest.fn(),
};

describe('GmfService', () => {
  let service: GmfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmfService,
        {
          provide: TransactionRecordRepository,
          useValue: mockTransactionRecordRepository,
        },
        { provide: BankAccountService, useValue: mockBankAccountService },
      ],
    }).compile();

    service = module.get<GmfService>(GmfService);
    jest.clearAllMocks();
  });

  it('calcula el GMF sobre cuentas no exentas y lo omite en cuentas exentas', async () => {
    mockTransactionRecordRepository.getDebitTotalsByAccount.mockResolvedValue([
      { account_id: 1, amount: '1000000' },
      { account_id: 2, amount: '500000' },
    ]);
    mockBankAccountService.findOptional
      .mockResolvedValueOnce({ bank_name: 'Bancolombia', exempt_4x1000: false })
      .mockResolvedValueOnce({ bank_name: 'Nequi', exempt_4x1000: true });

    const result = await service.getSummary(10, {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    });

    expect(result.total_debited_amount).toBe(1500000);
    expect(result.total_gmf_paid).toBe(4000);
    expect(result.estimated_savings_if_exempt).toBe(4000);
    expect(result.by_account).toHaveLength(2);
    const nonExempt = result.by_account.find((a) => a.account_id === 1);
    const exempt = result.by_account.find((a) => a.account_id === 2);
    expect(nonExempt?.gmf_paid).toBe(4000);
    expect(exempt?.gmf_paid).toBe(0);
    expect(exempt?.exempt_4x1000).toBe(true);
  });

  it('ignora filas sin account_id y trata cuentas no encontradas como no exentas', async () => {
    mockTransactionRecordRepository.getDebitTotalsByAccount.mockResolvedValue([
      { account_id: null, amount: '100000' },
      { account_id: 3, amount: '0' },
      { account_id: 4, amount: '200000' },
    ]);
    mockBankAccountService.findOptional.mockResolvedValueOnce(null);

    const result = await service.getSummary(10, {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    });

    expect(result.by_account).toHaveLength(1);
    expect(result.by_account[0].account_id).toBe(4);
    expect(result.by_account[0].exempt_4x1000).toBe(false);
    expect(result.by_account[0].gmf_paid).toBe(800);
  });

  it('devuelve totales en cero cuando no hay débitos en el periodo', async () => {
    mockTransactionRecordRepository.getDebitTotalsByAccount.mockResolvedValue(
      [],
    );

    const result = await service.getSummary(10, {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    });

    expect(result.total_debited_amount).toBe(0);
    expect(result.total_gmf_paid).toBe(0);
    expect(result.estimated_savings_if_exempt).toBe(0);
    expect(result.by_account).toHaveLength(0);
  });
});

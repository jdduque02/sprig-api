import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { BankAccountService } from '@banking/service/bank-account.service';
import { GmfSummaryQueryDto } from '@finance/dto/gmf/gmf-summary-query.dto';
import {
  GmfAccountBreakdownDto,
  GmfSummaryResponseDto,
} from '@finance/dto/gmf/gmf-summary-response.dto';
import { GMF_RATE } from '@shared/constants/gmf.constant';

const DAY_MS = 24 * 60 * 60 * 1000;
// Ventana de seguridad para acotar `created_at` sin excluir movimientos
// legítimos que fueron registrados/importados mucho después de su
// `transaction_date` de negocio (extractos bancarios retroactivos).
const CREATED_AT_FLOOR_DAYS = 3 * 365;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula el Gravamen a los Movimientos Financieros (GMF / "4x1000") sobre
 * los débitos (gastos/inversiones/transferencias salientes) realizados en
 * cuentas bancarias no exentas (`exempt_4x1000 = false`). Vive en `finance`
 * porque es analítica derivada de `transaction_record` (dueño de este
 * módulo); resuelve la exención por cuenta inyectando `BankAccountService`
 * de `banking` (nunca su repositorio).
 */
@Injectable()
export class GmfService {
  private readonly logger = new Logger(GmfService.name);

  constructor(
    private readonly transactionRecordRepository: TransactionRecordRepository,
    private readonly bankAccountService: BankAccountService,
  ) {}

  async getSummary(
    userId: number,
    query: GmfSummaryQueryDto,
  ): Promise<GmfSummaryResponseDto> {
    const { date_from, date_to } = query;
    const createdSince = new Date(
      new Date(date_from).getTime() - CREATED_AT_FLOOR_DAYS * DAY_MS,
    );

    const totalsByAccount =
      await this.transactionRecordRepository.getDebitTotalsByAccount(
        userId,
        date_from,
        date_to,
        createdSince,
      );

    const byAccount: GmfAccountBreakdownDto[] = [];
    let totalDebited = 0;
    let totalGmf = 0;

    for (const row of totalsByAccount) {
      const accountId = Number(row.account_id);
      if (!accountId) continue;
      const debitedAmount = Number(row.amount ?? 0);
      if (debitedAmount <= 0) continue;

      const account = await this.bankAccountService.findOptional(
        accountId,
        userId,
      );
      const exempt = account?.exempt_4x1000 ?? false;
      const gmfPaid = exempt ? 0 : round2(debitedAmount * GMF_RATE);

      totalDebited += debitedAmount;
      totalGmf += gmfPaid;

      byAccount.push({
        account_id: accountId,
        bank_name: account?.bank_name ?? null,
        exempt_4x1000: exempt,
        debited_amount: round2(debitedAmount),
        gmf_paid: gmfPaid,
      });
    }

    this.logger.log(
      `Resumen GMF calculado para usuario ID: ${userId} (${date_from} - ${date_to})`,
    );

    return {
      date_from,
      date_to,
      gmf_rate: GMF_RATE,
      total_debited_amount: round2(totalDebited),
      total_gmf_paid: round2(totalGmf),
      // El ahorro estimado equivale al GMF pagado: si esas mismas
      // transacciones se hubieran hecho desde una cuenta exenta, el GMF
      // habría sido $0.
      estimated_savings_if_exempt: round2(totalGmf),
      by_account: byAccount,
    };
  }
}

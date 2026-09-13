import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import {
  CashArqueo,
  CashArqueoStatusEnum,
} from '@finance/entities/cash-arqueo.entity';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CreateCashArqueoDto } from '@finance/dto/cash-arqueo/create-cash-arqueo.dto';
import { CashReconciliationDto } from '@finance/dto/cash-arqueo/cash-arqueo-response.dto';
import { TransactionTypeEnum } from '@shared/enums';

interface ReconciliationRow {
  transaction_date: string | Date;
  amount: string;
  description: string;
  type: TransactionTypeEnum;
  source: string | null;
}

@Injectable()
export class CashArqueoRepository {
  constructor(
    @InjectRepository(CashArqueo)
    private readonly repo: Repository<CashArqueo>,
    @InjectRepository(TransactionRecord)
    private readonly transactionRepo: Repository<TransactionRecord>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateCashArqueoDto,
    reconciliation: CashReconciliationDto,
  ): Promise<CashArqueo> {
    const countedAmount = Number(dto.counted_amount ?? 0);
    const expectedAmount =
      dto.expected_amount !== undefined
        ? Number(dto.expected_amount)
        : reconciliation.expected_amount;
    const difference = countedAmount - expectedAmount;
    const status =
      Math.abs(difference) < 0.005
        ? CashArqueoStatusEnum.BALANCED
        : CashArqueoStatusEnum.UNBALANCED;

    const entity = this.repo.create({
      user_id: userId,
      arqueo_date: (dto.arqueo_date ??
        new Date().toISOString().slice(0, 10)) as unknown as Date,
      counted_amount: countedAmount,
      expected_amount: expectedAmount,
      difference,
      status,
      observations: dto.observations ?? null,
      reconciliation: reconciliation as unknown as Record<string, unknown>,
    });
    return this.repo.save(entity);
  }

  async findAll(userId: number): Promise<CashArqueo[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { arqueo_date: 'DESC' },
    });
  }

  async findById(id: number, userId: number): Promise<CashArqueo> {
    const entity = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!entity)
      throw new NotFoundException(
        this.i18n.t('finance.CASH_ARQUEO_NOT_FOUND', { args: { id } }),
      );
    return entity;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const entity = await this.findById(id, userId);
    await this.repo.softRemove(entity);
  }

  /**
   * Conciliación del mes: contrasta los registros/suscripciones del aplicativo
   * (source = manual) con los movimientos provenientes de los extractos
   * cargados (source = import). Incluye created_at para partition pruning.
   */
  async getReconciliation(
    userId: number,
    month: string,
  ): Promise<CashReconciliationDto> {
    const [year, monthNum] = month.split('-').map(Number);
    if (
      Number.isNaN(year) ||
      Number.isNaN(monthNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      throw new NotFoundException(
        this.i18n.t('finance.CASH_ARQUEO_INVALID_MONTH'),
      );
    }
    const start = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const nextMonthStart = new Date(Date.UTC(year, monthNum, 1));
    const nextStart = nextMonthStart.toISOString().slice(0, 10);

    const rows = await this.transactionRepo
      .createQueryBuilder('tr')
      .select('tr.transaction_date', 'transaction_date')
      .addSelect('tr.amount', 'amount')
      .addSelect('tr.description', 'description')
      .addSelect('tr.type', 'type')
      .addSelect('tr.source', 'source')
      .where('tr.user_id = :userId', { userId })
      .andWhere('tr.deleted_at IS NULL')
      .andWhere('tr.created_at >= :from', { from: `${start}T00:00:00Z` })
      .andWhere('tr.transaction_date >= :start', { start })
      .andWhere('tr.transaction_date < :nextStart', { nextStart })
      .getRawMany<ReconciliationRow>();

    const totals = () => ({
      count: 0,
      income: 0,
      expense: 0,
      net: 0,
    });

    const app = totals();
    const extract = totals();
    const appFp = new Map<string, ReconciliationRow>();
    const extractFp = new Map<string, ReconciliationRow>();

    for (const row of rows) {
      const type = row.type;
      if (type === TransactionTypeEnum.TRANSFER) continue;
      const amount = Number(row.amount ?? 0);
      const isIncome = type === TransactionTypeEnum.INCOME;
      const bucket = row.source === 'import' ? extract : app;
      bucket.count++;
      if (isIncome) bucket.income += amount;
      else bucket.expense += amount;

      const date = String(row.transaction_date).slice(0, 10);
      const fp = TransactionRecordRepository.fingerprint(
        date,
        amount,
        String(row.description ?? ''),
      );
      const target = row.source === 'import' ? extractFp : appFp;
      if (!target.has(fp)) target.set(fp, { ...row, transaction_date: date });
    }

    app.net = app.income - app.expense;
    extract.net = extract.income - extract.expense;

    let matchedCount = 0;
    let matchedAmount = 0;
    let appOnlyCount = 0;
    let appOnlyAmount = 0;
    let extractOnlyCount = 0;
    let extractOnlyAmount = 0;

    for (const [fp, row] of appFp) {
      const amount = Number(row.amount ?? 0);
      if (extractFp.has(fp)) {
        matchedCount++;
        matchedAmount += amount;
      } else {
        appOnlyCount++;
        appOnlyAmount += amount;
      }
    }
    for (const [fp, row] of extractFp) {
      if (!appFp.has(fp)) {
        extractOnlyCount++;
        extractOnlyAmount += Number(row.amount ?? 0);
      }
    }

    const expected_amount = extract.count > 0 ? extract.net : app.net;

    return {
      month,
      app,
      extract,
      matched: { count: matchedCount, amount: matchedAmount },
      app_only: { count: appOnlyCount, amount: appOnlyAmount },
      extract_only: { count: extractOnlyCount, amount: extractOnlyAmount },
      expected_amount,
    };
  }
}

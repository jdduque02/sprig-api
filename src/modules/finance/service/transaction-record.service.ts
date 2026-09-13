import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { TransactionSummaryQueryDto } from '@finance/dto/transaction-record/transaction-summary-query.dto';
import { CloneTransactionDto } from '@finance/dto/transaction-record/clone-transaction.dto';
import {
  nextOccurrence,
  startOfDay,
} from '@finance/service/fixed-reminder.scheduler';
import { UpcomingPaymentDto } from '@finance/dto/transaction-record/upcoming-payment.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_WINDOW_DAYS = 370 * 10; // cubre suscripciones anuales antiguas
const SUMMARY_TTL_MS = 45_000;

@Injectable()
export class TransactionRecordService {
  private readonly logger = new Logger(TransactionRecordService.name);

  constructor(
    private readonly transactionRecordRepository: TransactionRecordRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private summaryKey(userId: number, query: TransactionSummaryQueryDto) {
    return `tx:summary:${userId}:${query.date_from ?? ''}:${query.date_to ?? ''}:${query.group_by ?? 'day'}:${query.type ?? ''}`;
  }

  private async invalidateSummary(userId: number) {
    // Best-effort: drop common key prefixes by storing a generation counter
    const genKey = `tx:summary:gen:${userId}`;
    const gen = (await this.cacheManager.get<number>(genKey)) ?? 0;
    await this.cacheManager.set(genKey, gen + 1, 86_400_000);
  }

  private async summaryGen(userId: number) {
    return (
      (await this.cacheManager.get<number>(`tx:summary:gen:${userId}`)) ?? 0
    );
  }

  async create(userId: number, dto: CreateTransactionRecordDto) {
    const created = await this.transactionRecordRepository.create(userId, dto);
    await this.invalidateSummary(userId);
    return created;
  }

  async findAll(userId: number, query: TransactionRecordQueryDto) {
    return this.transactionRecordRepository.findAll(userId, query);
  }

  async getSummary(userId: number, query: TransactionSummaryQueryDto) {
    const gen = await this.summaryGen(userId);
    const cacheKey = `${this.summaryKey(userId, query)}:g${gen}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
    const summary = await this.transactionRecordRepository.getSummary(
      userId,
      query,
    );
    // TTL jitter anti-stampede (±15%)
    const jitter = Math.floor(SUMMARY_TTL_MS * (0.85 + Math.random() * 0.3));
    await this.cacheManager.set(cacheKey, summary, jitter);
    return summary;
  }

  async findOne(id: number, userId: number) {
    return this.transactionRecordRepository.findById(id, userId);
  }

  async update(id: number, userId: number, dto: UpdateTransactionRecordDto) {
    const updated = await this.transactionRecordRepository.update(
      id,
      userId,
      dto,
    );
    await this.invalidateSummary(userId);
    return updated;
  }

  async remove(id: number, userId: number) {
    const result = await this.transactionRecordRepository.softDelete(
      id,
      userId,
    );
    await this.invalidateSummary(userId);
    return result;
  }

  async removeMany(ids: number[], userId: number) {
    const result = await this.transactionRecordRepository.softDeleteMany(
      ids,
      userId,
    );
    await this.invalidateSummary(userId);
    return result;
  }

  async clone(id: number, userId: number, dto: CloneTransactionDto) {
    const cloned = await this.transactionRecordRepository.clone(
      id,
      userId,
      dto,
    );
    await this.invalidateSummary(userId);
    return cloned;
  }

  /**
   * Próximos pagos de suscripciones (deducciones fijas) del usuario:
   * calcula la siguiente fecha de pago y los días restantes para cada una.
   */
  async getUpcomingPayments(userId: number): Promise<UpcomingPaymentDto[]> {
    const today = startOfDay(new Date());
    const from = new Date(today.getTime() - SUBSCRIPTION_WINDOW_DAYS * DAY_MS);
    const subscriptions =
      await this.transactionRecordRepository.findUpcomingSubscriptions(
        userId,
        from,
      );

    const upcoming: UpcomingPaymentDto[] = [];
    for (const tx of subscriptions) {
      const next = nextOccurrence(tx, today);
      if (!next) continue;
      upcoming.push({
        id: tx.id,
        description: tx.description ?? null,
        amount: Number(tx.amount ?? 0),
        payment_method: tx.payment_method ?? null,
        frequency: tx.frequency ?? null,
        due_day: tx.due_day ?? null,
        reminder_days: tx.reminder_days ?? null,
        next_payment_date: next.toISOString().slice(0, 10),
        days_remaining: Math.floor((next.getTime() - today.getTime()) / DAY_MS),
      });
    }
    upcoming.sort((a, b) =>
      a.next_payment_date.localeCompare(b.next_payment_date),
    );

    return upcoming;
  }
}

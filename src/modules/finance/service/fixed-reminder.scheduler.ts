import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import {
  FixedTypeEnum,
  FrequencyEnum,
  TransactionTypeEnum,
} from '@shared/enums';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { NotificationService } from '@notification/service/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function nextMonthlyOccurrence(dueDay: number, today: Date): Date {
  const current = startOfDay(today);
  const candidate = new Date(
    current.getFullYear(),
    current.getMonth(),
    clampDay(current.getFullYear(), current.getMonth(), dueDay),
  );
  if (candidate.getTime() < current.getTime()) {
    const nextMonth = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      1,
    );
    return new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay),
    );
  }
  return candidate;
}

export function nextBiweeklyOccurrence(
  dueDay: number | null,
  createdDate: Date,
  today: Date,
): Date {
  const anchor =
    dueDay != null
      ? new Date(
          createdDate.getFullYear(),
          createdDate.getMonth(),
          clampDay(createdDate.getFullYear(), createdDate.getMonth(), dueDay),
        )
      : startOfDay(createdDate);
  const current = startOfDay(today);
  const elapsed = Math.floor((current.getTime() - anchor.getTime()) / DAY_MS);
  const offset = ((elapsed % 14) + 14) % 14;
  if (offset === 0) return current;
  return new Date(current.getTime() + (14 - offset) * DAY_MS);
}

export function nextWeeklyOccurrence(createdDate: Date, today: Date): Date {
  const current = startOfDay(today);
  const anchor = startOfDay(createdDate);
  const elapsed = Math.floor((current.getTime() - anchor.getTime()) / DAY_MS);
  const offset = ((elapsed % 7) + 7) % 7;
  if (offset === 0) return current;
  return new Date(current.getTime() + (7 - offset) * DAY_MS);
}

function addMonthsClamped(date: Date, months: number, day: number): Date {
  const total = date.getFullYear() * 12 + date.getMonth() + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return new Date(y, m, clampDay(y, m, day));
}

export function nextQuarterlyOccurrence(
  dueDay: number,
  createdDate: Date,
  today: Date,
): Date {
  const current = startOfDay(today);
  let candidate = addMonthsClamped(startOfDay(createdDate), 0, dueDay);
  while (candidate.getTime() < current.getTime()) {
    candidate = addMonthsClamped(candidate, 3, dueDay);
  }
  return candidate;
}

export function nextYearlyOccurrence(
  dueDay: number,
  createdDate: Date,
  today: Date,
): Date {
  const current = startOfDay(today);
  let candidate = addMonthsClamped(startOfDay(createdDate), 0, dueDay);
  while (candidate.getTime() < current.getTime()) {
    candidate = addMonthsClamped(candidate, 12, dueDay);
  }
  return candidate;
}

export function nextOccurrence(
  tx: Pick<TransactionRecord, 'frequency' | 'due_day' | 'created_at'>,
  today: Date,
): Date | null {
  if (tx.frequency === FrequencyEnum.DAILY) return startOfDay(today);
  if (tx.due_day == null) return null;
  switch (tx.frequency) {
    case FrequencyEnum.WEEKLY:
      return nextWeeklyOccurrence(tx.created_at, today);
    case FrequencyEnum.BIWEEKLY:
      return nextBiweeklyOccurrence(tx.due_day, tx.created_at, today);
    case FrequencyEnum.QUARTERLY:
      return nextQuarterlyOccurrence(tx.due_day, tx.created_at, today);
    case FrequencyEnum.YEARLY:
      return nextYearlyOccurrence(tx.due_day, tx.created_at, today);
    case FrequencyEnum.MONTHLY:
    default:
      return nextMonthlyOccurrence(tx.due_day, today);
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'transferencia bancaria',
  cash: 'efectivo',
  debit_card: 'tarjeta débito',
  credit_card: 'tarjeta crédito',
  digital_wallet: 'billetera digital',
  mobile_payment: 'pago móvil',
  check: 'cheque',
  crypto: 'cripto',
};

function fmtAmount(amount: number): string {
  return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount)}`;
}

@Injectable()
export class FixedReminderScheduler {
  private readonly logger = new Logger(FixedReminderScheduler.name);

  constructor(
    private readonly transactionRecordRepository: TransactionRecordRepository,
    private readonly notificationService: NotificationService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'fixed-reminders' })
  async handleDailyReminders(): Promise<void> {
    const today = startOfDay(new Date());
    const from = new Date(today.getTime() - 370 * DAY_MS);

    let transactions: TransactionRecord[];
    try {
      transactions =
        await this.transactionRecordRepository.findFixedForReminders(from);
    } catch (error) {
      this.logger.error(
        'Error al consultar transacciones fijas para recordatorios',
        error,
      );
      return;
    }

    for (const tx of transactions) {
      const next = nextOccurrence(tx, today);
      if (!next) continue;

      const reminderDays = tx.reminder_days ?? 3;
      const diffDays = Math.floor((next.getTime() - today.getTime()) / DAY_MS);
      if (diffDays < 0 || diffDays > reminderDays) continue;

      const reference = `fixed:reminder:${tx.id}:${next.toISOString().slice(0, 10)}`;
      const { title, description } = this.buildMessage(tx, next);
      try {
        await this.notificationService.createIfMissing(
          tx.user_id,
          { title, description },
          reference,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo crear recordatorio para transacción ${tx.id}`,
          error,
        );
      }
    }

    this.logger.log(
      `Recordatorios procesados para ${transactions.length} transacciones fijas.`,
    );
  }

  private buildMessage(
    tx: TransactionRecord,
    next: Date,
  ): { title: string; description: string } {
    const isInvestment = tx.type === TransactionTypeEnum.INVESTMENT;
    const isIncome = tx.type === TransactionTypeEnum.INCOME;
    const isSubscription = tx.fixed_type === FixedTypeEnum.DEDUCTION;

    const title = this.i18n.t(
      isSubscription
        ? 'notification.UPCOMING_SUBSCRIPTION'
        : isInvestment
          ? 'notification.UPCOMING_INVESTMENT'
          : isIncome
            ? 'notification.UPCOMING_INCOME'
            : 'notification.UPCOMING_DEDUCTION',
    );

    const concept =
      tx.description ??
      tx.addressee ??
      this.i18n.t('notification.GENERIC_MOVEMENT');
    const date = next.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const amount = fmtAmount(Number(tx.amount));

    const method = tx.payment_method
      ? PAYMENT_METHOD_LABELS[tx.payment_method]
      : null;
    const source = [tx.source_bank, tx.source_account]
      .filter(Boolean)
      .join(' · ');

    let description: string;
    if (method || source) {
      const paymentInfo = [
        method
          ? this.i18n.t('notification.PAYMENT_METHOD', { args: { method } })
          : '',
        source
          ? this.i18n.t('notification.SOURCE_ENTITY', { args: { source } })
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      description = `${this.i18n.t('notification.UPCOMING_DESCRIPTION', {
        args: { concept, amount, date },
      })} ${paymentInfo}.`;
    } else {
      description = `${this.i18n.t('notification.UPCOMING_DESCRIPTION', {
        args: { concept, amount, date },
      })} ${this.i18n.t('notification.ADD_PAYMENT_HINT')}`;
    }

    return { title, description };
  }
}

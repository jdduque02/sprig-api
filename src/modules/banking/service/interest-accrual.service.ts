import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { EncryptionService } from '@shared/services/encryption.service';
import {
  accruedInterestDaily,
  cdtMaturityInterest,
  YieldFrequency,
  RateType,
} from '@banking/utils/compound.util';

/**
 * Interest accrual service — calculates and records interest income for
 * bank accounts with enabled interest.
 *
 * Called by the daily cron job or manually for backfill/testing.
 */
@Injectable()
export class InterestAccrualService {
  private readonly logger = new Logger(InterestAccrualService.name);

  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Get today's date in Bogotá timezone (yyyy-MM-dd).
   */
  private todayBogota(): string {
    return new Date()
      .toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
      .slice(0, 10);
  }

  /**
   * Days between two date strings (yyyy-MM-dd).
   */
  private daysBetween(from: string, to: string): number {
    const f = new Date(from + 'T00:00:00-05:00');
    const t = new Date(to + 'T00:00:00-05:00');
    return Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Decrypt the account balance to a number.
   */
  private decryptBalance(entity: BankAccount): number {
    if (!entity.encrypted_balance) return 0;
    return Number(
      this.encryptionService.decryptField(entity.encrypted_balance, 'banking'),
    );
  }

  /**
   * Find all accounts eligible for interest accrual.
   */
  async findEligibleAccounts(): Promise<BankAccount[]> {
    return this.bankAccountRepo.find({
      where: {
        deleted_at: IsNull(),
        interest_enabled: true,
      },
    });
  }

  /**
   * Calculate interest for a single account.
   * Returns { interest, periodStart, periodEnd } or null if no interest to apply.
   */
  calculateInterest(
    account: BankAccount,
    today: string,
  ): { interest: number; periodStart: string; periodEnd: string } | null {
    const rate = account.annual_interest_rate;
    if (!rate || rate <= 0) return null;

    const balance = this.decryptBalance(account);
    if (balance <= 0) return null;

    const rateType = (account.rate_type ?? 'EA') as RateType;
    const frequency = (account.yield_frequency ?? 'monthly') as YieldFrequency;

    // Determine the period start
    const periodStart =
      account.last_interest_applied_at ??
      account.interest_start_date ??
      account.created_at?.toISOString()?.slice(0, 10) ??
      today;

    // Don't accrue if already applied today
    if (periodStart === today) return null;

    // CDT: only accrue at maturity
    if (account.term_days && account.maturity_date) {
      if (today < account.maturity_date) return null;
      const interest = cdtMaturityInterest(
        balance,
        rate,
        rateType,
        account.term_days,
      );
      if (interest <= 0) return null;
      return {
        interest,
        periodStart: account.maturity_date,
        periodEnd: today,
      };
    }

    // Regular account: accrue based on frequency
    if (frequency === 'daily') {
      const days = this.daysBetween(periodStart, today);
      if (days <= 0) return null;
      const interest = accruedInterestDaily(balance, rate, rateType, days);
      if (interest <= 0) return null;
      return { interest, periodStart, periodEnd: today };
    }

    if (frequency === 'monthly') {
      const days = this.daysBetween(periodStart, today);
      if (days < 28) return null;
      const interest = accruedInterestDaily(balance, rate, rateType, days);
      if (interest <= 0) return null;
      return { interest, periodStart, periodEnd: today };
    }

    if (frequency === 'annual') {
      const days = this.daysBetween(periodStart, today);
      if (days < 350) return null;
      const interest = accruedInterestDaily(balance, rate, rateType, days);
      if (interest <= 0) return null;
      return { interest, periodStart, periodEnd: today };
    }

    return null;
  }

  /**
   * Accrue interest for a single account — creates income record and
   * updates account metadata (last_interest_applied_at, CDT dates).
   *
   * The income transaction record is created externally via TransactionRecordRepository.create
   * which calls applyToEntity to credit the account balance.
   * This method only updates the account metadata after the income is created.
   */
  async updateAccountMetadata(
    account: BankAccount,
    periodEnd: string,
  ): Promise<void> {
    account.last_interest_applied_at = periodEnd;

    // CDT rollover: if past maturity and auto_renew, roll dates forward
    if (
      account.term_days &&
      account.maturity_date &&
      periodEnd >= account.maturity_date &&
      account.auto_renew
    ) {
      account.start_date = account.maturity_date;
      const newMaturity = new Date(account.maturity_date);
      newMaturity.setDate(newMaturity.getDate() + account.term_days);
      account.maturity_date = newMaturity.toISOString().slice(0, 10);
    }

    await this.bankAccountRepo.save(account);
  }
}

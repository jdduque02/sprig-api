import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterestAccrualService } from './interest-accrual.service';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { TransactionTypeEnum, ReviewStatusEnum } from '@shared/enums';
import { EncryptionService } from '@shared/services/encryption.service';

/**
 * Daily cron job that accrues interest for bank accounts.
 *
 * Runs at 01:00 AM America/Bogota.
 * Creates income transaction_records which credit accounts via applyToEntity.
 */
@Injectable()
export class InterestAccrualScheduler {
  private readonly logger = new Logger(InterestAccrualScheduler.name);

  constructor(
    private readonly interestAccrualService: InterestAccrualService,
    @InjectRepository(TransactionRecord)
    private readonly transactionRecordRepo: Repository<TransactionRecord>,
    private readonly encryptionService: EncryptionService,
  ) {}

  @Cron('0 1 * * *', {
    name: 'interest-accrual',
    timeZone: 'America/Bogota',
  })
  async handleDailyAccrual(): Promise<void> {
    this.logger.log('Starting daily interest accrual job');
    const result = await this.runAccrual();
    this.logger.log(
      `Interest accrual complete: ${result.accrued} accrued, ${result.skipped} skipped, ${result.errors} errors`,
    );
  }

  /**
   * Manual trigger for backfill or testing.
   */
  async triggerManual(): Promise<{
    accrued: number;
    skipped: number;
    errors: number;
  }> {
    this.logger.log('Manual interest accrual triggered');
    return this.runAccrual();
  }

  private async runAccrual(): Promise<{
    accrued: number;
    skipped: number;
    errors: number;
  }> {
    const accounts =
      await this.interestAccrualService.findEligibleAccounts();

    let accrued = 0;
    let skipped = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        const today = new Date()
          .toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
          .slice(0, 10);

        const result =
          this.interestAccrualService.calculateInterest(account, today);

        if (!result) {
          skipped++;
          continue;
        }

        // Create income transaction record — this credits the account via applyToEntity
        const income = this.transactionRecordRepo.create({
          user_id: account.user_id,
          type: TransactionTypeEnum.INCOME,
          amount: result.interest,
          account_id: account.id,
          currency: account.currency ?? 'COP',
          description: `Rendimientos automáticos · ${account.bank_name}`,
          transaction_date: result.periodEnd,
          category_status: ReviewStatusEnum.CATEGORIZED,
          source: 'system',
        });
        await this.transactionRecordRepo.save(income);

        // Update account metadata (last_interest_applied_at, CDT rollover)
        await this.interestAccrualService.updateAccountMetadata(
          account,
          result.periodEnd,
        );

        this.logger.log(
          `Accrued $${result.interest} for account ${account.id} (${account.bank_name})`,
        );
        accrued++;
      } catch (err) {
        this.logger.error(
          `Error accruing interest for account ${account.id}: ${err}`,
        );
        errors++;
      }
    }

    return { accrued, skipped, errors };
  }
}

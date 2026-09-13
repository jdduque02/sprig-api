import {
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BankAccountRepository {
  private readonly logger = new Logger(BankAccountRepository.name);

  constructor(
    @InjectRepository(BankAccount)
    private readonly repo: Repository<BankAccount>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateBankAccountDto,
    encryptedAccountNumber: string | null,
    encryptedBalance: string | null,
  ): Promise<BankAccount> {
    try {
      const account = this.repo.create({
        user_id: userId,
        bank_name: dto.bank_name,
        account_type: dto.account_type,
        currency: dto.currency ?? 'COP',
        encrypted_account_number: encryptedAccountNumber,
        encrypted_balance: encryptedBalance,
        annual_interest_rate: dto.annual_interest_rate ?? null,
        yield_frequency: dto.yield_frequency ?? 'monthly',
        rate_type: dto.rate_type ?? 'EA',
        interest_enabled: dto.interest_enabled ?? true,
        interest_start_date: dto.interest_start_date ?? null,
        term_days: dto.term_days ?? null,
        start_date: dto.start_date ?? null,
        maturity_date: null,
        maturity_action: dto.maturity_action ?? 'renew',
        auto_renew: dto.auto_renew ?? true,
        is_primary: dto.is_primary ?? false,
        exempt_4x1000: dto.exempt_4x1000 ?? false,
      });
      const saved = await this.repo.save(account);
      this.logger.log(`Cuenta bancaria creada para usuario ID: ${userId}`);
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async findAll(userId: number): Promise<BankAccount[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findByIdOrNull(
    id: number,
    userId: number,
  ): Promise<BankAccount | null> {
    return this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
  }

  async findById(id: number, userId: number): Promise<BankAccount> {
    const account = await this.findByIdOrNull(id, userId);
    if (!account)
      throw new NotFoundException(
        this.i18n.t('banking.BANK_ACCOUNT_NOT_FOUND', { args: { id } }),
      );
    return account;
  }

  async update(
    id: number,
    userId: number,
    dto: Partial<BankAccount>,
  ): Promise<BankAccount> {
    const account = await this.findById(id, userId);
    const updated = this.repo.merge(account, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(
      `Cuenta bancaria ID ${id} actualizada para usuario ID: ${userId}`,
    );
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const account = await this.findById(id, userId);
    await this.repo.softRemove(account);
    this.logger.log(
      `Cuenta bancaria ID ${id} eliminada (soft) para usuario ID: ${userId}`,
    );
  }

  private handleDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(
        this.i18n.t('banking.BANK_ACCOUNT_DUPLICATE'),
      );
    }
    this.logger.error(`Error de base de datos: ${(error as Error).message}`);
    throw new InternalServerErrorException(
      this.i18n.t('banking.PROCESSING_ERROR'),
    );
  }
}

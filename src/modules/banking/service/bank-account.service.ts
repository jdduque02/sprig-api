import { Injectable, Logger } from '@nestjs/common';
import { BankAccountRepository } from '@banking/repositories/bank-account.repository';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';
import { UpdateBankAccountDto } from '@banking/dto/bank-account/update-bank-account.dto';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { BankAccountResponseDto } from '@banking/dto/bank-account/bank-account-response.dto';
import { EncryptionService } from '@shared/services/encryption.service';
import { projectYield, YieldFrequency, RateType } from '@banking/utils/compound.util';

@Injectable()
export class BankAccountService {
  private readonly logger = new Logger(BankAccountService.name);

  constructor(
    private readonly bankAccountRepository: BankAccountRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  private toResponseDto(entity: BankAccount): BankAccountResponseDto {
    const rawBalance = entity.encrypted_balance
      ? this.encryptionService.decryptField(entity.encrypted_balance, 'banking')
      : '0';
    const rawAccountNumber = entity.encrypted_account_number
      ? this.encryptionService.decryptField(
          entity.encrypted_account_number,
          'banking',
        )
      : '';
    const maskedNumber = rawAccountNumber
      ? '****' + rawAccountNumber.slice(-4)
      : '****0000';

    return {
      id: entity.id,
      user_id: entity.user_id,
      bank_name: entity.bank_name,
      account_type: entity.account_type,
      masked_account_number: maskedNumber,
      display_balance: rawBalance ?? '0',
      currency: entity.currency,
      annual_interest_rate: entity.annual_interest_rate ?? null,
      yield_frequency: entity.yield_frequency ?? 'monthly',
      rate_type: entity.rate_type ?? 'EA',
      interest_enabled: entity.interest_enabled ?? true,
      last_interest_applied_at: entity.last_interest_applied_at ?? null,
      interest_start_date: entity.interest_start_date ?? null,
      term_days: entity.term_days ?? null,
      start_date: entity.start_date ?? null,
      maturity_date: entity.maturity_date ?? null,
      maturity_action: entity.maturity_action ?? 'renew',
      auto_renew: entity.auto_renew ?? true,
      is_primary: entity.is_primary,
      exempt_4x1000: entity.exempt_4x1000,
      created_at: entity.created_at,
      updated_at: entity.updated_at ?? null,
    };
  }

  async create(
    userId: number,
    dto: CreateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    const encryptedAccountNumber = this.encryptionService.encryptField(
      dto.account_number,
      'banking',
    );
    const encryptedBalance = this.encryptionService.encryptField(
      String(dto.balance),
      'banking',
    );
    const entity = await this.bankAccountRepository.create(
      userId,
      dto,
      encryptedAccountNumber,
      encryptedBalance,
    );
    return this.toResponseDto(entity);
  }

  async findAll(userId: number): Promise<BankAccountResponseDto[]> {
    const entities = await this.bankAccountRepository.findAll(userId);
    return entities.map((e) => this.toResponseDto(e));
  }

  async findOne(id: number, userId: number): Promise<BankAccountResponseDto> {
    const entity = await this.bankAccountRepository.findById(id, userId);
    return this.toResponseDto(entity);
  }

  /**
   * Variante para consumo entre módulos: no lanza si la cuenta no existe o
   * no pertenece al usuario. Devuelve la entidad cruda (sin descifrar) para
   * que otros módulos (p. ej. `finance`) puedan enlazar opcionalmente a una
   * cuenta bancaria sin inyectar `Repository<BankAccount>` directamente.
   */
  async findOptional(id: number, userId: number): Promise<BankAccount | null> {
    return this.bankAccountRepository.findByIdOrNull(id, userId);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    const partial: Partial<BankAccount> = {
      bank_name: dto.bank_name,
      account_type: dto.account_type,
      currency: dto.currency,
      is_primary: dto.is_primary,
      exempt_4x1000: dto.exempt_4x1000,
    };
    if (dto.annual_interest_rate !== undefined) {
      partial.annual_interest_rate = dto.annual_interest_rate;
    }
    if (dto.yield_frequency !== undefined) {
      partial.yield_frequency = dto.yield_frequency;
    }
    if (dto.rate_type !== undefined) {
      partial.rate_type = dto.rate_type;
    }
    if (dto.interest_enabled !== undefined) {
      partial.interest_enabled = dto.interest_enabled;
    }
    if (dto.interest_start_date !== undefined) {
      partial.interest_start_date = dto.interest_start_date;
    }
    if (dto.term_days !== undefined) {
      partial.term_days = dto.term_days;
    }
    if (dto.start_date !== undefined) {
      partial.start_date = dto.start_date;
      // Auto-calculate maturity_date if term_days is set
      if (dto.term_days && dto.start_date) {
        const start = new Date(dto.start_date);
        start.setDate(start.getDate() + dto.term_days);
        partial.maturity_date = start.toISOString().slice(0, 10);
      }
    }
    if (dto.maturity_action !== undefined) {
      partial.maturity_action = dto.maturity_action;
    }
    if (dto.auto_renew !== undefined) {
      partial.auto_renew = dto.auto_renew;
    }
    if (dto.account_number) {
      partial.encrypted_account_number = this.encryptionService.encryptField(
        dto.account_number,
        'banking',
      );
    }
    if (dto.balance !== undefined) {
      partial.encrypted_balance = this.encryptionService.encryptField(
        String(dto.balance),
        'banking',
      );
    }
    const entity = await this.bankAccountRepository.update(id, userId, partial);
    return this.toResponseDto(entity);
  }

  async getProjectedYield(
    id: number,
    userId: number,
  ): Promise<{
    current_balance: number;
    annual_rate: number | null;
    rate_type: string;
    yield_frequency: string;
    projected: Record<string, number>;
  }> {
    const entity = await this.bankAccountRepository.findById(id, userId);
    const rawBalance = entity.encrypted_balance
      ? Number(
          this.encryptionService.decryptField(
            entity.encrypted_balance,
            'banking',
          ),
        )
      : 0;
    const rate = entity.annual_interest_rate ?? 0;
    const freq = (entity.yield_frequency ?? 'monthly') as YieldFrequency;
    const rateType = (entity.rate_type ?? 'EA') as RateType;

    const projected = projectYield(rawBalance, rate, rateType, freq);

    return {
      current_balance: rawBalance,
      annual_rate: entity.annual_interest_rate ?? null,
      rate_type: rateType,
      yield_frequency: freq,
      projected,
    };
  }

  async remove(id: number, userId: number): Promise<void> {
    return this.bankAccountRepository.softDelete(id, userId);
  }
}

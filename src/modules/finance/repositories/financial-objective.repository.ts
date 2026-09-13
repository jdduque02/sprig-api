import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import { FinancialObjective } from '@finance/entities/financial-objective.entity';
import { CreateFinancialObjectiveDto } from '@finance/dto/financial-objective/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from '@finance/dto/financial-objective/update-financial-objective.dto';
import { BankAccountService } from '@banking/service/bank-account.service';
import { EncryptionService } from '@shared/services/encryption.service';
import {
  applyCompletion,
  computeObjectiveProgress,
} from '@shared/helpers/financial-objective.helper';

export type FinancialObjectiveWithProgress = FinancialObjective &
  ReturnType<typeof computeObjectiveProgress>;

@Injectable()
export class FinancialObjectiveRepository {
  private readonly logger = new Logger(FinancialObjectiveRepository.name);

  constructor(
    @InjectRepository(FinancialObjective)
    private readonly repo: Repository<FinancialObjective>,
    private readonly bankAccountService: BankAccountService,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private readonly SCHEMA = 'finance';

  async create(
    userId: number,
    dto: CreateFinancialObjectiveDto,
  ): Promise<FinancialObjectiveWithProgress> {
    const payload = await this.resolveAccountLink(userId, { ...dto });
    if (payload.bank !== undefined && payload.bank !== null) {
      payload.bank = this.encryptionService.encryptField(
        payload.bank,
        this.SCHEMA,
      ) as unknown as string;
    }
    const objective = this.repo.create({
      ...payload,
      user_id: userId,
      current_balance: payload.current_balance ?? 0,
    });
    applyCompletion(objective);
    const saved = await this.repo.save(objective);
    this.logger.log(`Objetivo financiero creado para usuario ID: ${userId}`);
    return this.decryptBank(saved);
  }

  async findAll(userId: number): Promise<FinancialObjectiveWithProgress[]> {
    const objectives = await this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
    return objectives.map((o) => this.decryptBank(o));
  }

  async findById(
    id: number,
    userId: number,
  ): Promise<FinancialObjectiveWithProgress> {
    const objective = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!objective)
      throw new NotFoundException(
        this.i18n.t('finance.OBJECTIVE_NOT_FOUND', { args: { id } }),
      );
    return this.decryptBank(objective);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateFinancialObjectiveDto,
  ): Promise<FinancialObjectiveWithProgress> {
    const objective = await this.findById(id, userId);

    const payload = await this.resolveAccountLink(userId, { ...dto });
    if (payload.bank !== undefined && payload.bank !== null) {
      payload.bank = this.encryptionService.encryptField(
        payload.bank,
        this.SCHEMA,
      ) as unknown as string;
    }

    // Si el usuario marca explícitamente el completado se respeta; de lo
    // contrario se reevalúa automáticamente según saldo actual vs objetivo.
    const merged = this.repo.merge(objective, payload);
    if (dto.is_completed !== undefined || dto.completed_at !== undefined) {
      const completed = dto.is_completed ?? true;
      merged.is_completed = completed;
      merged.completed_at = completed
        ? dto.completed_at
          ? new Date(dto.completed_at)
          : new Date()
        : null;
    } else {
      applyCompletion(merged);
    }

    const saved = await this.repo.save(merged);
    this.logger.log(
      `Objetivo financiero ID ${id} actualizado para usuario ID: ${userId}`,
    );
    return this.decryptBank(saved);
  }

  /**
   * Si el DTO trae account_id, resuelve la cuenta bancaria del usuario y
   * autocompleta bank (nombre del banco) y current_profitability (tasa anual)
   * cuando no se enviaron explícitamente.
   */
  private async resolveAccountLink(
    userId: number,
    payload: Partial<CreateFinancialObjectiveDto> & { account_id?: number },
  ): Promise<Partial<CreateFinancialObjectiveDto> & { account_id?: number }> {
    const accountId = payload.account_id;
    if (accountId === undefined || accountId === null) return payload;

    const account = await this.bankAccountService.findOptional(
      Number(accountId),
      userId,
    );
    if (!account) return payload;

    if (payload.bank === undefined || payload.bank === null) {
      payload.bank = account.bank_name;
    }
    if (
      (payload.current_profitability === undefined ||
        payload.current_profitability === null) &&
      account.annual_interest_rate !== undefined &&
      account.annual_interest_rate !== null
    ) {
      payload.current_profitability = account.annual_interest_rate;
    }
    return payload;
  }

  /**
   * Resuelve la cuenta bancaria del usuario para el cálculo de cuota:
   * devuelve el nombre del banco y la tasa anual, o null si no existe.
   */
  async resolveAccountForQuota(
    userId: number,
    accountId: number,
  ): Promise<{
    bank: string | null;
    annual_interest_rate: number | null;
  } | null> {
    const account = await this.bankAccountService.findOptional(
      accountId,
      userId,
    );
    if (!account) return null;
    return {
      bank: account.bank_name ?? null,
      annual_interest_rate: account.annual_interest_rate ?? null,
    };
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const objective = await this.findById(id, userId);
    await this.repo.softRemove(objective);
    this.logger.log(
      `Objetivo financiero ID ${id} eliminado (soft) para usuario ID: ${userId}`,
    );
  }

  private decryptBank(
    objective: FinancialObjective,
  ): FinancialObjectiveWithProgress {
    const result = { ...objective } as FinancialObjectiveWithProgress;
    if (result.bank) {
      result.bank = this.encryptionService.decryptField(
        result.bank,
        this.SCHEMA,
      );
    }
    Object.assign(result, computeObjectiveProgress(result));
    return result;
  }
}

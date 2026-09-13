import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';
import { UpdateFinancialLiabilityDto } from '@banking/dto/financial-liability/update-financial-liability.dto';

@Injectable()
export class FinancialLiabilityRepository {
  private readonly logger = new Logger(FinancialLiabilityRepository.name);

  constructor(
    @InjectRepository(FinancialLiability)
    private readonly repo: Repository<FinancialLiability>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateFinancialLiabilityDto,
  ): Promise<FinancialLiability> {
    const liability = this.repo.create({ ...dto, user_id: userId });
    const saved = await this.repo.save(liability);
    this.logger.log(`Pasivo financiero creado para usuario ID: ${userId}`);
    return saved;
  }

  async findAll(userId: number): Promise<FinancialLiability[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number, userId: number): Promise<FinancialLiability> {
    const liability = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!liability)
      throw new NotFoundException(
        this.i18n.t('banking.LIABILITY_NOT_FOUND', { args: { id } }),
      );
    return liability;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateFinancialLiabilityDto,
  ): Promise<FinancialLiability> {
    const liability = await this.findById(id, userId);
    const updated = this.repo.merge(liability, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(
      `Pasivo financiero ID ${id} actualizado para usuario ID: ${userId}`,
    );
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const liability = await this.findById(id, userId);
    await this.repo.softRemove(liability);
    this.logger.log(
      `Pasivo financiero ID ${id} eliminado (soft) para usuario ID: ${userId}`,
    );
  }
}

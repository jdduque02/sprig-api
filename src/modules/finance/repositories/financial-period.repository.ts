import {
  ConflictException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { FinancialPeriod } from '@finance/entities/financial-period.entity';
import { CreateFinancialPeriodDto } from '@finance/dto/financial-period/create-financial-period.dto';

@Injectable()
export class FinancialPeriodRepository {
  private readonly logger = new Logger(FinancialPeriodRepository.name);

  constructor(
    @InjectRepository(FinancialPeriod)
    private readonly repo: Repository<FinancialPeriod>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateFinancialPeriodDto,
  ): Promise<FinancialPeriod> {
    const existing = await this.repo.findOne({
      where: { user_id: userId, year: dto.year, month: dto.month },
    });
    if (existing)
      throw new ConflictException(
        this.i18n.t('finance.PERIOD_DUPLICATE', {
          args: { year: dto.year, month: dto.month },
        }),
      );

    const period = this.repo.create({ ...dto, user_id: userId });
    const saved = await this.repo.save(period);
    this.logger.log(
      `Período financiero ${dto.year}-${dto.month} creado para usuario ID: ${userId}`,
    );
    return saved;
  }

  async findAll(userId: number): Promise<FinancialPeriod[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async findById(id: number, userId: number): Promise<FinancialPeriod> {
    const period = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!period)
      throw new NotFoundException(
        this.i18n.t('finance.PERIOD_NOT_FOUND', { args: { id } }),
      );
    return period;
  }

  async close(id: number, userId: number): Promise<FinancialPeriod> {
    const period = await this.findById(id, userId);
    if (period.is_closed)
      throw new ConflictException(
        this.i18n.t('finance.PERIOD_CLOSED', {
          args: { year: period.year, month: period.month },
        }),
      );
    period.is_closed = true;
    period.closed_at = new Date();
    const saved = await this.repo.save(period);
    this.logger.log(
      `Período ${period.year}-${period.month} cerrado para usuario ID: ${userId}`,
    );
    return saved;
  }

  async findByYearMonth(
    userId: number,
    year: number,
    month: number,
  ): Promise<FinancialPeriod | null> {
    return this.repo.findOne({ where: { user_id: userId, year, month } });
  }

  async findOrCreateCurrent(
    userId: number,
    year: number,
    month: number,
  ): Promise<FinancialPeriod> {
    const existing = await this.findByYearMonth(userId, year, month);
    if (existing) return existing;
    try {
      return await this.create(userId, { year, month });
    } catch (error) {
      // Concurrent request may have created the period between our check and
      // this insert (uq_financial_period_user_year_month). Re-fetch instead
      // of failing the caller with a raw conflict/DB error.
      const raceWinner = await this.findByYearMonth(userId, year, month);
      if (raceWinner) return raceWinner;
      throw error;
    }
  }
}

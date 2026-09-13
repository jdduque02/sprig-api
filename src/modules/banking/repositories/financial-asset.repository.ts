import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Not, Repository } from 'typeorm';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';
import { UpdateFinancialAssetDto } from '@banking/dto/financial-asset/update-financial-asset.dto';

@Injectable()
export class FinancialAssetRepository {
  private readonly logger = new Logger(FinancialAssetRepository.name);

  constructor(
    @InjectRepository(FinancialAsset)
    private readonly repo: Repository<FinancialAsset>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateFinancialAssetDto,
  ): Promise<FinancialAsset> {
    const asset = this.repo.create({ ...dto, user_id: userId });
    const saved = await this.repo.save(asset);
    this.logger.log(`Activo financiero creado para usuario ID: ${userId}`);
    return saved;
  }

  async findAll(userId: number): Promise<FinancialAsset[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number, userId: number): Promise<FinancialAsset> {
    const asset = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!asset)
      throw new NotFoundException(
        this.i18n.t('banking.ASSET_NOT_FOUND', { args: { id } }),
      );
    return asset;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateFinancialAssetDto,
  ): Promise<FinancialAsset> {
    const asset = await this.findById(id, userId);
    const updated = this.repo.merge(asset, dto);
    const saved = await this.repo.save(updated);
    this.logger.log(
      `Activo financiero ID ${id} actualizado para usuario ID: ${userId}`,
    );
    return saved;
  }

  async updateQuote(
    id: number,
    userId: number,
    price: number,
    currency: string,
  ): Promise<void> {
    await this.repo.update(
      { id, user_id: userId, deleted_at: IsNull() },
      { current_value: price, currency },
    );
  }

  async findSymbolized(userId: number): Promise<FinancialAsset[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull(), symbol: Not(IsNull()) },
      order: { created_at: 'DESC' },
    });
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const asset = await this.findById(id, userId);
    await this.repo.softRemove(asset);
    this.logger.log(
      `Activo financiero ID ${id} eliminado (soft) para usuario ID: ${userId}`,
    );
  }
}

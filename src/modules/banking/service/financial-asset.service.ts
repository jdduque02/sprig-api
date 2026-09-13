import { Injectable, Logger } from '@nestjs/common';
import { FinancialAssetRepository } from '@banking/repositories/financial-asset.repository';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';
import { UpdateFinancialAssetDto } from '@banking/dto/financial-asset/update-financial-asset.dto';
import {
  AssetQuoteResult,
  MarketDataService,
} from '@banking/service/market-data.service';

@Injectable()
export class FinancialAssetService {
  private readonly logger = new Logger(FinancialAssetService.name);

  constructor(
    private readonly financialAssetRepository: FinancialAssetRepository,
    private readonly marketDataService: MarketDataService,
  ) {}

  async create(userId: number, dto: CreateFinancialAssetDto) {
    return this.financialAssetRepository.create(userId, dto);
  }

  async findAll(userId: number) {
    return this.financialAssetRepository.findAll(userId);
  }

  async findOne(id: number, userId: number) {
    return this.financialAssetRepository.findById(id, userId);
  }

  async update(id: number, userId: number, dto: UpdateFinancialAssetDto) {
    return this.financialAssetRepository.update(id, userId, dto);
  }

  async remove(id: number, userId: number) {
    return this.financialAssetRepository.softDelete(id, userId);
  }

  async refreshQuotes(userId: number): Promise<AssetQuoteResult[]> {
    const assets = await this.financialAssetRepository.findSymbolized(userId);
    const results = await this.marketDataService.refreshQuotes(assets);
    await Promise.all(
      results
        .filter((r) => r.success)
        .map((r) =>
          this.financialAssetRepository.updateQuote(
            r.asset_id,
            userId,
            r.price,
            r.currency,
          ),
        ),
    );
    return results;
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { FinancialAssetRepository } from '@banking/repositories/financial-asset.repository';
import { MarketDataService } from '@banking/service/market-data.service';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';

const mockFinancialAssetRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  findSymbolized: jest.fn(),
  updateQuote: jest.fn(),
};

const mockMarketDataService = {
  refreshQuotes: jest.fn(),
};

const buildAsset = (overrides = {}): FinancialAsset =>
  ({
    id: 1,
    user_id: 10,
    asset_type: 'acciones',
    name: 'Acciones Ecopetrol',
    current_value: 5000000,
    currency: 'COP',
    ...overrides,
  }) as unknown as FinancialAsset;

describe('FinancialAssetService', () => {
  let service: FinancialAssetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAssetService,
        {
          provide: FinancialAssetRepository,
          useValue: mockFinancialAssetRepository,
        },
        { provide: MarketDataService, useValue: mockMarketDataService },
      ],
    }).compile();

    service = module.get<FinancialAssetService>(FinancialAssetService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe delegar al repositorio y retornar el activo creado', async () => {
      const dto = {
        asset_type: 'acciones',
        name: 'Acciones Ecopetrol',
        current_value: 5000000,
      };
      const asset = buildAsset();
      mockFinancialAssetRepository.create.mockResolvedValue(asset);

      const result = await service.create(10, dto);

      expect(mockFinancialAssetRepository.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(asset);
    });
  });

  describe('findAll', () => {
    it('debe retornar todos los activos del usuario', async () => {
      const list = [buildAsset(), buildAsset({ id: 2, name: 'CDT' })];
      mockFinancialAssetRepository.findAll.mockResolvedValue(list);

      const result = await service.findAll(10);

      expect(mockFinancialAssetRepository.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar el activo por id', async () => {
      const asset = buildAsset();
      mockFinancialAssetRepository.findById.mockResolvedValue(asset);

      const result = await service.findOne(1, 10);

      expect(mockFinancialAssetRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(asset);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockFinancialAssetRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar y retornar el activo', async () => {
      const dto = { current_value: 6000000 };
      const updated = buildAsset({ current_value: 6000000 });
      mockFinancialAssetRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      expect(mockFinancialAssetRepository.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result.current_value).toBe(6000000);
    });
  });

  describe('remove', () => {
    it('debe delegar softDelete al repositorio', async () => {
      mockFinancialAssetRepository.softDelete.mockResolvedValue(undefined);

      await expect(service.remove(1, 10)).resolves.toBeUndefined();

      expect(mockFinancialAssetRepository.softDelete).toHaveBeenCalledWith(
        1,
        10,
      );
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockFinancialAssetRepository.softDelete.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('refreshQuotes', () => {
    it('debe consultar cotizaciones y persistir solo las exitosas', async () => {
      const assets = [
        buildAsset({ id: 1, symbol: 'NU', quote_source: 'yahoo' }),
        buildAsset({ id: 2, symbol: 'USDT', quote_source: 'coingecko' }),
      ];
      const quotes = [
        {
          asset_id: 1,
          name: 'Acciones Ecopetrol',
          symbol: 'NU',
          price: 12.5,
          currency: 'USD',
          success: true,
        },
        {
          asset_id: 2,
          name: 'Acciones Ecopetrol',
          symbol: 'USDT',
          price: 0,
          currency: 'COP',
          success: false,
        },
      ];
      mockFinancialAssetRepository.findSymbolized.mockResolvedValue(assets);
      mockMarketDataService.refreshQuotes.mockResolvedValue(quotes);
      mockFinancialAssetRepository.updateQuote.mockResolvedValue(undefined);

      const result = await service.refreshQuotes(10);

      expect(mockFinancialAssetRepository.findSymbolized).toHaveBeenCalledWith(
        10,
      );
      expect(mockMarketDataService.refreshQuotes).toHaveBeenCalledWith(assets);
      expect(mockFinancialAssetRepository.updateQuote).toHaveBeenCalledTimes(1);
      expect(mockFinancialAssetRepository.updateQuote).toHaveBeenCalledWith(
        1,
        10,
        12.5,
        'USD',
      );
      expect(result).toEqual(quotes);
    });
  });
});

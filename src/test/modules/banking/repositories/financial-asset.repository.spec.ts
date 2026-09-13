import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { FinancialAssetRepository } from '@banking/repositories/financial-asset.repository';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';
import { UpdateFinancialAssetDto } from '@banking/dto/financial-asset/update-financial-asset.dto';

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
  update: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildAsset = (overrides = {}): FinancialAsset =>
  ({
    id: 1,
    user_id: 10,
    asset_type: 'acciones',
    name: 'Acciones Ecopetrol',
    current_value: 5000000,
    currency: 'COP',
    deleted_at: null,
    created_at: new Date(),
    ...overrides,
  }) as unknown as FinancialAsset;

describe('FinancialAssetRepository', () => {
  let repo: FinancialAssetRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAssetRepository,
        {
          provide: getRepositoryToken(FinancialAsset),
          useValue: mockTypeOrmRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<FinancialAssetRepository>(FinancialAssetRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateFinancialAssetDto = {
      asset_type: 'acciones',
      name: 'Acciones Ecopetrol',
      current_value: 5000000,
    };

    it('debe crear y guardar el activo exitosamente', async () => {
      const asset = buildAsset();
      mockTypeOrmRepo.create.mockReturnValue(asset);
      mockTypeOrmRepo.save.mockResolvedValue(asset);

      const result = await repo.create(10, dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(result).toEqual(asset);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar activos del usuario sin soft-delete', async () => {
      const list = [
        buildAsset(),
        buildAsset({ id: 2, name: 'CDT Davivienda' }),
      ];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findAll(10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar el activo existente', async () => {
      const asset = buildAsset();
      mockTypeOrmRepo.findOne.mockResolvedValue(asset);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(asset);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateFinancialAssetDto = { current_value: 6000000 };

    it('debe actualizar y retornar el activo', async () => {
      const existing = buildAsset();
      const updated = buildAsset({ current_value: 6000000 });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      const result = await repo.update(1, 10, dto);

      expect(result.current_value).toBe(6000000);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, 10, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateQuote
  // ─────────────────────────────────────────────────────────────
  describe('updateQuote', () => {
    it('debe actualizar el precio y la divisa del activo', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });

      await repo.updateQuote(1, 10, 55000, 'USD');

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, user_id: 10 }),
        { current_value: 55000, currency: 'USD' },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findSymbolized
  // ─────────────────────────────────────────────────────────────
  describe('findSymbolized', () => {
    it('debe retornar solo los activos con símbolo asignado', async () => {
      const list = [buildAsset({ symbol: 'ECOPETROL' })];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findSymbolized(10);

      const [callArg] = mockTypeOrmRepo.find.mock.calls[0] as [
        { where: { user_id: number } },
      ];
      expect(callArg.where.user_id).toBe(10);
      expect(result).toEqual(list);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('debe ejecutar softRemove sobre el activo', async () => {
      const asset = buildAsset();
      mockTypeOrmRepo.findOne.mockResolvedValue(asset);
      mockTypeOrmRepo.softRemove.mockResolvedValue(undefined);

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(asset);
    });

    it('debe lanzar NotFoundException si no existe el activo', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

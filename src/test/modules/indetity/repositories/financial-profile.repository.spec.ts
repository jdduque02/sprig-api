import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { FinancialProfileRepository } from '@identity/repositories/financial-profile.repository';
import { FinancialProfile } from '@identity/entities/financial-profile.entity';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';
import { EncryptionService } from '@shared/services/encryption.service';

const buildProfile = (
  overrides: Partial<FinancialProfile> = {},
): FinancialProfile =>
  ({
    id: '1',
    user_id: 2,
    profile_name: 'Plan de Ahorro',
    is_custom: false,
    needs_ratio: 50,
    wants_ratio: 30,
    savings_ratio: 20,
    max_debt_ratio: 35,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as FinancialProfile;

const mockTypeOrmRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  remove: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const mockEncryptionService = {
  encryptField: jest.fn((value: string | null | undefined) => value),
  decryptField: jest.fn((value: string | null | undefined) => value),
};

describe('FinancialProfileRepository', () => {
  let repo: FinancialProfileRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialProfileRepository,
        {
          provide: getRepositoryToken(FinancialProfile),
          useValue: mockTypeOrmRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    repo = module.get<FinancialProfileRepository>(FinancialProfileRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: Omit<CreateFinancialProfileDto, 'user_id'> = {
      profile_name: 'Plan de Ahorro',
      is_custom: false,
      needs_ratio: 50,
      wants_ratio: 30,
      savings_ratio: 20,
      max_debt_ratio: 35,
    };

    it('debe crear el perfil si el usuario no tiene uno', async () => {
      const profile = buildProfile();
      mockTypeOrmRepo.findOne.mockResolvedValue(null); // sin perfil previo
      mockTypeOrmRepo.create.mockReturnValue(profile);
      mockTypeOrmRepo.save.mockResolvedValue(profile);

      const result = await repo.create(2, dto);
      expect(result.user_id).toBe(2);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledTimes(1);
    });

    it('debe encriptar monthly_income cuando viene en el dto', async () => {
      const profile = buildProfile({ monthly_income: '6000' });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      mockTypeOrmRepo.create.mockReturnValue(profile);
      mockTypeOrmRepo.save.mockResolvedValue(profile);

      const result = await repo.create(2, { ...dto, monthly_income: 6000 });
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '6000',
        'finance',
      );
      expect(result.monthly_income).toBe(6000);
    });

    it('debe lanzar ConflictException si ya existe un perfil para el usuario', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(buildProfile()); // ya existe

      await expect(repo.create(2, dto)).rejects.toThrow(ConflictException);
      expect(mockTypeOrmRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND BY USER ID
  // ─────────────────────────────────────────────────────────────
  describe('findByUserId', () => {
    it('debe retornar el perfil si existe', async () => {
      const profile = buildProfile();
      mockTypeOrmRepo.findOne.mockResolvedValue(profile);

      const result = await repo.findByUserId(2);
      expect(result.user_id).toBe(2);
    });

    it('debe descifrar monthly_income encriptado', async () => {
      const profile = buildProfile({ monthly_income: 'encrypted-5000' });
      mockTypeOrmRepo.findOne.mockResolvedValue(profile);
      mockEncryptionService.decryptField.mockReturnValue('5000');

      const result = await repo.findByUserId(2);
      expect(mockEncryptionService.decryptField).toHaveBeenCalledWith(
        'encrypted-5000',
        'finance',
      );
      expect(result.monthly_income).toBe(5000);
    });

    it('debe setear monthly_income a null si la descifrado devuelve vacío', async () => {
      const profile = buildProfile({ monthly_income: 'encrypted-empty' });
      mockTypeOrmRepo.findOne.mockResolvedValue(profile);
      mockEncryptionService.decryptField.mockReturnValue('');

      const result = await repo.findByUserId(2);
      expect(result.monthly_income).toBeNull();
    });

    it('debe lanzar NotFoundException si no existe el perfil', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.findByUserId(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar y retornar el perfil actualizado', async () => {
      const original = buildProfile();
      const updatedProfile = buildProfile({ needs_ratio: 60 });
      mockTypeOrmRepo.findOne.mockResolvedValue(original);
      mockTypeOrmRepo.merge.mockReturnValue(updatedProfile);
      mockTypeOrmRepo.save.mockResolvedValue(updatedProfile);

      const dto: UpdateFinancialProfileDto = {
        needs_ratio: 60,
      };
      const result = await repo.update(2, dto);
      expect(result.needs_ratio).toBe(60);
      expect(mockTypeOrmRepo.merge).toHaveBeenCalledWith(original, dto);
    });

    it('debe encriptar monthly_income al actualizar si viene en el dto', async () => {
      const original = buildProfile({ monthly_income: '5000' });
      const updatedProfile = buildProfile({ monthly_income: '7000' });
      mockTypeOrmRepo.findOne.mockResolvedValue(original);
      mockTypeOrmRepo.merge.mockReturnValue(updatedProfile);
      mockTypeOrmRepo.save.mockResolvedValue(updatedProfile);
      mockEncryptionService.decryptField.mockImplementation(
        (value: string | null | undefined) => value,
      );

      const result = await repo.update(2, { monthly_income: 7000 });
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '7000',
        'finance',
      );
      expect(result.monthly_income).toBe(7000);
    });

    it('debe lanzar NotFoundException si el perfil no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      const dto: UpdateFinancialProfileDto = {
        needs_ratio: 60,
      };
      await expect(repo.update(99, dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REMOVE
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar el perfil correctamente', async () => {
      const profile = buildProfile();
      mockTypeOrmRepo.findOne.mockResolvedValue(profile);
      mockTypeOrmRepo.remove.mockResolvedValue(undefined);

      await expect(repo.remove(2)).resolves.toBeUndefined();
      expect(mockTypeOrmRepo.remove).toHaveBeenCalledWith(profile);
    });

    it('debe lanzar NotFoundException si el perfil no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});

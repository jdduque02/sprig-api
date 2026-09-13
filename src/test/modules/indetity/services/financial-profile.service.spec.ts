import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinancialProfileService } from '../../../../modules/identity/service/financial-profile.service';
import { FinancialProfileRepository } from '@identity/repositories/financial-profile.repository';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';
import { FinancialProfile } from '@identity/entities/financial-profile.entity';

const mockRepo = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

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

describe('FinancialProfileService', () => {
  let service: FinancialProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialProfileService,
        { provide: FinancialProfileRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<FinancialProfileService>(FinancialProfileService);
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

    it('debe crear perfil financiero correctamente', async () => {
      const profile = buildProfile();
      mockRepo.create.mockResolvedValue(profile);

      const result = await service.create(2, dto);
      expect(mockRepo.create).toHaveBeenCalledWith(2, dto);
      expect(result.user_id).toBe(2);
    });

    it('debe propagar ConflictException si ya existe un perfil', async () => {
      mockRepo.create.mockRejectedValue(
        new ConflictException('El usuario 2 ya tiene un perfil financiero.'),
      );
      await expect(service.create(2, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND BY USER ID
  // ─────────────────────────────────────────────────────────────
  describe('findByUserId', () => {
    it('debe retornar el perfil financiero del usuario', async () => {
      const profile = buildProfile();
      mockRepo.findByUserId.mockResolvedValue(profile);

      const result = await service.findByUserId(2);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(2);
      expect(result.profile_name).toBe('Plan de Ahorro');
    });

    it('debe propagar NotFoundException si no existe el perfil', async () => {
      mockRepo.findByUserId.mockRejectedValue(
        new NotFoundException('El usuario 99 no tiene perfil financiero.'),
      );
      await expect(service.findByUserId(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar el perfil financiero', async () => {
      const dto: UpdateFinancialProfileDto = {
        needs_ratio: 60,
      };
      const updated = buildProfile({ needs_ratio: 60 });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(2, dto);
      expect(mockRepo.update).toHaveBeenCalledWith(2, dto);
      expect(result.needs_ratio).toBe(60);
    });

    it('debe propagar NotFoundException si el usuario no tiene perfil', async () => {
      mockRepo.update.mockRejectedValue(new NotFoundException());
      const dto: UpdateFinancialProfileDto = {
        needs_ratio: 60,
      };
      await expect(service.update(99, dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REMOVE
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar el perfil financiero correctamente', async () => {
      mockRepo.remove.mockResolvedValue(undefined);
      await expect(service.remove(2)).resolves.toBeUndefined();
      expect(mockRepo.remove).toHaveBeenCalledWith(2);
    });

    it('debe propagar NotFoundException si no existe el perfil', async () => {
      mockRepo.remove.mockRejectedValue(new NotFoundException());
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});

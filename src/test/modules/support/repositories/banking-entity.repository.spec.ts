import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';
import { BankingEntityRepository } from '@support/repositories/banking-entity.repository';
import { BankingEntity } from '@support/entities/banking-entity.entity';
import { CreateBankingEntityDto } from '@support/dto/banking-entity/create-banking-entity.dto';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildEntity = (overrides: Partial<BankingEntity> = {}): BankingEntity =>
  ({
    id: 1,
    code: 'daviplata',
    name: 'Daviplata',
    is_active: true,
    detect_patterns: ['Movimientos de Daviplata'],
    created_at: new Date('2026-08-07T00:00:00.000Z'),
    updated_at: null,
    deleted_at: null,
    ...overrides,
  }) as unknown as BankingEntity;

describe('BankingEntityRepository', () => {
  let repo: BankingEntityRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankingEntityRepository,
        { provide: getRepositoryToken(BankingEntity), useValue: mockRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<BankingEntityRepository>(BankingEntityRepository);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateBankingEntityDto = {
      code: 'daviplata',
      name: 'Daviplata',
      detect_patterns: ['Movimientos de Daviplata'],
    };

    it('guarda la entidad con los valores por defecto', async () => {
      const entity = buildEntity();
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await repo.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith({
        code: 'daviplata',
        name: 'Daviplata',
        is_active: true,
        detect_patterns: ['Movimientos de Daviplata'],
      });
      expect(result).toEqual(entity);
    });

    it('lanza ConflictException si el código ya existe', async () => {
      mockRepo.create.mockReturnValue(buildEntity());
      mockRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(repo.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findActive', () => {
    it('retorna solo entidades activas', async () => {
      const list = [buildEntity(), buildEntity({ id: 2, code: 'nu' })];
      mockRepo.find.mockResolvedValue(list);

      const result = await repo.findActive();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
          }) as Record<string, unknown>,
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('retorna todas las entidades no eliminadas (activas e inactivas)', async () => {
      const list = [buildEntity(), buildEntity({ id: 2, is_active: false })];
      mockRepo.find.mockResolvedValue(list);

      const result = await repo.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: expect.anything() as unknown,
          }) as Record<string, unknown>,
          order: { name: 'ASC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findActiveDetections', () => {
    it('mapea las entidades activas al formato de detección del parser', async () => {
      mockRepo.find.mockResolvedValue([buildEntity()]);

      const result = await repo.findActiveDetections();

      expect(result).toEqual([
        {
          code: 'daviplata',
          detect_patterns: ['Movimientos de Daviplata'],
        },
      ]);
    });

    it('omite entidades sin patrones (los mapea como lista vacía)', async () => {
      mockRepo.find.mockResolvedValue([
        buildEntity({ detect_patterns: null as never }),
      ]);

      const result = await repo.findActiveDetections();

      expect(result).toEqual([{ code: 'daviplata', detect_patterns: [] }]);
    });
  });

  describe('findById', () => {
    it('retorna la entidad existente', async () => {
      const entity = buildEntity();
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findById(1);

      expect(result).toEqual(entity);
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('actualiza los campos enviados', async () => {
      const entity = buildEntity();
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.merge.mockReturnValue({ ...entity, name: 'Daviplata S.A.' });
      mockRepo.save.mockResolvedValue({ ...entity, name: 'Daviplata S.A.' });

      const result = await repo.update(1, { name: 'Daviplata S.A.' });

      expect(mockRepo.merge).toHaveBeenCalledWith(entity, {
        name: 'Daviplata S.A.',
      });
      expect(result.name).toBe('Daviplata S.A.');
    });

    it('lanza InternalServerErrorException para errores de BD distintos a violación de unicidad', async () => {
      const entity = buildEntity();
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.merge.mockReturnValue(entity);
      mockRepo.save.mockRejectedValue(new Error('connection reset'));

      await expect(repo.update(1, { name: 'X' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('softDelete', () => {
    it('desactiva y hace soft delete (deleted_at) de la entidad', async () => {
      const entity = buildEntity();
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.softRemove.mockResolvedValue({ ...entity, is_active: false });

      await repo.softDelete(1);

      expect(entity.is_active).toBe(false);
      expect(mockRepo.softRemove).toHaveBeenCalledWith(entity);
    });
  });
});

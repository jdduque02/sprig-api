import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { SupportRequestRepository } from '@support/repositories/support-request.repository';
import {
  SupportRequest,
  SupportRequestStatusEnum,
} from '@support/entities/support-request.entity';
import { CreateSupportRequestDto } from '@support/dto/support-request/create-support-request.dto';

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

const buildRequest = (
  overrides: Partial<SupportRequest> = {},
): SupportRequest =>
  ({
    id: 1,
    user_id: 10,
    subject: 'No reconoce el extracto de mi banco',
    description: 'Al cargar el PDF el sistema no detecta movimientos.',
    status: SupportRequestStatusEnum.OPEN,
    admin_notes: null,
    created_at: new Date('2026-08-07T00:00:00.000Z'),
    updated_at: null,
    deleted_at: null,
    ...overrides,
  }) as unknown as SupportRequest;

describe('SupportRequestRepository', () => {
  let repo: SupportRequestRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportRequestRepository,
        { provide: getRepositoryToken(SupportRequest), useValue: mockRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<SupportRequestRepository>(SupportRequestRepository);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('guarda la solicitud con el usuario', async () => {
      const request = buildRequest();
      const dto: CreateSupportRequestDto = {
        subject: 'No reconoce el extracto de mi banco',
        description: 'Al cargar el PDF el sistema no detecta movimientos.',
      };
      mockRepo.create.mockReturnValue(request);
      mockRepo.save.mockResolvedValue(request);

      const result = await repo.create(10, dto);

      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, user_id: 10 });
      expect(result).toEqual(request);
    });
  });

  describe('findByUser', () => {
    it('retorna solo las solicitudes del usuario', async () => {
      mockRepo.find.mockResolvedValue([buildRequest()]);

      const result = await repo.findByUser(10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 10,
          }) as Record<string, unknown>,
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findByIdAndUser', () => {
    it('retorna la solicitud del usuario', async () => {
      const request = buildRequest();
      mockRepo.findOne.mockResolvedValue(request);

      const result = await repo.findByIdAndUser(1, 10);

      expect(result).toEqual(request);
    });

    it('lanza NotFoundException si no pertenece al usuario', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.findByIdAndUser(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllAdmin', () => {
    it('retorna todas las solicitudes no eliminadas de todos los usuarios', async () => {
      const list = [buildRequest(), buildRequest({ id: 2, user_id: 20 })];
      mockRepo.find.mockResolvedValue(list);

      const result = await repo.findAllAdmin();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: expect.anything() as unknown,
          }) as Record<string, unknown>,
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findByIdAdmin', () => {
    it('retorna la solicitud sin filtrar por usuario', async () => {
      const request = buildRequest();
      mockRepo.findOne.mockResolvedValue(request);

      const result = await repo.findByIdAdmin(1);

      expect(result).toEqual(request);
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.findByIdAdmin(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAdmin', () => {
    it('actualiza el estado y las notas del admin', async () => {
      const request = buildRequest();
      mockRepo.findOne.mockResolvedValue(request);
      mockRepo.merge.mockReturnValue({
        ...request,
        status: SupportRequestStatusEnum.IN_PROGRESS,
        admin_notes: 'Solicitado al equipo.',
      });
      mockRepo.save.mockResolvedValue({
        ...request,
        status: SupportRequestStatusEnum.IN_PROGRESS,
        admin_notes: 'Solicitado al equipo.',
      });

      const result = await repo.updateAdmin(1, {
        status: SupportRequestStatusEnum.IN_PROGRESS,
        admin_notes: 'Solicitado al equipo.',
      });

      expect(result.status).toBe(SupportRequestStatusEnum.IN_PROGRESS);
      expect(result.admin_notes).toBe('Solicitado al equipo.');
    });
  });

  describe('softDelete', () => {
    it('borra de forma lógica la solicitud del usuario', async () => {
      const request = buildRequest();
      mockRepo.findOne.mockResolvedValue(request);
      mockRepo.softRemove.mockResolvedValue(request);

      await repo.softDelete(1, 10);

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            user_id: 10,
          }) as Record<string, unknown>,
        }),
      );
      expect(mockRepo.softRemove).toHaveBeenCalledWith(request);
    });
  });
});

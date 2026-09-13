import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogRepository } from '@audit/repositories/audit-log.repository';
import { AuditLog } from '@audit/entities/audit-log.entity';
import { WriteAuditLogDto } from '@audit/dto/write-audit-log.dto';
import { AuditActionEnum } from '@shared/enums';

const buildQb = (result: [AuditLog[], number]) => ({
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue(result),
});

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const buildEntry = (): AuditLog =>
  ({
    id: 1,
    schema_name: 'finance',
    table_name: 'transaction_record',
    record_id: 10,
    action: AuditActionEnum.INSERT,
    changed_by: 5,
    old_data: null,
    new_data: { amount: 5000 },
    created_at: new Date(),
  }) as unknown as AuditLog;

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogRepository,
        { provide: getRepositoryToken(AuditLog), useValue: mockTypeOrmRepo },
      ],
    }).compile();

    repo = module.get<AuditLogRepository>(AuditLogRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // write
  // ─────────────────────────────────────────────────────────────
  describe('write', () => {
    const dto: WriteAuditLogDto = {
      schema_name: 'finance',
      table_name: 'transaction_record',
      record_id: 10,
      action: AuditActionEnum.INSERT,
      changed_by: 5,
      new_data: { amount: 5000 },
    };

    it('debe persistir y retornar el log de auditoría', async () => {
      const entry = buildEntry();
      mockTypeOrmRepo.create.mockReturnValue(entry);
      mockTypeOrmRepo.save.mockResolvedValue(entry);

      const result = await repo.write(dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(dto);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(entry);
    });

    it('debe retornar null si el save lanza una excepción (error silenciado)', async () => {
      mockTypeOrmRepo.create.mockReturnValue(buildEntry());
      mockTypeOrmRepo.save.mockRejectedValue(new Error('DB connection lost'));

      const result = await repo.write(dto);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar lista paginada de logs', async () => {
      const entry = buildEntry();
      const qb = buildQb([[entry], 1]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('debe aplicar filtros opcionales cuando se proveen', async () => {
      const qb = buildQb([[], 0]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findAll({
        schema_name: 'finance',
        table_name: 'transaction_record',
        record_id: 10,
        changed_by: 5,
        action: AuditActionEnum.DELETE,
        page: 1,
        limit: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(5);
    });

    it('debe retornar lista vacía cuando no hay resultados', async () => {
      const qb = buildQb([[], 0]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repo.findAll({});

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findByUser
  // ─────────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('debe llamar a findAll con changed_by igual al userId', async () => {
      const qb = buildQb([[], 0]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findByUser(7, { page: 1, limit: 5 });

      // changed_by = 7 se aplicará como filtro andWhere
      expect(qb.andWhere).toHaveBeenCalledWith('al.changed_by = :changed_by', {
        changed_by: 7,
      });
    });
  });
});

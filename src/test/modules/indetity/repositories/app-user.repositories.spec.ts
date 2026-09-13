import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, QueryFailedError } from 'typeorm';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { AppUser } from '@identity/entities/app-user.entity';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { EncryptionService } from '@shared/services/encryption.service';

const buildUser = (overrides: Partial<AppUser> = {}): AppUser =>
  ({
    id: '1',
    external_id: 'kc-uuid',
    username: 'testuser',
    email: 'test@test.com',
    locale: 'es-CO',
    timezone: 'America/Bogota',
    metadata: {},
    is_active: true,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as AppUser;

// Builder de QueryBuilder encadenable
interface MockQueryBuilder {
  leftJoinAndSelect: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  take: jest.Mock;
  skip: jest.Mock;
  cache: jest.Mock;
  getManyAndCount: jest.Mock;
  getMany: jest.Mock;
}

const buildQb = (
  result?: [AppUser[], number] | AppUser[],
): MockQueryBuilder => {
  const qb: MockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    cache: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result),
  };
  return qb;
};

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  update: jest.fn(),
  softRemove: jest.fn(),
  restore: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const mockEncryptionService = {
  encryptField: jest.fn((value: string | null | undefined) => value),
  decryptField: jest.fn((value: string | null | undefined) => value),
};

describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: getRepositoryToken(AppUser), useValue: mockTypeOrmRepo },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    repo = module.get<UserRepository>(UserRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('debe crear y guardar un usuario exitosamente', async () => {
      const user = buildUser();
      mockTypeOrmRepo.create.mockReturnValue(user);
      mockTypeOrmRepo.save.mockResolvedValue(user);

      const result = await repo.create({
        username: 'testuser',
        email: 'test@test.com',
        external_id: 'kc-uuid',
      });
      expect(mockTypeOrmRepo.create).toHaveBeenCalledTimes(1);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledTimes(1);
      expect(result.username).toBe('testuser');
    });

    it('debe lanzar ConflictException si hay violación de unicidad (código 23505)', async () => {
      const pgError = Object.assign(Object.create(QueryFailedError.prototype), {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        detail: 'Key (email)=(test@test.com) already exists.',
      }) as unknown as QueryFailedError;
      mockTypeOrmRepo.create.mockReturnValue(buildUser());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(
        repo.create({
          username: 'testuser',
          email: 'test@test.com',
          external_id: 'kc-uuid',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar el usuario si existe', async () => {
      const user = buildUser();
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.findById('1');
      expect(result.id).toBe('1');
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.findById('99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND ALL (QueryBuilder)
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar lista paginada sin filtro de búsqueda', async () => {
      const users = [buildUser()];
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(buildQb([users, 1]));

      const query: UserQueryDto = { page: 1, limit: 10 };
      const result = await repo.findAll(query);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('debe aplicar ILIKE cuando se provee search', async () => {
      const users = [buildUser()];
      const qb = buildQb([users, 1]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      const query: UserQueryDto = { search: 'test', page: 1, limit: 10 };
      await repo.findAll(query);
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });

    it('debe retornar lista vacía si no hay resultados', async () => {
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(buildQb([[], 0]));

      const result = await repo.findAll({ page: 1, limit: 10 });
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('tolera entradas nulas en el resultado sin fallar', async () => {
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(buildQb([[null], 1]));

      const result = await repo.findAll({ page: 1, limit: 10 });
      expect(result.data).toEqual([null]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar el usuario y retornar la entidad actualizada', async () => {
      const user = buildUser();
      const updated = buildUser({ username: 'newname' });
      mockTypeOrmRepo.findOne.mockResolvedValue(user);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      const result = await repo.update(1, { username: 'newname' });
      expect(result.username).toBe('newname');
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.update(99, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND ALL ACTIVE EMAILS (broadcast)
  // ─────────────────────────────────────────────────────────────
  describe('findAllActiveEmails', () => {
    it('retorna emails de usuarios activos', async () => {
      const users = [
        buildUser({ email: 'a@test.com', full_name: 'Ana' }),
        buildUser({ id: '2', email: 'b@test.com', full_name: null }),
      ];
      const qb = buildQb(users);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repo.findAllActiveEmails();
      expect(result).toEqual([
        { email: 'a@test.com', full_name: 'Ana' },
        { email: 'b@test.com', full_name: null },
      ]);
      expect(qb.andWhere).toHaveBeenCalledWith('u.is_active = :active', {
        active: true,
      });
    });

    it('retorna lista vacía si no hay usuarios activos', async () => {
      const qb = buildQb([]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(repo.findAllActiveEmails()).resolves.toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND ALL (filtros is_active / role)
  // ─────────────────────────────────────────────────────────────
  describe('findAll filtros', () => {
    it('aplica filtros de is_active y role junto con la búsqueda', async () => {
      const users = [buildUser()];
      const qb = buildQb([users, 1]);
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(qb);

      const query: UserQueryDto = {
        search: '  test  ',
        role: 'admin',
        is_active: false,
        page: 2,
        limit: 5,
      };
      await repo.findAll(query);

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(qb.andWhere).toHaveBeenCalledWith('u.is_active = :is_active', {
        is_active: false,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(u.username ILIKE :search OR u.email ILIKE :search)',
        { search: 'test%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('u.roles @> :roleJson', {
        roleJson: JSON.stringify(['admin']),
      });
      expect(qb.orderBy).toHaveBeenCalledWith(
        'u.created_at',
        'DESC',
        'NULLS LAST',
      );
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.skip).toHaveBeenCalledWith(5);
    });

    it('usa los valores por defecto de orden y paginación', async () => {
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(buildQb([[], 0]));

      await repo.findAll({});

      expect(
        (mockTypeOrmRepo.createQueryBuilder() as MockQueryBuilder).orderBy,
      ).toHaveBeenCalledWith('u.created_at', 'DESC', 'NULLS LAST');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND BY EXTERNAL ID / USERNAME
  // ─────────────────────────────────────────────────────────────
  describe('findByExternalId', () => {
    it('retorna el usuario si existe', async () => {
      const user = buildUser();
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.findByExternalId('kc-uuid');

      expect(result).toEqual(user);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { external_id: 'kc-uuid', deleted_at: IsNull() },
      });
    });

    it('retorna null si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.findByExternalId('missing')).resolves.toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('retorna el usuario si existe', async () => {
      const user = buildUser();
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.findByUsername('testuser');

      expect(result).toEqual(user);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.findByUsername('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RECORD LOGIN / ROLES / ESTADO ACTIVO
  // ─────────────────────────────────────────────────────────────
  describe('recordLogin', () => {
    it('registra el último login con roles', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);
      await repo.recordLogin('1', ['admin']);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: '1' },
        { last_login_at: expect.any(Date) as Date, roles: ['admin'] },
      );
    });

    it('registra el último login sin roles', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);
      await repo.recordLogin('1', undefined as unknown as string[]);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: '1' },
        { last_login_at: expect.any(Date) as Date, roles: [] },
      );
    });
  });

  describe('updateRoles', () => {
    it('actualiza roles y devuelve el usuario', async () => {
      const user = buildUser();
      mockTypeOrmRepo.update.mockResolvedValue(undefined);
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.updateRoles('1', ['admin', 'user']);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: '1' },
        { roles: ['admin', 'user'] },
      );
      expect(result).toEqual(user);
    });
  });

  describe('updateActiveStatus', () => {
    it('desactiva y devuelve el usuario', async () => {
      const user = buildUser({ is_active: false });
      mockTypeOrmRepo.update.mockResolvedValue(undefined);
      mockTypeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.updateActiveStatus('1', false);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: '1' },
        { is_active: false },
      );
      expect(result.is_active).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE con error de BD
  // ─────────────────────────────────────────────────────────────
  describe('update errores', () => {
    it('lanza ConflictException ante violación de unicidad', async () => {
      const pgError = Object.assign(Object.create(QueryFailedError.prototype), {
        message: 'duplicate key',
        code: '23505',
        detail: 'Key (email) already exists.',
      }) as unknown as QueryFailedError;
      mockTypeOrmRepo.findOne.mockResolvedValue(buildUser());
      mockTypeOrmRepo.merge.mockReturnValue(buildUser());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(repo.update(1, { email: 'dup@test.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza InternalServerErrorException ante error de BD genérico', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(buildUser());
      mockTypeOrmRepo.merge.mockReturnValue(buildUser());
      mockTypeOrmRepo.save.mockRejectedValue(new Error('connection lost'));

      await expect(repo.update(1, { username: 'x' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('ejecuta soft remove sobre el usuario encontrado', async () => {
      const user = buildUser();
      mockTypeOrmRepo.findOne.mockResolvedValue(user);
      mockTypeOrmRepo.softRemove.mockResolvedValue(user);

      await repo.softDelete('1');

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(user);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RESTORE
  // ─────────────────────────────────────────────────────────────
  describe('restore', () => {
    it('restaura un usuario eliminado', async () => {
      const deleted = buildUser({ deleted_at: new Date() });
      mockTypeOrmRepo.findOne.mockResolvedValue(deleted);
      mockTypeOrmRepo.restore.mockResolvedValue(undefined);

      const result = await repo.restore('1');

      expect(mockTypeOrmRepo.restore).toHaveBeenCalledWith('1');
      expect(result.id).toBe('1');
    });

    it('lanza error al intentar restaurar un usuario inexistente', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.restore('99')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('lanza error al restaurar un usuario no eliminado', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(buildUser());
      await expect(repo.restore('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE con campos sensibles
  // ─────────────────────────────────────────────────────────────
  describe('create encriptación', () => {
    it('encripta los campos sensibles antes de guardar', async () => {
      const user = buildUser({
        phone: '3001234567',
        address: 'Calle 1',
        full_name: 'Ana',
        document_id: '1010',
      });
      mockTypeOrmRepo.create.mockReturnValue(user);
      mockTypeOrmRepo.save.mockResolvedValue(user);

      await repo.create({
        username: 'testuser',
        email: 'test@test.com',
        phone: '3001234567',
        address: 'Calle 1',
        full_name: 'Ana',
        document_id: '1010',
      });

      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '3001234567',
        'identity',
      );
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        'Calle 1',
        'identity',
      );
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        'Ana',
        'identity',
      );
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '1010',
        'identity',
      );
    });

    it('rechaza un dto nulo sin encriptar campos', async () => {
      mockTypeOrmRepo.create.mockReturnValue(null);
      mockTypeOrmRepo.save.mockResolvedValue(null);

      await expect(repo.create(null as never)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockEncryptionService.encryptField).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // MANEJO DE ERRORES (handleDbError)
  // ─────────────────────────────────────────────────────────────
  describe('handleDbError', () => {
    it('lanza InternalServerErrorException para errores de BD no relacionados con unicidad', async () => {
      const pgError = Object.assign(Object.create(QueryFailedError.prototype), {
        message: 'syntax error',
        code: '42601',
      }) as unknown as QueryFailedError;
      mockTypeOrmRepo.create.mockReturnValue(buildUser());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(
        repo.create({ username: 'x', email: 'x@x.com' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('lanza InternalServerErrorException cuando el error no es una instancia de Error', async () => {
      mockTypeOrmRepo.create.mockReturnValue(buildUser());
      mockTypeOrmRepo.save.mockRejectedValue('fallo genérico');

      await expect(
        repo.create({ username: 'x', email: 'x@x.com' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});

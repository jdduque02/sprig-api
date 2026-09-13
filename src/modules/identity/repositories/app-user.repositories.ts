import {
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DeepPartial, IsNull, QueryFailedError, Repository } from 'typeorm';
import { AppUser } from '@identity/entities/app-user.entity';
import { CreateUserDto } from '@identity/dto/user/create-user.dto';
import { UpdateUserDto } from '@identity/dto/user/update-user.dto';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { EncryptionService } from '@shared/services/encryption.service';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @InjectRepository(AppUser)
    private readonly repo: Repository<AppUser>,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────

  async create(
    dto: Omit<CreateUserDto, 'password'> & DeepPartial<AppUser>,
  ): Promise<AppUser> {
    try {
      const encrypted = this.encryptSensitiveFields(dto);
      const user = this.repo.create(encrypted);
      const savedUser = await this.repo.save(user);
      const decrypted = this.decryptSensitiveFields(savedUser);

      this.logger.log(
        `Usuario creado exitosamente: ${savedUser.username} (ID: ${savedUser.id})`,
      );
      return decrypted;
    } catch (error) {
      this.logger.error(
        `Error al crear usuario: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      this.handleDbError(error, 'crear usuario');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────

  async findAll(
    query: UserQueryDto,
  ): Promise<{ data: AppUser[]; total: number }> {
    const {
      search,
      role,
      is_active,
      sortBy = 'created_at',
      order = 'DESC',
      page = 1,
      limit = 20,
    } = query;

    this.logger.debug(
      `Buscando usuarios: search="${search}" role=${role} is_active=${is_active} sortBy=${sortBy} order=${order} página=${page} límite=${limit}`,
    );

    const qb = this.repo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.financial_profile', 'fp')
      .where('u.deleted_at IS NULL')
      .cache(`users:list:${JSON.stringify(query)}`, 30_000);

    if (typeof is_active === 'boolean') {
      qb.andWhere('u.is_active = :is_active', { is_active });
    }

    if (search?.trim()) {
      qb.andWhere('(u.username ILIKE :search OR u.email ILIKE :search)', {
        search: `${search.trim()}%`,
      });
    }

    if (role?.trim()) {
      qb.andWhere(`u.roles @> :roleJson`, {
        roleJson: JSON.stringify([role.trim()]),
      });
    }

    qb.orderBy(`u.${sortBy}`, order, 'NULLS LAST')
      .take(limit)
      .skip((page - 1) * limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((u) => this.decryptSensitiveFields(u)),
      total,
    };
  }

  async findById(id: string): Promise<AppUser> {
    const user = await this.repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: { financial_profile: true },
    });

    if (!user) {
      this.logger.warn(
        `Intento fallido de buscar usuario inexistente por ID: ${id}`,
      );
      throw new NotFoundException(
        this.i18n.t('identity.USER_NOT_FOUND', { args: { id } }),
      );
    }
    return this.decryptSensitiveFields(user);
  }

  async findByExternalId(externalId: string): Promise<AppUser | null> {
    return this.repo.findOne({
      where: { external_id: externalId, deleted_at: IsNull() },
    });
  }

  async findByUsername(username: string): Promise<AppUser> {
    const user = await this.repo.findOne({
      where: { username, deleted_at: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('identity.USERNAME_NOT_FOUND', { args: { username } }),
      );
    }

    return user;
  }

  /**
   * Emails de usuarios activos (no eliminados) para envíos masivos.
   */
  async findAllActiveEmails(): Promise<
    Array<{ email: string; full_name: string | null }>
  > {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select(['u.email', 'u.full_name'])
      .where('u.deleted_at IS NULL')
      .andWhere('u.is_active = :active', { active: true })
      .getMany();

    return rows.map((u) => ({
      email: u.email,
      full_name: this.encryptionService.decryptField(u.full_name, this.SCHEMA),
    }));
  }

  async recordLogin(id: string, roles: string[]): Promise<void> {
    await this.repo.update(
      { id },
      {
        last_login_at: new Date(),
        roles: roles ?? [],
      },
    );
  }

  async updateRoles(id: string, roles: string[]): Promise<AppUser> {
    await this.repo.update({ id }, { roles });
    return this.findById(id);
  }

  async updateActiveStatus(id: string, isActive: boolean): Promise<AppUser> {
    await this.repo.update({ id }, { is_active: isActive });
    return this.findById(id);
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────

  async update(id: string, updateUserDto: UpdateUserDto): Promise<AppUser> {
    const user = await this.findById(id);

    try {
      const encrypted = this.encryptSensitiveFields(updateUserDto);
      const updated = this.repo.merge(user, encrypted);
      const result = await this.repo.save(updated);
      const decrypted = this.decryptSensitiveFields(result);

      this.logger.log(`Usuario actualizado: ${result.username} (ID: ${id})`);
      return decrypted;
    } catch (error) {
      this.handleDbError(error, `actualizar usuario ID: ${id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────

  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.repo.softRemove(user);
    this.logger.log(`Soft delete ejecutado para usuario ID: ${id}`);
  }

  async restore(id: string): Promise<AppUser> {
    try {
      const user = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user)
        throw new NotFoundException(
          this.i18n.t('identity.USER_NOT_FOUND', { args: { id } }),
        );

      if (!user.deleted_at) {
        this.logger.warn(`Intento de restaurar usuario no eliminado ID: ${id}`);
        throw new ConflictException(
          this.i18n.t('identity.USER_NOT_DELETED', { args: { id } }),
        );
      }

      await this.repo.restore(id);
      this.logger.log(`Usuario restaurado exitosamente ID: ${id}`);
      return this.findById(id);
    } catch (error) {
      this.handleDbError(error, `restaurar usuario ID: ${id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ENCRYPTION HELPERS
  // ─────────────────────────────────────────────────────────────

  private readonly SCHEMA = 'identity';
  private readonly SENSITIVE_FIELDS = [
    'phone',
    'address',
    'full_name',
    'document_id',
  ] as const;
  private encryptSensitiveFields<T>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    const result = { ...(data as object) } as Record<string, unknown>;
    for (const field of this.SENSITIVE_FIELDS) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.encryptionService.encryptField(
          result[field] as string | null,
          this.SCHEMA,
        );
      }
    }
    return result as T;
  }

  private decryptSensitiveFields(user: AppUser): AppUser {
    if (!user) return user;
    const result = { ...user } as Record<string, unknown>;
    for (const field of this.SENSITIVE_FIELDS) {
      result[field] = this.encryptionService.decryptField(
        result[field] as string | null,
        this.SCHEMA,
      );
    }
    return result as unknown as AppUser;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Manejo centralizado de errores con Log detallado.
   */
  private handleDbError(error: unknown, contextAction: string): never {
    if (error instanceof QueryFailedError) {
      const pg = error as QueryFailedError & { code?: string; detail?: string };

      if (pg.code === PG_UNIQUE_VIOLATION) {
        this.logger.warn(
          `Conflicto de unicidad al ${contextAction}: ${pg.detail}`,
        );
        throw new ConflictException(this.i18n.t('identity.USER_DUPLICATE'));
      }
    }

    // Registro del error completo para el desarrollador en consola/logs de servidor
    this.logger.error(
      `Error crítico al ${contextAction}:`,
      error instanceof Error ? error.stack : error,
    );

    throw new InternalServerErrorException(this.i18n.t('identity.DB_ERROR'));
  }
}

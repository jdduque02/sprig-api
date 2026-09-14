import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { plainToInstance } from 'class-transformer';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { KeycloakAdminService } from '@auth/service/keycloak-admin.service';
import { CreateUserDto } from '@identity/dto/user/create-user.dto';
import { UpdateUserDto } from '@identity/dto/user/update-user.dto';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { AppUser } from '@identity/entities/app-user.entity';
import { EncryptionService } from '@shared/services/encryption.service';
import { PresenceService } from '@shared/services/presence.service';
import { AuditLogService } from '@audit/service/audit-log.service';
import { AuditActionEnum } from '@shared/enums';
import { ALLOWED_REALM_ROLES } from '@identity/dto/user/update-user-roles.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly keycloakAdminService: KeycloakAdminService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly encryptionService: EncryptionService,
    private readonly presenceService: PresenceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const keycloakId = await this.keycloakAdminService.createUser({
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });

    try {
      await this.keycloakAdminService.assignRealmRoles(keycloakId, ['user']);
      const userPayload = { ...dto } as Omit<CreateUserDto, 'password'>;
      delete (userPayload as { password?: string }).password;

      const user = await this.userRepository.create({
        ...userPayload,
        external_id: keycloakId,
        roles: ['user'],
      });
      this.logger.log(`Usuario creado y sincronizado con Keycloak: ${user.id}`);
      return this.toDetailDto(user);
    } catch (error) {
      this.logger.error(
        '[createUser] Error al crear usuario; revirtiendo en Keycloak',
        error instanceof Error ? error.stack : undefined,
      );
      await this.keycloakAdminService.deleteUser(keycloakId);
      throw error;
    }
  }

  async findUser(id: string) {
    const cacheKey = `user_${id}`;

    const cachedUser = await this.cacheManager.get(cacheKey);
    if (cachedUser) {
      this.logger.log(`Usuario obtenido desde Redis Caché: ${id}`);
      return cachedUser;
    }

    this.logger.log(`Usuario no encontrado en caché, consultando DB: ${id}`);
    const user = await this.userRepository.findById(id);

    if (user) {
      const dto = this.toDetailDto(user);
      const ttl = this.configService.get<number>('USER_CACHE_TTL_MS', 60000);
      await this.cacheManager.set(cacheKey, dto, ttl);
      return dto;
    }

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const updatePayload = { ...dto };
    delete (updatePayload as Partial<UpdateUserDto>).password;

    if (updatePayload.email) {
      const current = await this.userRepository.findById(id);
      if (current.email !== updatePayload.email) {
        await this.keycloakAdminService.updateUser(current.external_id, {
          email: updatePayload.email,
        });
      }
    }

    const user = await this.userRepository.update(id, updatePayload);
    await this.cacheManager.del(`user_${id}`);
    this.logger.log(`Cache invalidado para usuario ID: ${id}`);
    return this.toDetailDto(user);
  }

  async findAllUsers(query: UserQueryDto) {
    const { data, total } = await this.userRepository.findAll(query);
    const online = await this.presenceService.getOnlineMap(
      data.map((u) => u.id),
    );
    return {
      data: data.map((u) => {
        const dto = this.toPublicDto(u);
        dto.is_online = online.has(String(u.id));
        return dto;
      }),
      total,
    };
  }

  async findAdminUserDetail(id: string) {
    const user = await this.userRepository.findById(id);
    const dto = this.toAdminDto(user);
    dto.is_online = await this.presenceService.isOnline(user.id);

    let sessions: unknown[] = [];
    let accessHistory: unknown[] = [];
    if (user.external_id) {
      try {
        sessions = await this.keycloakAdminService.getUserSessions(
          user.external_id,
        );
      } catch (e) {
        this.logger.warn(
          `[findAdminUserDetail] sessions: ${(e as Error).message}`,
        );
      }
      try {
        accessHistory = await this.keycloakAdminService.getUserEvents(
          user.external_id,
        );
      } catch (e) {
        this.logger.warn(
          `[findAdminUserDetail] events: ${(e as Error).message}`,
        );
      }
    }

    return { user: dto, sessions, accessHistory };
  }

  async updateUserStatus(id: string, isActive: boolean, adminUserId: number) {
    const current = await this.userRepository.findById(id);
    if (current.external_id) {
      await this.keycloakAdminService.setUserEnabled(
        current.external_id,
        isActive,
      );
      if (!isActive) {
        await this.keycloakAdminService.revokeAllSessions(current.external_id);
      }
    }
    const user = await this.userRepository.updateActiveStatus(id, isActive);
    await this.cacheManager.del(`user_${id}`);
    await this.auditLogService.write({
      schema_name: 'identity',
      table_name: 'app_user',
      record_id: Number(id),
      action: AuditActionEnum.UPDATE,
      old_data: { is_active: current.is_active },
      new_data: { is_active: isActive },
      changed_by: adminUserId,
    });
    const dto = this.toAdminDto(user);
    dto.is_online = await this.presenceService.isOnline(user.id);
    return dto;
  }

  async updateUserRoles(id: string, roles: string[], adminUserId: number) {
    const unique = [...new Set(roles)];
    for (const r of unique) {
      if (!ALLOWED_REALM_ROLES.includes(r as 'user' | 'admin')) {
        throw new BadRequestException(
          this.i18n.t('identity.INVALID_ROLE') ?? `Rol inválido: ${r}`,
        );
      }
    }
    if (!unique.includes('user')) {
      unique.push('user');
    }

    const current = await this.userRepository.findById(id);
    if (!current.external_id) {
      throw new BadRequestException(this.i18n.t('auth.KEYCLOAK_ID_MISSING'));
    }

    const currentRoles = await this.keycloakAdminService.getUserRealmRoles(
      current.external_id,
    );
    const managed = currentRoles.filter((r) =>
      (ALLOWED_REALM_ROLES as readonly string[]).includes(r),
    );
    const toRemove = managed.filter((r) => !unique.includes(r));
    const toAdd = unique.filter((r) => !managed.includes(r));

    if (toRemove.length) {
      await this.keycloakAdminService.removeRealmRoles(
        current.external_id,
        toRemove,
      );
    }
    if (toAdd.length) {
      await this.keycloakAdminService.assignRealmRoles(
        current.external_id,
        toAdd,
      );
    }

    const user = await this.userRepository.updateRoles(id, unique);
    await this.cacheManager.del(`user_${id}`);
    await this.auditLogService.write({
      schema_name: 'identity',
      table_name: 'app_user',
      record_id: Number(id),
      action: AuditActionEnum.UPDATE,
      old_data: { roles: current.roles },
      new_data: { roles: unique },
      changed_by: adminUserId,
    });
    const dto = this.toAdminDto(user);
    dto.is_online = await this.presenceService.isOnline(user.id);
    return dto;
  }

  async adminResetPassword(id: string, adminUserId: number) {
    const user = await this.userRepository.findById(id);
    if (!user.external_id) {
      throw new BadRequestException(this.i18n.t('auth.KEYCLOAK_ID_MISSING'));
    }
    await this.keycloakAdminService.sendResetPasswordEmail(user.external_id);
    await this.auditLogService.write({
      schema_name: 'identity',
      table_name: 'app_user',
      record_id: Number(id),
      action: AuditActionEnum.UPDATE,
      old_data: {},
      new_data: { action: 'reset_password_email' },
      changed_by: adminUserId,
    });
    return { message: 'Email de restablecimiento enviado' };
  }

  async adminRevokeAllSessions(id: string, adminUserId: number) {
    const user = await this.userRepository.findById(id);
    if (!user.external_id) {
      throw new BadRequestException(this.i18n.t('auth.KEYCLOAK_ID_MISSING'));
    }
    await this.keycloakAdminService.revokeAllSessions(user.external_id);
    await this.presenceService.markOffline(user.id);
    await this.auditLogService.write({
      schema_name: 'identity',
      table_name: 'app_user',
      record_id: Number(id),
      action: AuditActionEnum.UPDATE,
      old_data: {},
      new_data: { action: 'revoke_all_sessions' },
      changed_by: adminUserId,
    });
    return { message: 'Sesiones revocadas' };
  }

  async adminRevokeSession(id: string, sessionId: string, adminUserId: number) {
    const user = await this.userRepository.findById(id);
    if (!user.external_id) {
      throw new BadRequestException(this.i18n.t('auth.KEYCLOAK_ID_MISSING'));
    }
    const sessions = await this.keycloakAdminService.getUserSessions(
      user.external_id,
    );
    if (!sessions.some((s) => s.id === sessionId)) {
      throw new BadRequestException(this.i18n.t('auth.SESSION_NOT_FOUND'));
    }
    await this.keycloakAdminService.revokeSession(sessionId);
    await this.auditLogService.write({
      schema_name: 'identity',
      table_name: 'app_user',
      record_id: Number(id),
      action: AuditActionEnum.UPDATE,
      old_data: {},
      new_data: { action: 'revoke_session', sessionId },
      changed_by: adminUserId,
    });
    return { message: 'Sesión revocada' };
  }

  private toPublicDto(user: AppUser): UserResponseDto {
    return plainToInstance(UserResponseDto, {
      ...user,
      roles: user.roles ?? [],
      last_login_at: user.last_login_at ?? null,
    });
  }

  private toDetailDto(user: AppUser): UserResponseDto {
    const profile = user.financial_profile;
    if (profile?.monthly_income) {
      const decrypted = this.encryptionService.decryptField(
        profile.monthly_income,
        'finance',
      );
      (profile as { monthly_income?: number | null }).monthly_income = decrypted
        ? Number(decrypted)
        : null;
    }
    return plainToInstance(
      UserResponseDto,
      {
        ...user,
        roles: user.roles ?? [],
        last_login_at: user.last_login_at ?? null,
      },
      { groups: ['detail'] },
    );
  }

  private toAdminDto(user: AppUser): UserResponseDto {
    const profile = user.financial_profile;
    if (profile?.monthly_income) {
      const decrypted = this.encryptionService.decryptField(
        profile.monthly_income,
        'finance',
      );
      (profile as { monthly_income?: number | null }).monthly_income = decrypted
        ? Number(decrypted)
        : null;
    }
    return plainToInstance(
      UserResponseDto,
      {
        ...user,
        roles: user.roles ?? [],
        last_login_at: user.last_login_at ?? null,
      },
      { groups: ['admin'] },
    );
  }
}

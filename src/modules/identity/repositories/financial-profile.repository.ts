import {
  ConflictException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { FinancialProfile } from '@identity/entities/financial-profile.entity';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';
import { EncryptionService } from '@shared/services/encryption.service';

@Injectable()
export class FinancialProfileRepository {
  private readonly logger = new Logger(FinancialProfileRepository.name);
  private readonly SCHEMA = 'finance';

  constructor(
    @InjectRepository(FinancialProfile)
    private readonly repo: Repository<FinancialProfile>,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(
    userId: string,
    dto: Omit<CreateFinancialProfileDto, 'user_id'>,
  ): Promise<FinancialProfile> {
    const existing = await this.repo.findOne({ where: { user_id: userId } });
    if (existing) {
      throw new ConflictException(
        this.i18n.t('financial_profile.ALREADY_EXISTS', { args: { userId } }),
      );
    }

    const profileData: Record<string, unknown> = { ...dto, user_id: userId };

    if (dto.monthly_income !== undefined && dto.monthly_income !== null) {
      profileData.monthly_income = this.encryptionService.encryptField(
        String(dto.monthly_income),
        this.SCHEMA,
      );
    } else {
      profileData.monthly_income = null;
    }

    const profile = this.repo.create(profileData as Partial<FinancialProfile>);
    const saved = await this.repo.save(profile);
    this.logger.log(`Perfil financiero creado para usuario ID: ${userId}`);
    return this.decryptMonthlyIncome(saved);
  }

  async findByUserId(userId: string): Promise<FinancialProfile> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundException(
        this.i18n.t('financial_profile.NOT_FOUND', { args: { userId } }),
      );
    }
    return this.decryptMonthlyIncome(profile);
  }

  async update(
    userId: string,
    dto: UpdateFinancialProfileDto,
  ): Promise<FinancialProfile> {
    // OJO: usar el repo directo, no `findByUserId` — ese devuelve
    // `monthly_income` ya DESENCRIPTADO, y si se mergeara ese valor de
    // vuelta sobre la entidad se guardaría en claro (perdiendo el cifrado
    // AES-256-GCM) en cada update que no toque `monthly_income`.
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundException(
        this.i18n.t('financial_profile.NOT_FOUND', { args: { userId } }),
      );
    }

    const updateData: Record<string, unknown> = { ...dto };

    if (dto.monthly_income !== undefined && dto.monthly_income !== null) {
      updateData.monthly_income = this.encryptionService.encryptField(
        String(dto.monthly_income),
        this.SCHEMA,
      );
    }

    const updated = this.repo.merge(profile, updateData);
    const result = await this.repo.save(updated);
    this.logger.log(`Perfil financiero actualizado para usuario ID: ${userId}`);
    return this.decryptMonthlyIncome(result);
  }

  async remove(userId: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    await this.repo.remove(profile);
    this.logger.log(`Perfil financiero eliminado para usuario ID: ${userId}`);
  }

  private decryptMonthlyIncome(profile: FinancialProfile): FinancialProfile {
    if (!profile || !profile.monthly_income) {
      return profile;
    }
    const decrypted = this.encryptionService.decryptField(
      profile.monthly_income,
      this.SCHEMA,
    );
    const result = { ...profile };
    (result as Record<string, unknown>).monthly_income = decrypted
      ? Number(decrypted)
      : null;
    return result;
  }
}

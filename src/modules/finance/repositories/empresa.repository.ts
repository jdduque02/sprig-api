import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import { Empresa } from '@finance/entities/empresa.entity';
import { CreateEmpresaDto } from '@finance/dto/empresa/create-empresa.dto';
import { UpdateEmpresaDto } from '@finance/dto/empresa/update-empresa.dto';

@Injectable()
export class EmpresaRepository {
  private readonly logger = new Logger(EmpresaRepository.name);

  constructor(
    @InjectRepository(Empresa)
    private readonly repo: Repository<Empresa>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(userId: number, dto: CreateEmpresaDto): Promise<Empresa> {
    const entity = this.repo.create({
      user_id: userId,
      name: dto.name,
      default_category_id: dto.default_category_id ?? null,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Empresa ID ${saved.id} creada para usuario ID: ${userId}`);
    return saved;
  }

  async findAll(userId: number): Promise<Empresa[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findById(id: number, userId: number): Promise<Empresa> {
    const entity = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!entity)
      throw new NotFoundException(
        this.i18n.t('finance.EMPRESA_NOT_FOUND', { args: { id } }),
      );
    return entity;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateEmpresaDto,
  ): Promise<Empresa> {
    const entity = await this.findById(id, userId);
    const merged = this.repo.merge(entity, dto);
    const saved = await this.repo.save(merged);
    this.logger.log(`Empresa ID ${id} actualizada para usuario ID: ${userId}`);
    return saved;
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const entity = await this.findById(id, userId);
    await this.repo.softRemove(entity);
    this.logger.log(
      `Empresa ID ${id} eliminada (soft) para usuario ID: ${userId}`,
    );
  }

  async findByName(userId: number, name: string): Promise<Empresa | null> {
    return this.repo.findOne({
      where: {
        user_id: userId,
        name: name,
        deleted_at: IsNull(),
      },
    });
  }

  async findByFuzzyName(userId: number, term: string): Promise<Empresa | null> {
    const normalized = term.toLowerCase().trim();
    if (!normalized) return null;
    const empresas = await this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      select: ['id', 'name', 'default_category_id'],
    });
    return (
      empresas.find((e) => e.name.toLowerCase().includes(normalized)) ??
      empresas.find((e) => normalized.includes(e.name.toLowerCase())) ??
      null
    );
  }
}

import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { TransactionCategoryRule } from '@finance/entities/transaction-category-rule.entity';
import { FinancialObjective } from '@finance/entities/financial-objective.entity';
import { Empresa } from '@finance/entities/empresa.entity';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { CreateTransferDto } from '@finance/dto/transaction-record/create-transfer.dto';
import { UpdateTransferDto } from '@finance/dto/transaction-record/update-transfer.dto';
import { CloneTransactionDto } from '@finance/dto/transaction-record/clone-transaction.dto';
import { CloneTransferDto } from '@finance/dto/transaction-record/clone-transfer.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { TransactionSummaryQueryDto } from '@finance/dto/transaction-record/transaction-summary-query.dto';
import { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { EncryptionService } from '@shared/services/encryption.service';
import { applyCompletion } from '@shared/helpers/financial-objective.helper';
import {
  FixedTypeEnum,
  ReviewStatusEnum,
  TransactionTypeEnum,
} from '@shared/enums';

interface SummaryRawRow {
  type: TransactionTypeEnum;
  amount: string;
  count: string;
}

interface CategoryRawRow extends SummaryRawRow {
  category_id: string;
}

interface SeriesRawRow extends SummaryRawRow {
  bucket: string | Date;
}

interface FingerprintRawRow {
  transaction_date: string | Date;
  amount: string;
  description: string;
}

type LinkKind = 'objective' | 'account' | 'asset' | 'liability';

const LINK_KINDS: LinkKind[] = ['objective', 'account', 'asset', 'liability'];

/**
 * Contribución de una transacción sobre el saldo de un vínculo:
 * - objective:  ingreso/inversión suma, gasto resta.
 * - account:    ingreso suma, gasto/inversión resta.
 * - asset:      ingreso/inversión suma, gasto resta.
 * - liability:  cualquier transacción vinculada reduce el saldo (abono).
 */
function contribution(
  tx: Pick<TransactionRecord, 'type' | 'amount'>,
  kind: LinkKind,
): number {
  const amount = Number(tx.amount ?? 0);
  switch (kind) {
    case 'objective':
      return tx.type === TransactionTypeEnum.EXPENSE ? -amount : amount;
    case 'account':
      return tx.type === TransactionTypeEnum.INCOME ? amount : -amount;
    case 'asset':
      return tx.type === TransactionTypeEnum.EXPENSE ? -amount : amount;
    case 'liability':
      return -amount;
  }
}

/**
 * Normaliza la descripción de una transacción para matchear reglas de
 * auto-categorización (minúsculas y espacios colapsados). Consistente con
 * TransactionRecordRepository.fingerprint.
 */
function normalizeDescription(description: string | null): string {
  return String(description ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class TransactionRecordRepository {
  private readonly logger = new Logger(TransactionRecordRepository.name);

  constructor(
    @InjectRepository(TransactionRecord)
    private readonly repo: Repository<TransactionRecord>,
    @InjectRepository(TransactionCategoryRule)
    private readonly ruleRepo: Repository<TransactionCategoryRule>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly encryptionService: EncryptionService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateTransactionRecordDto,
  ): Promise<TransactionRecord> {
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const ruleRepo = manager.getRepository(TransactionCategoryRule);
      const record = recordRepo.create({ ...dto, user_id: userId });

      // Auto-categorización: si el usuario no indicó categoría, se busca una
      // regla aprendida por descripción; si no hay, queda pendiente por editar.
      await this.applyAutoCategory(ruleRepo, record, dto.category_id);

      // Si no hay categoría y hay empresa asignada, usar la categoría por defecto de la empresa
      if (record.category_id == null && dto.company_id != null) {
        const empresaRepo = manager.getRepository(Empresa);
        const empresa = await empresaRepo.findOne({
          where: { id: dto.company_id, user_id: userId, deleted_at: IsNull() },
          select: ['default_category_id'],
        });
        if (empresa?.default_category_id != null) {
          record.category_id = empresa.default_category_id;
          record.category_status = ReviewStatusEnum.CATEGORIZED;
        }
      }

      if (dto.category_id != null) {
        await this.learnRule(
          ruleRepo,
          userId,
          record.description,
          dto.category_id,
          dto.subcategory_id,
        );
      }

      const saved = await recordRepo.save(record);
      await this.applyLinkAdjustments(manager, null, saved);
      this.logger.log(`Transacción creada para usuario ID: ${userId}`);
      return saved;
    });
  }

  /**
   * Creación masiva en una sola transacción (importación de extractos).
   * Ajusta los saldos vinculados de forma agregada (meta/patrimonio).
   * Las transacciones sin categoría se auto-categorizan por descripción;
   * las que no matchean quedan pendientes por editar (NO se aprenden reglas
   * en importaciones para no contaminar el aprendizaje con categorías por
   * defecto).
   */
  async createMany(
    userId: number,
    dtos: CreateTransactionRecordDto[],
    options?: { assignCategories?: boolean },
  ): Promise<TransactionRecord[]> {
    if (dtos.length === 0) return [];
    const assignCategories = options?.assignCategories !== false;
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const ruleRepo = manager.getRepository(TransactionCategoryRule);
      const records = dtos.map((dto) =>
        recordRepo.create({ ...dto, user_id: userId }),
      );

      if (assignCategories) {
        const missing = records
          .filter((r) => r.category_id == null)
          .map((r) => normalizeDescription(r.description));
        const rules = await this.findRulesByDescriptions(
          ruleRepo,
          userId,
          missing,
        );
        for (const record of records) {
          await this.applyAutoCategory(
            ruleRepo,
            record,
            record.category_id,
            rules,
          );
        }
      } else {
        for (const record of records) {
          if (record.category_id == null) {
            record.category_status = ReviewStatusEnum.PENDING;
          } else {
            record.category_status = ReviewStatusEnum.CATEGORIZED;
          }
        }
      }

      // Si no hay categoría y hay empresa asignada, usar la categoría por defecto de la empresa
      const empresaRepo = manager.getRepository(Empresa);
      const empresaCache = new Map<number, number | null>();
      for (const record of records) {
        if (record.category_id == null && record.company_id != null) {
          let defaultCategoryId = empresaCache.get(record.company_id);
          if (!empresaCache.has(record.company_id)) {
            const empresa = await empresaRepo.findOne({
              where: {
                id: record.company_id,
                user_id: userId,
                deleted_at: IsNull(),
              },
              select: ['default_category_id'],
            });
            defaultCategoryId = empresa?.default_category_id ?? null;
            empresaCache.set(record.company_id, defaultCategoryId);
          }
          if (defaultCategoryId != null) {
            record.category_id = defaultCategoryId;
            record.category_status = ReviewStatusEnum.CATEGORIZED;
          }
        }
      }

      const saved = await recordRepo.save(records);
      const net = new Map<string, number>();
      for (const record of saved) {
        this.collectContributions(record, 1, net);
      }
      for (const [key, delta] of net) {
        if (delta === 0) continue;
        const sep = key.indexOf(':');
        const kind = key.slice(0, sep) as LinkKind;
        const id = Number(key.slice(sep + 1));
        await this.applyToEntity(manager, kind, id, delta);
      }
      this.logger.log(
        `${saved.length} transacciones creadas en lote para usuario ID: ${userId}`,
      );
      return saved;
    });
  }

  /**
   * Huella estable para detectar duplicados: fecha + monto + descripción
   * normalizada. Usada por la importación masiva para omitir movimientos ya
   * registrados (misma fecha, monto y descripción).
   */
  static fingerprint(
    transactionDate: string,
    amount: number,
    description: string,
  ): string {
    const desc = String(description ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return `${transactionDate}|${Number(amount)}|${desc}`;
  }

  /**
   * Devuelve las huellas de transacciones existentes del usuario para un
   * conjunto de fechas. Incluye created_at para habilitar partition pruning.
   */
  async findExistingFingerprints(
    userId: number,
    dates: string[],
    since: Date,
  ): Promise<Set<string>> {
    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) return new Set();
    const rows = await this.repo
      .createQueryBuilder('tr')
      .select('tr.transaction_date', 'transaction_date')
      .addSelect('tr.amount', 'amount')
      .addSelect('tr.description', 'description')
      .where('tr.user_id = :userId', { userId })
      .andWhere('tr.deleted_at IS NULL')
      .andWhere('tr.created_at >= :since', { since })
      .andWhere('tr.transaction_date IN (:...dates)', { dates: uniqueDates })
      .getRawMany<FingerprintRawRow>();
    const set = new Set<string>();
    for (const row of rows) {
      set.add(
        TransactionRecordRepository.fingerprint(
          String(row.transaction_date),
          Number(row.amount),
          String(row.description ?? ''),
        ),
      );
    }
    return set;
  }

  async findAll(
    userId: number,
    query: TransactionRecordQueryDto,
  ): Promise<{ data: TransactionRecord[]; total: number }> {
    const {
      category_id,
      category_status,
      uncategorized,
      subcategory_id,
      type,
      date_from,
      date_to,
      objective_id,
      account_id,
      asset_id,
      liability_id,
      company_id,
      page = 1,
      limit = 20,
    } = query;

    // CRÍTICO: Siempre filtrar por user_id y soft-delete. El rango de fechas
    // se aplica sobre transaction_date (fecha de negocio).
    const qb = this.repo
      .createQueryBuilder('tr')
      .where('tr.user_id = :userId', { userId })
      .andWhere('tr.deleted_at IS NULL')
      .orderBy('tr.transaction_date', 'DESC')
      .addOrderBy('tr.id', 'DESC')
      .take(Math.min(limit, 500))
      .skip((page - 1) * limit);

    if (date_from)
      qb.andWhere('tr.transaction_date >= :date_from', { date_from });
    if (date_to) qb.andWhere('tr.transaction_date <= :date_to', { date_to });
    if (category_id)
      qb.andWhere('tr.category_id = :category_id', { category_id });
    if (category_status)
      qb.andWhere('tr.category_status = :category_status', { category_status });
    if (uncategorized === true)
      qb.andWhere('tr.category_status = :pendingStatus', {
        pendingStatus: ReviewStatusEnum.PENDING,
      });
    if (subcategory_id)
      qb.andWhere('tr.subcategory_id = :subcategory_id', { subcategory_id });
    if (type) qb.andWhere('tr.type = :type', { type });
    if (objective_id)
      qb.andWhere('tr.objective_id = :objective_id', { objective_id });
    if (account_id) qb.andWhere('tr.account_id = :account_id', { account_id });
    if (asset_id) qb.andWhere('tr.asset_id = :asset_id', { asset_id });
    if (liability_id)
      qb.andWhere('tr.liability_id = :liability_id', { liability_id });
    if (company_id) qb.andWhere('tr.company_id = :company_id', { company_id });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: number, userId: number): Promise<TransactionRecord> {
    const record = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!record)
      throw new NotFoundException(
        this.i18n.t('finance.TRANSACTION_NOT_FOUND', { args: { id } }),
      );
    return record;
  }

  /**
   * CRÍTICO: query para el scheduler de recordatorios.
   * SIEMPRE incluye created_at en el WHERE para habilitar partition pruning.
   */
  async findFixedForReminders(fromDate: Date): Promise<TransactionRecord[]> {
    return this.repo
      .createQueryBuilder('tr')
      .where('tr.deleted_at IS NULL')
      .andWhere('tr.is_fixed = TRUE')
      .andWhere('tr.due_day IS NOT NULL')
      .andWhere('tr.created_at >= :from', { from: fromDate })
      .getMany();
  }

  /**
   * Suscripciones (deducciones fijas) del usuario para calcular el próximo
   * pago. Incluye created_at para partition pruning.
   */
  async findUpcomingSubscriptions(
    userId: number,
    fromDate: Date,
  ): Promise<TransactionRecord[]> {
    return this.repo
      .createQueryBuilder('tr')
      .where('tr.user_id = :userId', { userId })
      .andWhere('tr.deleted_at IS NULL')
      .andWhere('tr.is_fixed = TRUE')
      .andWhere('tr.fixed_type = :fixedType', {
        fixedType: FixedTypeEnum.DEDUCTION,
      })
      .andWhere('tr.due_day IS NOT NULL')
      .andWhere('tr.created_at >= :from', { from: fromDate })
      .getMany();
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateTransactionRecordDto,
  ): Promise<TransactionRecord> {
    const old = await this.findById(id, userId);
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const ruleRepo = manager.getRepository(TransactionCategoryRule);
      const { apply_to_similar, ...fields } = dto;

      // merge() muta `old` en su lugar; por eso tomamos un snapshot del
      // estado anterior ANTES de mezclar, para que applyLinkAdjustments
      // pueda revertir los vínculos previos y aplicar los nuevos.
      const previous = { ...old };
      const merged = recordRepo.merge(old, fields);

      // Si el usuario asigna categoría manualmente:
      //  1. Se aprende la regla (descripción normalizada -> categoría).
      //  2. Si apply_to_similar, se propaga a transacciones con la misma
      //     descripción (actualización en cadena).
      const newCategoryId = fields.category_id ?? previous.category_id;
      if (newCategoryId != null && merged.description) {
        const normalized = normalizeDescription(merged.description);
        if (normalized) {
          await this.upsertRule(
            ruleRepo,
            userId,
            normalized,
            newCategoryId,
            fields.subcategory_id ?? previous.subcategory_id ?? null,
          );
          if (apply_to_similar === true) {
            await recordRepo
              .createQueryBuilder()
              .update(TransactionRecord)
              .set({
                category_id: newCategoryId,
                subcategory_id:
                  fields.subcategory_id ?? previous.subcategory_id ?? null,
                category_status: ReviewStatusEnum.CATEGORIZED,
              })
              .where('user_id = :userId', { userId })
              .andWhere('deleted_at IS NULL')
              .andWhere('lower(description) = :normalized', { normalized })
              .andWhere('id != :id', { id })
              .execute();
            this.logger.log(
              `Actualización en cadena para descripción "${normalized}" del usuario ID: ${userId}`,
            );
          }
        }
      }

      // Si no hay categoría, se intenta auto-categorizar; si no matchea
      // ninguna regla queda pendiente por editar.
      await this.applyAutoCategory(ruleRepo, merged, newCategoryId);

      // Si no hay categoría y hay empresa asignada, usar la categoría por defecto de la empresa
      if (merged.category_id == null && merged.company_id != null) {
        const empresaRepo = manager.getRepository(Empresa);
        const empresa = await empresaRepo.findOne({
          where: {
            id: merged.company_id,
            user_id: userId,
            deleted_at: IsNull(),
          },
          select: ['default_category_id'],
        });
        if (empresa?.default_category_id != null) {
          merged.category_id = empresa.default_category_id;
          merged.category_status = ReviewStatusEnum.CATEGORIZED;
        }
      }

      const saved = await recordRepo.save(merged);
      await this.applyLinkAdjustments(manager, previous, saved);
      this.logger.log(
        `Transacción ID ${id} actualizada para usuario ID: ${userId}`,
      );
      return saved;
    });
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const old = await this.findById(id, userId);
    // Si la transacción es un miembro de una transferencia, eliminar el par
    // completo (origen + destino) para no dejar registros huérfanos.
    if (old.transfer_group_id) {
      await this.softDeleteTransfer(id, userId);
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(TransactionRecord).softRemove(old);
      await this.applyLinkAdjustments(manager, old, null);
    });
    this.logger.log(
      `Transacción ID ${id} eliminada (soft) para usuario ID: ${userId}`,
    );
  }

  /**
   * Eliminación masiva (soft delete) dentro de una sola transacción.
   * Ajusta los saldos vinculados de forma agregada. Devuelve cuántas
   * transacciones se eliminaron realmente.
   */
  async softDeleteMany(ids: number[], userId: number): Promise<number> {
    if (ids.length === 0) return 0;
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      let records = await recordRepo.find({
        where: { id: In(ids), user_id: userId, deleted_at: IsNull() },
      });
      if (records.length === 0) {
        throw new NotFoundException(
          this.i18n.t('finance.TRANSACTION_NOT_FOUND', {
            args: { id: ids[0] },
          }),
        );
      }

      // Expandir pares de transferencia: si un miembro del par está en la
      // selección, eliminar también su gemelo para no dejar huérfanos.
      const transferGroupIds = records
        .map((r) => r.transfer_group_id)
        .filter((g): g is string => !!g);
      if (transferGroupIds.length > 0) {
        const siblings = await recordRepo.find({
          where: {
            transfer_group_id: In(transferGroupIds),
            user_id: userId,
            deleted_at: IsNull(),
          },
        });
        records = Array.from(new Map(siblings.map((r) => [r.id, r])).values());
      }

      const net = new Map<string, number>();
      for (const record of records) {
        this.collectContributions(record, -1, net);
      }
      await recordRepo.softRemove(records);
      for (const [key, delta] of net) {
        if (delta === 0) continue;
        const sep = key.indexOf(':');
        const kind = key.slice(0, sep) as LinkKind;
        const id = Number(key.slice(sep + 1));
        await this.applyToEntity(manager, kind, id, delta);
      }
      this.logger.log(
        `${records.length} transacciones eliminadas (soft, masivo) para usuario ID: ${userId}`,
      );
      return records.length;
    });
  }

  /**
   * Movimiento bancario (transferencia): crea un PAR de transacciones
   * ligadas por `transfer_group_id` dentro de una única transacción atómica.
   *   - registro origen:  origin_account_id = cuenta origen  (debita)
   *   - registro destino: destination_account_id = cuenta destino (acredita)
   *     O destination_liability_id = pasivo destino (tarjeta de crédito)
   * Ajusta el saldo cifrado de ambas entidades (origen -monto, destino +monto).
   */
  async createTransfer(
    userId: number,
    dto: CreateTransferDto,
  ): Promise<TransactionRecord[]> {
    const hasDestAccount = dto.destination_account_id != null;
    const hasDestLiability = dto.destination_liability_id != null;
    if (!hasDestAccount && !hasDestLiability) {
      throw new BadRequestException(
        this.i18n.t('finance.TRANSFER_DESTINATION_REQUIRED'),
      );
    }
    if (hasDestAccount && hasDestLiability) {
      throw new BadRequestException(
        this.i18n.t('finance.TRANSFER_INVALID_DESTINATION'),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const accountRepo = manager.getRepository(BankAccount);

      const source = await accountRepo.findOneBy({
        id: dto.source_account_id,
        user_id: userId,
        deleted_at: IsNull(),
      });
      if (!source) {
        throw new NotFoundException(
          this.i18n.t('finance.TRANSFER_ACCOUNT_NOT_FOUND'),
        );
      }

      let destinationAccount: BankAccount | null = null;
      let destinationLiability: FinancialLiability | null = null;

      if (hasDestAccount) {
        destinationAccount = await accountRepo.findOneBy({
          id: dto.destination_account_id,
          user_id: userId,
          deleted_at: IsNull(),
        });
        if (!destinationAccount) {
          throw new NotFoundException(
            this.i18n.t('finance.TRANSFER_ACCOUNT_NOT_FOUND'),
          );
        }
      } else {
        const liabilityRepo = manager.getRepository(FinancialLiability);
        destinationLiability = await liabilityRepo.findOneBy({
          id: dto.destination_liability_id,
          user_id: userId,
          deleted_at: IsNull(),
        });
        if (!destinationLiability) {
          throw new NotFoundException(
            this.i18n.t('finance.LIABILITY_NOT_FOUND', {
              args: { id: dto.destination_liability_id },
            }),
          );
        }
      }

      const groupId = randomUUID();
      const transactionDate =
        dto.transaction_date ?? new Date().toISOString().slice(0, 10);
      const base: Partial<TransactionRecord> = {
        user_id: userId,
        type: TransactionTypeEnum.TRANSFER,
        amount: dto.amount,
        currency: source.currency ?? 'COP',
        transfer_group_id: groupId,
        transaction_date: transactionDate as unknown as Date,
        description: dto.description ?? 'Movimiento entre cuentas',
        reference_code: dto.reference_code,
        category_status: ReviewStatusEnum.CATEGORIZED,
        source_account: source.account_type,
        source_bank: source.bank_name,
        company_id: dto.company_id ?? null,
        is_fixed: dto.is_fixed ?? false,
        ...(dto.fixed_type != null ? { fixed_type: dto.fixed_type } : {}),
        ...(dto.frequency != null ? { frequency: dto.frequency } : {}),
        due_day: dto.due_day ?? null,
        reminder_days: dto.reminder_days ?? null,
      };

      let destAccountType: string | null = null;
      let destBankName: string | null = null;
      if (destinationAccount) {
        destAccountType = destinationAccount.account_type;
        destBankName = destinationAccount.bank_name;
      } else if (destinationLiability) {
        destAccountType = destinationLiability.liability_type;
        destBankName = destinationLiability.name;
      }

      const origin = recordRepo.create({
        ...base,
        origin_account_id: dto.source_account_id,
      });
      const destinationData: DeepPartial<TransactionRecord> = {
        ...base,
        destination_account: destAccountType ?? undefined,
        destination_bank: destBankName ?? undefined,
        objective_id: dto.objective_id,
      };
      if (hasDestAccount) {
        destinationData.destination_account_id = dto.destination_account_id;
      } else {
        destinationData.liability_id = dto.destination_liability_id;
      }
      const destinationRecord = recordRepo.create(destinationData);

      const savedOrigin = await recordRepo.save(origin);
      const savedDestination = await recordRepo.save(destinationRecord);
      await this.applyTransferAdjustment(manager, savedOrigin, 1);
      await this.applyTransferAdjustment(manager, savedDestination, 1);

      this.logger.log(
        `Transferencia ${groupId} creada para usuario ID: ${userId}`,
      );
      return [savedOrigin, savedDestination];
    });
  }

  /**
   * Devuelve el par de transacciones ligadas de una transferencia. El id puede
   * pertenecer a cualquiera de los dos movimientos (origen o destino).
   */
  async findTransferById(
    id: number,
    userId: number,
  ): Promise<TransactionRecord[]> {
    const record = await this.repo.findOne({
      where: {
        id,
        user_id: userId,
        deleted_at: IsNull(),
        type: TransactionTypeEnum.TRANSFER,
      },
    });
    if (!record)
      throw new NotFoundException(
        this.i18n.t('finance.TRANSFER_NOT_FOUND', { args: { id } }),
      );
    if (!record.transfer_group_id) return [record];
    const siblings = await this.repo.find({
      where: {
        transfer_group_id: record.transfer_group_id,
        user_id: userId,
        deleted_at: IsNull(),
      },
      order: { id: 'ASC' },
    });
    return siblings;
  }

  /** Lista paginada de transferencias (cualquier miembro del par). */
  async findTransfers(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: TransactionRecord[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('tr')
      .where('tr.user_id = :userId', { userId })
      .andWhere('tr.deleted_at IS NULL')
      .andWhere('tr.type = :type', { type: TransactionTypeEnum.TRANSFER })
      .andWhere('tr.transfer_group_id IS NOT NULL')
      .orderBy('tr.transaction_date', 'DESC')
      .addOrderBy('tr.id', 'DESC')
      .take(Math.min(limit, 500))
      .skip((page - 1) * limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /** Actualiza monto/fecha/descripción de ambos movimientos de la transferencia. */
  async updateTransfer(
    id: number,
    userId: number,
    dto: UpdateTransferDto,
  ): Promise<TransactionRecord[]> {
    const records = await this.findTransferById(id, userId);
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      for (const record of records) {
        await this.applyTransferAdjustment(manager, record, -1);
      }
      const fields: Partial<TransactionRecord> = {};
      if (dto.amount !== undefined) fields.amount = dto.amount;
      if (dto.transaction_date !== undefined)
        fields.transaction_date = dto.transaction_date as unknown as Date;
      if (dto.description !== undefined) fields.description = dto.description;
      if (dto.reference_code !== undefined)
        fields.reference_code = dto.reference_code;
      if (dto.is_fixed !== undefined) fields.is_fixed = dto.is_fixed;
      if (dto.fixed_type !== undefined) fields.fixed_type = dto.fixed_type;
      if (dto.frequency !== undefined) fields.frequency = dto.frequency;
      if (dto.due_day !== undefined) fields.due_day = dto.due_day;
      if (dto.reminder_days !== undefined)
        fields.reminder_days = dto.reminder_days;
      for (const record of records) {
        const merged = recordRepo.merge(record, fields);
        if (
          dto.objective_id !== undefined &&
          record.destination_account_id != null
        ) {
          merged.objective_id = dto.objective_id ?? null;
        }
        const saved = await recordRepo.save(merged);
        await this.applyTransferAdjustment(manager, saved, 1);
      }
      return records;
    });
  }

  /** Borrado lógico de la transferencia completa (revierte saldos de ambos). */
  async softDeleteTransfer(id: number, userId: number): Promise<void> {
    const records = await this.findTransferById(id, userId);
    await this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      for (const record of records) {
        await this.applyTransferAdjustment(manager, record, -1);
        await recordRepo.softRemove(record);
      }
    });
    this.logger.log(
      `Transferencia ID ${id} eliminada (soft) para usuario ID: ${userId}`,
    );
  }

  /**
   * Aplica el efecto de una transferencia sobre el saldo de sus cuentas y la
   * meta vinculada: origen debita (-monto), destino acredita (+monto) y la meta
   * vinculada se abona (+monto). `sign = -1` revierte.
   */
  private async applyTransferAdjustment(
    manager: EntityManager,
    tx: TransactionRecord,
    sign: 1 | -1,
  ): Promise<void> {
    const amount = Number(tx.amount ?? 0);
    if (tx.origin_account_id != null) {
      await this.applyToEntity(
        manager,
        'account',
        tx.origin_account_id,
        -amount * sign,
      );
    }
    if (tx.destination_account_id != null) {
      await this.applyToEntity(
        manager,
        'account',
        tx.destination_account_id,
        amount * sign,
      );
    }
    if (tx.liability_id != null) {
      await this.applyToEntity(
        manager,
        'liability',
        tx.liability_id,
        -amount * sign,
      );
    }
    if (tx.objective_id != null) {
      await this.applyToEntity(
        manager,
        'objective',
        tx.objective_id,
        amount * sign,
      );
    }
  }

  /**
   * Auto-categorización por descripción. Si `explicitCategoryId` está
   * definido se usa y la transacción queda categorizada. Si no, se busca
   * una regla aprendida; si no hay, queda pendiente por editar.
   * Opcionalmente se puede pasar un mapa de reglas pre-cargado para
   * evitar N+1 en lotes.
   */
  private async applyAutoCategory(
    ruleRepo: Repository<TransactionCategoryRule>,
    record: Partial<TransactionRecord> & { category_status?: ReviewStatusEnum },
    explicitCategoryId?: number | null,
    preloaded?: Map<
      string,
      { category_id: number; subcategory_id: number | null }
    >,
  ): Promise<void> {
    if (explicitCategoryId != null) {
      record.category_id = explicitCategoryId;
      record.category_status = ReviewStatusEnum.CATEGORIZED;
      return;
    }

    const normalized = normalizeDescription(record.description ?? null);
    if (!normalized) {
      record.category_id = null;
      record.category_status = ReviewStatusEnum.PENDING;
      return;
    }

    let rule:
      | { category_id: number; subcategory_id: number | null }
      | null
      | undefined = preloaded?.get(normalized);
    if (!rule) {
      rule = await ruleRepo.findOne({
        where: { user_id: record.user_id, normalized_description: normalized },
        select: ['category_id', 'subcategory_id'],
      });
    }

    if (rule) {
      record.category_id = rule.category_id;
      record.subcategory_id = rule.subcategory_id ?? null;
      record.category_status = ReviewStatusEnum.CATEGORIZED;
    } else {
      record.category_id = null;
      record.category_status = ReviewStatusEnum.PENDING;
    }
  }

  /** Carga reglas de auto-categorización para un conjunto de descripciones. */
  private async findRulesByDescriptions(
    ruleRepo: Repository<TransactionCategoryRule>,
    userId: number,
    normalizedDescriptions: string[],
  ): Promise<
    Map<string, { category_id: number; subcategory_id: number | null }>
  > {
    const unique = [...new Set(normalizedDescriptions.filter((d) => d))];
    if (unique.length === 0) return new Map();
    const rules = await ruleRepo.find({
      where: {
        user_id: userId,
        normalized_description: In(unique),
      },
      select: ['normalized_description', 'category_id', 'subcategory_id'],
    });
    return new Map(
      rules.map((r) => [
        r.normalized_description,
        { category_id: r.category_id, subcategory_id: r.subcategory_id },
      ]),
    );
  }

  /** Aprende (upsert) una regla descripción normalizada -> categoría. */
  private async upsertRule(
    ruleRepo: Repository<TransactionCategoryRule>,
    userId: number,
    normalized: string,
    categoryId: number,
    subcategoryId: number | null,
  ): Promise<void> {
    await ruleRepo.upsert(
      {
        user_id: userId,
        normalized_description: normalized,
        category_id: categoryId,
        subcategory_id: subcategoryId,
      },
      ['user_id', 'normalized_description'],
    );
  }

  private async learnRule(
    ruleRepo: Repository<TransactionCategoryRule>,
    userId: number,
    description: string | null | undefined,
    categoryId: number,
    subcategoryId?: number,
  ): Promise<void> {
    const normalized = normalizeDescription(description ?? null);
    if (!normalized) return;
    await this.upsertRule(
      ruleRepo,
      userId,
      normalized,
      categoryId,
      subcategoryId ?? null,
    );
  }

  /**
   * Ajusta los saldos de las entidades vinculadas (meta/patrimonio) de forma
   * atómica junto con la transacción. Revertir el efecto del estado anterior
   * y aplicar el del nuevo, dentro de la misma transacción de BD.
   */
  private async applyLinkAdjustments(
    manager: EntityManager,
    old: TransactionRecord | null,
    updated: TransactionRecord | null,
  ): Promise<void> {
    const net = new Map<string, number>();
    this.collectContributions(old, -1, net);
    this.collectContributions(updated, 1, net);

    for (const [key, delta] of net) {
      if (delta === 0) continue;
      const sep = key.indexOf(':');
      const kind = key.slice(0, sep) as LinkKind;
      const id = Number(key.slice(sep + 1));
      await this.applyToEntity(manager, kind, id, delta);
    }
  }

  private collectContributions(
    tx: TransactionRecord | null,
    sign: number,
    net: Map<string, number>,
  ): void {
    if (!tx) return;
    for (const kind of LINK_KINDS) {
      const id = tx[`${kind}_id` as keyof TransactionRecord] as
        number | null | undefined;
      if (id == null) continue;
      const key = `${kind}:${id}`;
      net.set(key, (net.get(key) ?? 0) + sign * contribution(tx, kind));
    }
  }

  private async applyToEntity(
    manager: EntityManager,
    kind: LinkKind,
    id: number,
    delta: number,
  ): Promise<void> {
    switch (kind) {
      case 'account': {
        const account = await manager
          .getRepository(BankAccount)
          .findOneBy({ id });
        if (!account) return;
        const current = Number(
          account.encrypted_balance
            ? this.encryptionService.decryptField(
                account.encrypted_balance,
                'banking',
              )
            : '0',
        );
        const next = current + delta;
        if (next < 0) {
          throw new BadRequestException({
            code: 'NEGATIVE_BALANCE_NOT_ALLOWED',
            account_id: account.id,
            name: account.bank_name ?? 'cuenta',
            current,
            amount: Math.abs(delta),
            message: this.i18n.t('finance.NEGATIVE_BALANCE_NOT_ALLOWED', {
              args: {
                name: account.bank_name ?? 'cuenta',
                current: String(current),
                amount: String(Math.abs(delta)),
              },
            }),
          });
        }
        account.encrypted_balance = this.encryptionService.encryptField(
          String(next),
          'banking',
        );
        await manager.getRepository(BankAccount).save(account);
        return;
      }
      case 'objective': {
        const objective = await manager
          .getRepository(FinancialObjective)
          .findOneBy({ id });
        if (!objective) return;
        objective.current_balance =
          Number(objective.current_balance ?? 0) + delta;
        applyCompletion(objective);
        await manager.getRepository(FinancialObjective).save(objective);
        return;
      }
      case 'asset': {
        const asset = await manager
          .getRepository(FinancialAsset)
          .findOneBy({ id });
        if (!asset) return;
        asset.current_value = Number(asset.current_value ?? 0) + delta;
        await manager.getRepository(FinancialAsset).save(asset);
        return;
      }
      case 'liability': {
        const liability = await manager
          .getRepository(FinancialLiability)
          .findOneBy({ id });
        if (!liability) return;
        liability.current_balance =
          Number(liability.current_balance ?? 0) + delta;
        await manager.getRepository(FinancialLiability).save(liability);
        return;
      }
    }
  }

  /**
   * Clona una transacción existente creando una nueva con los campos copiados.
   * Permite sobreescribir fecha, monto, descripción, categoría y empresa.
   * Si la transacción original es parte de una transferencia, lanza BadRequest.
   */
  async clone(
    id: number,
    userId: number,
    dto: CloneTransactionDto,
  ): Promise<TransactionRecord> {
    const original = await this.findById(id, userId);
    if (original.transfer_group_id) {
      throw new BadRequestException(
        this.i18n.t('finance.CLONE_TRANSFER_NOT_ALLOWED'),
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const ruleRepo = manager.getRepository(TransactionCategoryRule);

      const cloned = recordRepo.create({
        user_id: userId,
        category_id: dto.category_id ?? original.category_id,
        subcategory_id: original.subcategory_id,
        type: original.type,
        amount: dto.amount ?? original.amount,
        currency: original.currency,
        is_fixed: original.is_fixed,
        fixed_type: original.fixed_type,
        frequency: original.frequency,
        due_day: original.due_day,
        reminder_days: original.reminder_days,
        payment_method: original.payment_method,
        description: dto.description ?? original.description,
        reference_code: original.reference_code,
        attachments: original.attachments,
        source_account: original.source_account,
        destination_account: original.destination_account,
        source_bank: original.source_bank,
        destination_bank: original.destination_bank,
        addressee: original.addressee,
        transaction_date: dto.transaction_date ?? original.transaction_date,
        objective_id: original.objective_id,
        account_id: original.account_id,
        asset_id: original.asset_id,
        liability_id: original.liability_id,
        company_id: dto.company_id ?? original.company_id,
        origin_account_id: original.origin_account_id,
        destination_account_id: original.destination_account_id,
        source: original.source,
        category_status: ReviewStatusEnum.CATEGORIZED,
      });

      const clonedCategoryId = dto.category_id ?? original.category_id;
      await this.applyAutoCategory(ruleRepo, cloned, clonedCategoryId);

      if (cloned.category_id == null && cloned.company_id != null) {
        const empresaRepo = manager.getRepository(Empresa);
        const empresa = await empresaRepo.findOne({
          where: {
            id: cloned.company_id,
            user_id: userId,
            deleted_at: IsNull(),
          },
          select: ['default_category_id'],
        });
        if (empresa?.default_category_id != null) {
          cloned.category_id = empresa.default_category_id;
          cloned.category_status = ReviewStatusEnum.CATEGORIZED;
        }
      }

      const saved = await recordRepo.save(cloned);
      await this.applyLinkAdjustments(manager, null, saved);
      this.logger.log(
        `Transacción ID ${id} clonada como ID ${saved.id} para usuario ID: ${userId}`,
      );
      return saved;
    });
  }

  /**
   * Clona una transferencia (par de movimientos). El id puede pertenecer a
   * cualquiera de las piernas. Crea un nuevo par con un transfer_group_id
   * distinto y aplica los ajustes de saldo.
   *
   * Si el par está incompleto (p. ej. una pierna fue eliminada), clona las
   * piernas que existan conservando su tipo (origen debita, destino acredita)
   * en lugar de lanzar un error.
   */
  async cloneTransfer(
    id: number,
    userId: number,
    dto: CloneTransferDto,
  ): Promise<TransactionRecord[]> {
    const records = await this.findTransferById(id, userId);
    if (records.length === 0) {
      throw new NotFoundException(
        this.i18n.t('finance.TRANSFER_NOT_FOUND', { args: { id } }),
      );
    }

    const template =
      records.find((r) => r.origin_account_id != null) ??
      records.find(
        (r) => r.destination_account_id != null || r.liability_id != null,
      ) ??
      records[0];
    const originalAmount = Number(template.amount ?? 0);
    const newAmount = dto.amount ?? originalAmount;
    const newDate = dto.transaction_date ?? template.transaction_date;
    const newDescription = dto.description ?? template.description;
    const newGroupId = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(TransactionRecord);
      const saved: TransactionRecord[] = [];

      for (const record of records) {
        const clonedData: DeepPartial<TransactionRecord> = {
          user_id: userId,
          type: TransactionTypeEnum.TRANSFER,
          amount: newAmount,
          currency: template.currency ?? 'COP',
          transfer_group_id: newGroupId,
          transaction_date: newDate as unknown as Date,
          description: newDescription,
          reference_code: template.reference_code,
          category_status: ReviewStatusEnum.CATEGORIZED,
          company_id: template.company_id,
          is_fixed: template.is_fixed,
          fixed_type: template.fixed_type,
          frequency: template.frequency,
          due_day: template.due_day,
          reminder_days: template.reminder_days,
        };

        if (record.origin_account_id != null) {
          clonedData.origin_account_id = record.origin_account_id;
          clonedData.source_account = record.source_account;
          clonedData.source_bank = record.source_bank;
        } else {
          clonedData.source_account = template.source_account;
          clonedData.source_bank = template.source_bank;
        }

        if (record.destination_account_id != null) {
          clonedData.destination_account_id = record.destination_account_id;
          clonedData.destination_account = record.destination_account;
          clonedData.destination_bank = record.destination_bank;
          clonedData.objective_id = record.objective_id;
        } else if (record.liability_id != null) {
          clonedData.liability_id = record.liability_id;
          clonedData.destination_account = record.destination_account;
          clonedData.destination_bank = record.destination_bank;
          clonedData.objective_id = record.objective_id;
        }

        const savedRecord = await recordRepo.save(
          recordRepo.create(clonedData),
        );
        await this.applyTransferAdjustment(manager, savedRecord, 1);
        saved.push(savedRecord);
      }

      this.logger.log(
        `Transferencia ${newGroupId} clonada desde ${id} (${saved.length} piernas) para usuario ID: ${userId}`,
      );
      return saved;
    });
  }

  /**
   * Lista empresas del usuario para uso interno (summary, imports).
   */
  async findEmpresasForUser(
    userId: number,
  ): Promise<{ id: number; name: string }[]> {
    const repo = this.dataSource.getRepository(Empresa);
    return repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      select: ['id', 'name'],
    });
  }

  /**
   * Resumen/agregación por intervalos de tiempo. Agrupa por transaction_date
   * (día/semana/mes) y devuelve totales + desglose por categoría.
   */
  async getSummary(
    userId: number,
    query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummaryResponseDto> {
    const { date_from, date_to, group_by = 'day', type } = query;

    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}-01`;
    const defaultTo = now.toISOString().slice(0, 10);
    const from = date_from ?? defaultFrom;
    const to = date_to ?? defaultTo;

    const applyFilters = (qb: SelectQueryBuilder<TransactionRecord>) => {
      qb.where('tr.user_id = :userId', { userId })
        .andWhere('tr.deleted_at IS NULL')
        .andWhere('tr.transaction_date >= :from', { from })
        .andWhere('tr.transaction_date <= :to', { to });
      if (type) qb.andWhere('tr.type = :type', { type });
      return qb;
    };

    const totalsRaw = await applyFilters(
      this.repo
        .createQueryBuilder('tr')
        .select('tr.type', 'type')
        .addSelect('COALESCE(SUM(tr.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count'),
    )
      .groupBy('tr.type')
      .getRawMany<SummaryRawRow>();

    const categoryRaw = await applyFilters(
      this.repo
        .createQueryBuilder('tr')
        .select('tr.category_id', 'category_id')
        .addSelect('tr.type', 'type')
        .addSelect('COALESCE(SUM(tr.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count'),
    )
      .groupBy('tr.category_id')
      .addGroupBy('tr.type')
      .getRawMany<CategoryRawRow>();

    const seriesRaw = await applyFilters(
      this.repo
        .createQueryBuilder('tr')
        .select('DATE_TRUNC(:trunc, tr.transaction_date)::date', 'bucket')
        .addSelect('tr.type', 'type')
        .addSelect('COALESCE(SUM(tr.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count'),
    )
      .setParameter('trunc', group_by)
      .groupBy('DATE_TRUNC(:trunc, tr.transaction_date)::date')
      .addGroupBy('tr.type')
      .orderBy('DATE_TRUNC(:trunc, tr.transaction_date)::date', 'ASC')
      .getRawMany<SeriesRawRow>();

    const companyRaw = await applyFilters(
      this.repo
        .createQueryBuilder('tr')
        .select('tr.company_id', 'company_id')
        .addSelect('COALESCE(SUM(tr.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .andWhere('tr.type = :type', { type: TransactionTypeEnum.EXPENSE })
        .andWhere('tr.company_id IS NOT NULL'),
    )
      .groupBy('tr.company_id')
      .getRawMany<{ company_id: string; amount: string; count: string }>();

    const totals = { income: 0, expenses: 0, investments: 0, count: 0 };
    for (const row of totalsRaw) {
      if (row.type === TransactionTypeEnum.TRANSFER) continue;
      const amount = Number(row.amount ?? 0);
      const count = Number(row.count ?? 0);
      totals.count += count;
      if (row.type === TransactionTypeEnum.INCOME) totals.income += amount;
      else if (row.type === TransactionTypeEnum.EXPENSE)
        totals.expenses += amount;
      else if (row.type === TransactionTypeEnum.INVESTMENT)
        totals.investments += amount;
    }

    const categoryMap = new Map<
      number,
      {
        category_id: number;
        income: number;
        expenses: number;
        investments: number;
        count: number;
      }
    >();
    for (const row of categoryRaw) {
      if (row.type === TransactionTypeEnum.TRANSFER) continue;
      const categoryId = Number(row.category_id);
      const amount = Number(row.amount ?? 0);
      const count = Number(row.count ?? 0);
      const entry = categoryMap.get(categoryId) ?? {
        category_id: categoryId,
        income: 0,
        expenses: 0,
        investments: 0,
        count: 0,
      };
      entry.count += count;
      if (row.type === TransactionTypeEnum.INCOME) entry.income += amount;
      else if (row.type === TransactionTypeEnum.EXPENSE)
        entry.expenses += amount;
      else if (row.type === TransactionTypeEnum.INVESTMENT)
        entry.investments += amount;
      categoryMap.set(categoryId, entry);
    }
    const by_category = Array.from(categoryMap.values()).sort(
      (a, b) => b.expenses - a.expenses || b.income - a.income,
    );

    const seriesMap = new Map<
      string,
      {
        key: string;
        label: string;
        income: number;
        expenses: number;
        investments: number;
        count: number;
      }
    >();
    for (const row of seriesRaw) {
      if (row.type === TransactionTypeEnum.TRANSFER) continue;
      // pg devuelve el tipo DATE (OID 1082) como objeto Date, no como string
      // "YYYY-MM-DD"; por eso no podemos depender de slice(0,10) sobre String().
      const rawBucket = row.bucket;
      const key =
        rawBucket instanceof Date
          ? `${rawBucket.getFullYear()}-${String(rawBucket.getMonth() + 1).padStart(2, '0')}-${String(rawBucket.getDate()).padStart(2, '0')}`
          : String(rawBucket ?? '').slice(0, 10);
      const amount = Number(row.amount ?? 0);
      const count = Number(row.count ?? 0);
      const entry = seriesMap.get(key) ?? {
        key,
        label: this.formatBucketLabel(key, group_by),
        income: 0,
        expenses: 0,
        investments: 0,
        count: 0,
      };
      entry.count += count;
      if (row.type === TransactionTypeEnum.INCOME) entry.income += amount;
      else if (row.type === TransactionTypeEnum.EXPENSE)
        entry.expenses += amount;
      else if (row.type === TransactionTypeEnum.INVESTMENT)
        entry.investments += amount;
      seriesMap.set(key, entry);
    }
    const series = Array.from(seriesMap.values());

    const empresaNames = new Map<number, string>();
    const empresaIds = companyRaw.map((r) => Number(r.company_id));
    if (empresaIds.length > 0) {
      const empresas = await this.findEmpresasForUser(userId);
      for (const e of empresas) {
        if (empresaIds.includes(e.id)) empresaNames.set(e.id, e.name);
      }
    }
    const by_company = companyRaw.map((row) => {
      const companyId = Number(row.company_id);
      const expenses = Number(row.amount ?? 0);
      const count = Number(row.count ?? 0);
      const percentOfTotal =
        totals.expenses > 0
          ? Math.round((expenses / totals.expenses) * 10000) / 100
          : 0;
      return {
        company_id: companyId,
        company_name: empresaNames.get(companyId) ?? null,
        expenses,
        count,
        percent_of_total: percentOfTotal,
      };
    });

    return {
      date_from: from,
      date_to: to,
      group_by,
      totals,
      by_category,
      series,
      by_company,
    };
  }

  private formatBucketLabel(key: string, groupBy: string): string {
    const date = new Date(`${key}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return key;
    if (groupBy === 'month') {
      return date.toLocaleDateString('es-CO', {
        month: 'short',
        year: 'numeric',
      });
    }
    if (groupBy === 'week') {
      return `Sem ${date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
      })}`;
    }
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
    });
  }
}

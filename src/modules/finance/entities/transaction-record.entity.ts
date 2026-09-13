import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FixedTypeEnum,
  FrequencyEnum,
  PaymentMethodEnum,
  ReviewStatusEnum,
  TransactionTypeEnum,
} from '@shared/enums';

/**
 * CRÍTICO: Esta tabla está PARTICIONADA por RANGE(created_at) — trimestral.
 * SIEMPRE incluir created_at en el WHERE para habilitar partition pruning.
 * Soft delete obligatorio — nunca eliminar físicamente registros.
 */
@Entity({ name: 'transaction_record', schema: 'finance' })
@Index('idx_transaction_user_created', ['user_id', 'created_at'])
@Index('idx_transaction_user_date', ['user_id', 'transaction_date'])
@Index('idx_transaction_category', ['category_id'])
@Index('idx_transaction_type', ['type'])
@Index('idx_transaction_objective', ['objective_id'])
@Index('idx_transaction_account', ['account_id'])
@Index('idx_transaction_asset', ['asset_id'])
@Index('idx_transaction_liability', ['liability_id'])
@Index('idx_transaction_company', ['company_id'])
@Index('idx_transaction_category_status', ['user_id', 'category_status'])
@Index('idx_transaction_description', ['user_id', 'description'])
@Index('idx_transaction_transfer_group', ['transfer_group_id'])
@Index('idx_transaction_source', ['user_id', 'source'])
@Index('idx_transaction_origin_account', ['origin_account_id'])
@Index('idx_transaction_destination_account', ['destination_account_id'])
export class TransactionRecord {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_transaction_user')
  user_id!: number;

  @Column({ type: 'bigint', nullable: true })
  category_id!: number | null;

  @Column({
    type: 'enum',
    enum: ReviewStatusEnum,
    enumName: 'review_status_enum',
    default: ReviewStatusEnum.CATEGORIZED,
  })
  category_status!: ReviewStatusEnum;

  @Column({ type: 'smallint', nullable: true })
  installments!: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  installment_value!: number | null;

  @Column({ type: 'bigint', nullable: true })
  subcategory_id!: number | null;

  @Column({
    type: 'enum',
    enum: TransactionTypeEnum,
    enumName: 'transaction_type_enum',
  })
  type!: TransactionTypeEnum;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency!: string;

  @Column({ type: 'boolean', default: false })
  is_fixed!: boolean;

  @Column({
    type: 'enum',
    enum: FixedTypeEnum,
    enumName: 'fixed_type_enum',
    nullable: true,
  })
  fixed_type!: FixedTypeEnum;

  @Column({
    type: 'enum',
    enum: FrequencyEnum,
    enumName: 'frequency_enum',
    nullable: true,
  })
  frequency!: FrequencyEnum;

  @Column({ type: 'smallint', nullable: true })
  due_day!: number | null;

  @Column({ type: 'smallint', nullable: true, default: 3 })
  reminder_days!: number | null;

  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
    enumName: 'payment_method_enum',
    nullable: true,
  })
  payment_method!: PaymentMethodEnum;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_code!: string;

  @Column({ type: 'text', array: true, nullable: true, default: '{}' })
  attachments!: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_account!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destination_account!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_bank!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destination_bank!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressee!: string;

  @Column({
    type: 'date',
    default: () => 'CURRENT_DATE',
  })
  transaction_date!: Date;

  @Column({ type: 'bigint', nullable: true })
  objective_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  account_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  asset_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  liability_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  company_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  origin_account_id!: number | null;

  @Column({ type: 'bigint', nullable: true })
  destination_account_id!: number | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  transfer_group_id!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, default: 'manual' })
  source!: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

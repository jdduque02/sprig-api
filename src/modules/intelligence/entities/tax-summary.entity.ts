import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * patrimony, income_in_uvt y assets_in_uvt son columnas GENERATED STORED en PostgreSQL.
 * TypeORM no realiza INSERT/UPDATE sobre ellas — son calculadas por el motor de BD.
 */
@Entity({ name: 'tax_summary', schema: 'intelligence' })
@Unique('uq_tax_summary_user_fiscal_year', ['user_id', 'fiscal_year'])
export class TaxSummary {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_tax_summary_user')
  user_id!: number;

  @Column({ type: 'smallint' })
  @Index('idx_tax_summary_fiscal_year')
  fiscal_year!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_income!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_assets!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_liabilities!: number;

  /** GENERATED STORED: total_assets - total_liabilities */
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    insert: false,
    update: false,
    nullable: true,
  })
  patrimony!: number;

  /** GENERATED STORED: total_income / uvt_value */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    insert: false,
    update: false,
    nullable: true,
  })
  income_in_uvt!: number;

  /** GENERATED STORED: total_assets / uvt_value */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    insert: false,
    update: false,
    nullable: true,
  })
  assets_in_uvt!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  uvt_value!: number;

  @Column({ type: 'boolean', default: false })
  must_declare!: boolean;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  estimated_tax!: number;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  calculation_notes!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}

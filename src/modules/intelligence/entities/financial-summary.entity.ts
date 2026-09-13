import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface FinancialInsight {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  category_id?: number;
  suggested_action?: string;
}

/**
 * CRÍTICO: Los registros con is_final = TRUE no deben recalcularse nunca.
 * Esta restricción debe validarse en la capa de servicio antes de cualquier actualización.
 */
@Entity({ name: 'financial_summary', schema: 'intelligence' })
@Unique('uq_financial_summary_user_period', ['user_id', 'financial_period_id'])
export class FinancialSummary {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_financial_summary_user')
  user_id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_financial_summary_period')
  financial_period_id!: number;

  @Column({ type: 'bigint' })
  profile_id!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_income!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_expense!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_debt!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  net_worth!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  expense_ratio!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  debt_ratio!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  savings_rate!: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  recommended_max_expense!: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  recommended_savings!: number | null;

  @Column({ type: 'boolean', default: false })
  is_over_spending!: boolean;

  @Column({ type: 'boolean', default: false })
  is_over_indebted!: boolean;

  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  insights!: FinancialInsight[];

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  calculated_at!: Date;

  @Column({ type: 'boolean', default: false })
  @Index('idx_financial_summary_final')
  is_final!: boolean;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

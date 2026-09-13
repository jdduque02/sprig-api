import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FinancialObjectiveTypeEnum, FrequencyEnum } from '@shared/enums';

@Entity({ name: 'financial_objective', schema: 'finance' })
export class FinancialObjective {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_financial_objective_user')
  user_id!: number;

  @Column({ type: 'bigint', nullable: true })
  category_id!: number;

  @Column({ type: 'bigint', nullable: true })
  subcategory_id!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({
    type: 'enum',
    enum: FinancialObjectiveTypeEnum,
    enumName: 'financial_objective_type_enum',
  })
  @Index('idx_financial_objective_type')
  type!: FinancialObjectiveTypeEnum;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  target_amount!: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  current_balance!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  interest_rate!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  fees!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  monthly_payment!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  owner!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bank!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  current_profitability!: number | null;

  @Column({ type: 'bigint', nullable: true })
  @Index('idx_financial_objective_account')
  account_id!: number | null;

  @Column({
    type: 'enum',
    enum: FrequencyEnum,
    enumName: 'frequency_enum',
    nullable: true,
  })
  frequency!: FrequencyEnum;

  @Column({ type: 'smallint', nullable: true })
  due_day!: number;

  @Column({ type: 'date', nullable: true })
  start_date!: Date;

  @Column({ type: 'date', nullable: true })
  end_date!: Date;

  @Column({ type: 'boolean', default: false })
  is_completed!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  quota_calculation!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

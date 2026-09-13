import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'financial_period', schema: 'finance' })
@Unique('uq_financial_period_user_year_month', ['user_id', 'year', 'month'])
export class FinancialPeriod {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_financial_period_user')
  user_id!: number;

  @Column({ type: 'smallint' })
  year!: number;

  @Column({ type: 'smallint' })
  month!: number;

  @Column({ type: 'boolean', default: false })
  is_closed!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  closed_at!: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppUser } from './app-user.entity';

@Entity({ name: 'financial_profile', schema: 'identity' })
@Check(
  'ck_ratios_positive',
  `needs_ratio >= 0 AND wants_ratio >= 0 AND savings_ratio >= 0 AND investment_ratio >= 0`,
)
@Check(
  'ck_ratios_max',
  `(needs_ratio + wants_ratio + savings_ratio + investment_ratio) <= 100.00`,
)
export class FinancialProfile {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  user_id!: string;

  @Column({ type: 'varchar', length: 50, default: '50-30-20' })
  profile_name!: string;

  @Column({ type: 'boolean', default: false })
  is_custom!: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 50 })
  needs_ratio!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 30 })
  wants_ratio!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 20 })
  savings_ratio!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10 })
  investment_ratio!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 40 })
  max_debt_ratio!: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  monthly_income!: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @OneToOne(() => AppUser, ({ financial_profile }) => financial_profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: AppUser;
}

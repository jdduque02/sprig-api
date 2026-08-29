import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * SENSIBLE: Los campos encrypted_account_number y encrypted_balance
 * se cifran con AES-256-GCM vía EncryptionService (esquema 'banking').
 * NUNCA leer en claro fuera de EncryptionService.
 */
@Entity({ name: 'bank_account', schema: 'banking' })
export class BankAccount {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_bank_account_user')
  user_id!: number;

  @Column({ type: 'varchar', length: 100 })
  bank_name!: string;

  @Column({ type: 'varchar', length: 50 })
  account_type!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  encrypted_account_number!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  encrypted_balance!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  annual_interest_rate!: number | null;

  @Column({ type: 'varchar', length: 10, default: 'monthly' })
  yield_frequency!: string;

  @Column({ type: 'varchar', length: 10, default: 'EA' })
  rate_type!: string;

  @Column({ type: 'boolean', default: true })
  interest_enabled!: boolean;

  @Column({ type: 'date', nullable: true })
  last_interest_applied_at!: string | null;

  @Column({ type: 'date', nullable: true })
  interest_start_date!: string | null;

  @Column({ type: 'int', nullable: true })
  term_days!: number | null;

  @Column({ type: 'date', nullable: true })
  start_date!: string | null;

  @Column({ type: 'date', nullable: true })
  maturity_date!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'renew' })
  maturity_action!: string;

  @Column({ type: 'boolean', default: true })
  auto_renew!: boolean;

  @Column({ type: 'boolean', default: false })
  @Index('idx_bank_account_primary')
  is_primary!: boolean;

  @Column({ type: 'boolean', default: false })
  @Index('idx_bank_account_4x1000')
  exempt_4x1000!: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

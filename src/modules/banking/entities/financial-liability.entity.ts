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
 * SENSIBLE: El campo encrypted_data contiene información cifrada con pgcrypto.
 * NUNCA descifrar fuera de CryptoService.
 */
@Entity({ name: 'financial_liability', schema: 'banking' })
export class FinancialLiability {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_financial_liability_user')
  user_id!: number;

  @Column({ type: 'varchar', length: 50 })
  @Index('idx_financial_liability_type')
  liability_type!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  current_balance!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  interest_rate!: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency!: string;

  @Column({ type: 'bytea', nullable: true })
  encrypted_data!: Buffer;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FinancialProfile } from './financial-profile.entity';

@Entity({ name: 'app_user', schema: 'identity' })
export class AppUser {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: string;
  @Column({ type: 'varchar', length: 36, unique: true, nullable: true })
  @Index('idx_user_external_id')
  external_id!: string;

  @Column({ type: 'citext', unique: true })
  username!: string;

  @Column({ type: 'citext', unique: true })
  @Index('idx_user_email')
  email!: string;

  @Column({ type: 'varchar', length: 10, default: 'es-CO' })
  locale!: string;

  @Column({ type: 'varchar', length: 50, default: 'America/Bogota' })
  timezone!: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  roles!: string[];

  @Column({ type: 'timestamp', nullable: true })
  @Index('idx_user_last_login_at')
  last_login_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;

  @Column({ type: 'boolean', default: true })
  @Index('idx_user_active')
  is_active!: boolean;

  // ── Datos sensibles (encriptados) ───────────────────────
  @Column({ type: 'varchar', length: 500, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  full_name!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  document_id!: string | null;

  // ── Relaciones ──────────────────────────────────────────────
  @OneToOne(() => FinancialProfile, ({ user }) => user)
  @JoinColumn({ name: 'financial_profile_id' })
  financial_profile!: FinancialProfile;
}

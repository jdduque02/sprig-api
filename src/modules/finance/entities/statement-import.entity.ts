import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum StatementImportStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

@Entity({ name: 'statement_import', schema: 'finance' })
export class StatementImport {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_statement_import_user')
  user_id!: number;

  @Column({
    type: 'enum',
    enum: StatementImportStatusEnum,
    enumName: 'statement_import_status_enum',
    default: StatementImportStatusEnum.PENDING,
  })
  status!: StatementImportStatusEnum;

  @Column({ type: 'int', default: 0 })
  total_files!: number;

  @Column({ type: 'int', default: 0 })
  processed_files!: number;

  @Column({ type: 'int', default: 0 })
  success_files!: number;

  @Column({ type: 'int', default: 0 })
  failed_files!: number;

  @Column({ type: 'int', default: 0 })
  total_records_parsed!: number;

  @Column({ type: 'int', default: 0 })
  total_records_created!: number;

  @Column({ type: 'int', default: 0 })
  total_records_skipped!: number;

  @Column({ type: 'int', default: 0 })
  total_records_failed!: number;

  @Column({ type: 'int', default: 0 })
  total_records_uncategorized!: number;

  @Column({ type: 'jsonb', default: {} })
  options!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  error!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;
}

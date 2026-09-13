import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum StatementImportFileStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity({ name: 'statement_import_file', schema: 'finance' })
export class StatementImportFile {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_statement_import_file_import')
  import_id!: number;

  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  mimetype!: string;

  @Column({ type: 'bigint', default: 0 })
  size_bytes!: number;

  @Column({ type: 'text', nullable: true })
  storage_path!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: StatementImportFileStatusEnum.PENDING,
  })
  status!: StatementImportFileStatusEnum;

  @Column({ type: 'int', default: 0 })
  records_parsed!: number;

  @Column({ type: 'int', default: 0 })
  records_created!: number;

  @Column({ type: 'int', default: 0 })
  records_skipped!: number;

  @Column({ type: 'int', default: 0 })
  records_uncategorized!: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  error_code!: string | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;
}

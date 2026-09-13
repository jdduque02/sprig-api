import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditActionEnum } from '@shared/enums';

@Entity({ name: 'audit_log', schema: 'audit' })
@Index('idx_audit_log_schema_table', ['schema_name', 'table_name'])
@Index('idx_audit_log_record', ['record_id'])
@Index('idx_audit_log_changed_by', ['changed_by'])
@Index('idx_audit_log_created_at', ['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'text' })
  schema_name!: string;

  @Column({ type: 'text' })
  table_name!: string;

  @Column({ type: 'bigint' })
  record_id!: number;

  @Column({
    type: 'enum',
    enum: AuditActionEnum,
    enumName: 'audit_action_enum',
  })
  @Index('idx_audit_log_action')
  action!: AuditActionEnum;

  @Column({ type: 'jsonb', nullable: true })
  old_data!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  new_data!: Record<string, unknown>;

  /** NULL indica proceso automatizado (trigger) */
  @Column({ type: 'bigint', nullable: true })
  changed_by!: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}

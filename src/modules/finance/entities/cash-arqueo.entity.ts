import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CashArqueoStatusEnum {
  BALANCED = 'balanced',
  UNBALANCED = 'unbalanced',
}

@Entity({ name: 'cash_arqueo', schema: 'finance' })
export class CashArqueo {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_cash_arqueo_user')
  user_id!: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  arqueo_date!: Date;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  expected_amount!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  counted_amount!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  difference!: number;

  @Column({
    type: 'enum',
    enum: CashArqueoStatusEnum,
    enumName: 'cash_arqueo_status_enum',
    default: CashArqueoStatusEnum.UNBALANCED,
  })
  status!: CashArqueoStatusEnum;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  reconciliation!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

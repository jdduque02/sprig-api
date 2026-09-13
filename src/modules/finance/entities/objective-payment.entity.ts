import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'objective_payment', schema: 'finance' })
export class ObjectivePayment {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_objective_payment_objective')
  objective_id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_objective_payment_user')
  user_id!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

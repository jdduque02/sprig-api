import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Reglas de auto-categorización: una descripción normalizada de
 * transacción mapea a una categoría (y subcategoría opcional).
 * Se aprende cuando el usuario asigna una categoría a una transacción.
 */
@Entity({ name: 'transaction_category_rule', schema: 'finance' })
@Index(
  'idx_transaction_category_rule_user',
  ['user_id', 'normalized_description'],
  { unique: true },
)
export class TransactionCategoryRule {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  user_id!: number;

  @Column({ type: 'text' })
  normalized_description!: string;

  @Column({ type: 'bigint' })
  category_id!: number;

  @Column({ type: 'bigint', nullable: true })
  subcategory_id!: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;
}

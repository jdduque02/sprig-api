import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Presupuesto por categoría definido manualmente por el usuario (el límite
 * NO se deriva de la regla 50/30/20). `category_id`/`subcategory_id`
 * referencian `catalog.category`/`catalog.subcategory` SIN foreign key
 * (aislamiento entre esquemas, igual que `transaction_record`): se
 * resuelven vía `CategoryService`/`SubcategoryService`, nunca accediendo a
 * su repositorio directo.
 *
 * El periodo sigue el mismo patrón año/mes que `FinancialPeriod`
 * (`finance.financial_period`) para reutilizar la convención existente en
 * el módulo en vez de introducir un nuevo formato de fecha de periodo.
 */
@Entity({ name: 'category_budget', schema: 'finance' })
@Unique('uq_category_budget_user_category_period', [
  'user_id',
  'category_id',
  'subcategory_id',
  'year',
  'month',
])
export class CategoryBudget {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_category_budget_user')
  user_id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_category_budget_category')
  category_id!: number;

  @Column({ type: 'bigint', nullable: true })
  subcategory_id!: number | null;

  @Column({ type: 'smallint' })
  year!: number;

  @Column({ type: 'smallint' })
  month!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  limit_amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency!: string;

  /** Umbral (%) a partir del cual se dispara la alerta de acercamiento. */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 80 })
  alert_threshold_percent!: number;

  @Column({ type: 'boolean', default: true })
  @Index('idx_category_budget_active')
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date;
}

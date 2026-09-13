import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';

@Entity({ name: 'subcategory', schema: 'catalog' })
@Unique('uq_subcategory_user_category_name', ['user_id', 'category_id', 'name'])
export class Subcategory {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_subcategory_category')
  category_id!: number;

  @Column({ type: 'bigint' })
  @Index('idx_subcategory_user')
  user_id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon_key!: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color_hex!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  // ── Relaciones ──────────────────────────────────────────────
  @ManyToOne(() => Category, (category) => category.subcategories, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category;
}

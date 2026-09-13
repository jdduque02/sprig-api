import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProfileBucketEnum, TransactionTypeEnum } from '@shared/enums';
import { Subcategory } from '@catalog/entities/subcategory.entity';

@Entity({ name: 'category', schema: 'catalog' })
export class Category {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({
    type: 'enum',
    enum: TransactionTypeEnum,
    enumName: 'transaction_type_enum',
  })
  @Index('idx_category_group_type')
  group_type!: TransactionTypeEnum;

  @Column({
    type: 'enum',
    enum: ProfileBucketEnum,
    enumName: 'profile_bucket_enum',
    nullable: true,
  })
  @Index('idx_category_profile_bucket')
  profile_bucket!: ProfileBucketEnum | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon_key!: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color_hex!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', default: true })
  @Index('idx_category_active')
  is_active!: boolean;

  // ── Relaciones ──────────────────────────────────────────────
  @OneToMany(
    () => Subcategory,
    (subcategory: Subcategory) => subcategory.category,
  )
  subcategories!: Subcategory[];
}

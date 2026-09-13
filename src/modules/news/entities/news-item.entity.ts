import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'news_item', schema: 'news' })
export class NewsItem {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 300 })
  @Index('idx_news_item_title')
  title!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index('idx_news_item_category')
  category!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  image_url!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  link!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Index('idx_news_item_published_at')
  published_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at!: Date | null;
}

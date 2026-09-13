import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'summary_category_breakdown', schema: 'intelligence' })
@Index('idx_summary_breakdown_summary', ['summary_id'])
@Index('idx_summary_breakdown_category', ['category_id'])
export class SummaryCategoryBreakdown {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  summary_id!: number;

  @Column({ type: 'bigint' })
  category_id!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total_amount!: number;

  @Column({ type: 'int', default: 0 })
  transaction_count!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percentage_of_income!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  optimum_percentage!: number;

  @Column({ type: 'boolean', default: false })
  is_over_budget!: boolean;
}

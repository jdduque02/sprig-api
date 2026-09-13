import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Plantilla de correo personalizable (sujeto + HTML) editada desde
 * el editor react.email (Inspector) en el frontend.
 */
@Entity({ name: 'email_template', schema: 'mail' })
export class EmailTemplate {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  html_body!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Códigos OTP para recuperación de contraseña.
 * Se almacena el hash SHA-256 del código, nunca el código en claro.
 */
@Entity({ name: 'password_reset_otp', schema: 'identity' })
@Index('idx_password_reset_otp_user', ['user_id', 'created_at'])
export class PasswordResetOtp {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  user_id!: number;

  @Column({ type: 'text' })
  code_hash!: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumed_at!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}

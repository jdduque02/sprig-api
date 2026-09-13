import { Exclude, Expose } from 'class-transformer';

/**
 * DTO de respuesta para un perfil financiero.
 * Controla qué campos se exponen al cliente.
 */
@Exclude()
export class FinancialProfileResponseDto {
  @Expose()
  id: string;

  @Expose()
  profile_name!: string;

  @Expose()
  is_custom!: boolean;

  @Expose()
  needs_ratio!: number;

  @Expose()
  wants_ratio!: number;

  @Expose()
  savings_ratio!: number;

  @Expose()
  investment_ratio!: number;

  @Expose()
  max_debt_ratio!: number;

  @Expose()
  metadata!: Record<string, unknown>;

  @Expose()
  monthly_income!: number | null;

  @Expose()
  created_at!: Date;

  @Expose()
  updated_at!: Date;
  @Expose()
  deleted_at!: Date;

  constructor(partial: Partial<FinancialProfileResponseDto>) {
    Object.assign(this, partial);
  }
}

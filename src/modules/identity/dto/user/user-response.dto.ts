import { Exclude, Expose, Type } from 'class-transformer';
import { FinancialProfileResponseDto } from '@identity/dto/financial-profile/financial-profile-response.dto';

/**
 * DTO de respuesta para un usuario.
 * Controla qué campos se exponen al cliente.
 */
@Exclude()
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  external_id!: string;

  @Expose()
  username!: string;

  @Expose()
  email!: string;

  @Expose()
  locale!: string;

  @Expose()
  timezone!: string;

  @Expose()
  metadata!: Record<string, unknown>;

  @Expose()
  roles!: string[];

  @Expose()
  is_active!: boolean;

  @Expose()
  last_login_at!: Date | null;

  @Expose()
  is_online?: boolean;

  @Expose({ groups: ['detail', 'admin'] })
  phone!: string | null;

  @Expose({ groups: ['detail', 'admin'] })
  address!: string | null;

  @Expose({ groups: ['detail', 'admin'] })
  full_name!: string | null;

  @Expose({ groups: ['detail', 'admin'] })
  document_id!: string | null;

  @Expose()
  created_at!: Date;

  @Expose()
  updated_at!: Date;

  @Expose({ groups: ['detail', 'admin'] })
  @Type(() => FinancialProfileResponseDto)
  financial_profile!: FinancialProfileResponseDto;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

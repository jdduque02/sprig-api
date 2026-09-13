import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedTypeEnum,
  PaymentMethodEnum,
  ReviewStatusEnum,
  TransactionTypeEnum,
} from '@shared/enums';

export class TransactionRecordResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 10 })
  user_id!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  category_id!: number | null;

  @ApiProperty({ enum: ReviewStatusEnum })
  category_status!: ReviewStatusEnum;

  @ApiPropertyOptional({ example: 12, nullable: true })
  installments!: number | null;

  @ApiPropertyOptional({ example: 150000, nullable: true })
  installment_value!: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  subcategory_id!: number | null;

  @ApiProperty({ enum: TransactionTypeEnum })
  type!: TransactionTypeEnum;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ example: 'COP', description: 'Moneda de la transacción.' })
  currency!: string;

  @ApiProperty({ example: false })
  is_fixed!: boolean;

  @ApiPropertyOptional({ enum: FixedTypeEnum, nullable: true })
  fixed_type!: FixedTypeEnum | null;

  @ApiPropertyOptional({ enum: ['biweekly', 'monthly'], nullable: true })
  frequency!: 'biweekly' | 'monthly' | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  due_day!: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  reminder_days!: number | null;

  @ApiPropertyOptional({ enum: PaymentMethodEnum, nullable: true })
  payment_method!: PaymentMethodEnum | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reference_code!: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  attachments!: string[] | null;

  @ApiPropertyOptional({ nullable: true })
  source_account!: string | null;

  @ApiPropertyOptional({ nullable: true })
  destination_account!: string | null;

  @ApiPropertyOptional({ nullable: true })
  source_bank!: string | null;

  @ApiPropertyOptional({ nullable: true })
  destination_bank!: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressee!: string | null;

  @ApiProperty({ example: '2026-04-25', description: 'Fecha de negocio.' })
  transaction_date!: Date;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description: 'Meta asociada.',
  })
  objective_id!: number | null;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Cuenta bancaria asociada.',
  })
  account_id!: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: 'Activo financiero asociado.',
  })
  asset_id!: number | null;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Pasivo asociado.',
  })
  liability_id!: number | null;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description: 'Empresa/comercio asociada.',
  })
  company_id!: number | null;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ nullable: true })
  updated_at!: Date | null;
}

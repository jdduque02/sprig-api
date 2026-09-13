import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FrequencyEnum, PaymentMethodEnum } from '@shared/enums';

export class UpcomingPaymentDto {
  @ApiProperty({ example: 100 })
  id!: number;

  @ApiPropertyOptional({
    description: 'Nombre de la suscripción.',
    example: 'Suscripción Movistar',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: 89900 })
  amount!: number;

  @ApiPropertyOptional({
    enum: PaymentMethodEnum,
    nullable: true,
  })
  payment_method!: PaymentMethodEnum | null;

  @ApiPropertyOptional({ enum: FrequencyEnum, nullable: true })
  frequency!: FrequencyEnum | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  due_day!: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  reminder_days!: number | null;

  @ApiProperty({
    description: 'Próxima fecha de pago.',
    example: '2026-08-15',
  })
  next_payment_date!: string;

  @ApiProperty({
    description: 'Días restantes para el próximo pago.',
    example: 8,
  })
  days_remaining!: number;
}

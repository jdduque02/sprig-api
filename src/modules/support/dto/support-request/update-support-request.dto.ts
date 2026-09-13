import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupportRequestStatusEnum } from '@support/entities/support-request.entity';

export class UpdateSupportRequestDto {
  @ApiPropertyOptional({
    description: 'Nuevo estado de la solicitud.',
    enum: SupportRequestStatusEnum,
  })
  @IsOptional()
  @IsEnum(SupportRequestStatusEnum)
  status?: SupportRequestStatusEnum;

  @ApiPropertyOptional({
    description: 'Notas del equipo de soporte visibles para el usuario.',
    example: 'Solicitado al equipo de integraciones.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  admin_notes?: string;
}

import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFinancialObjectiveDto } from './create-financial-objective.dto';

export class UpdateFinancialObjectiveDto extends PartialType(
  CreateFinancialObjectiveDto,
) {
  @ApiPropertyOptional({
    description: 'Marcar objetivo como completado.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_completed?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha en que se completó.',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  completed_at?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { FinancialSummaryResponseDto } from '@intelligence/dto/financial-summary-response.dto';

export class FinancialAiAnalysisResponseDto extends FinancialSummaryResponseDto {
  @ApiProperty({
    example:
      'En este período tus ingresos fueron de 5000000 y tus gastos de 3200000...',
    description: 'Narrativa del análisis financiero, en español.',
  })
  narrative!: string;

  @ApiProperty({
    type: [String],
    example: ['Reduce gastos en suscripciones no esenciales.'],
  })
  recommendations!: string[];

  @ApiProperty({
    example: 'rule-based',
    description:
      'Proveedor que generó la narrativa. Hoy solo existe "rule-based" (determinístico, sin LLM real).',
  })
  provider!: string;

  @ApiProperty({ example: '2026-09-07T12:00:00.000Z' })
  generated_at!: Date;
}

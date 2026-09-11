import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@auth/auth.module';
import { FinanceModule } from '@finance/finance.module';
import { BankingModule } from '@banking/banking.module';
import { IdentityModule } from '@identity/identity.module';
import { CatalogModule } from '@catalog/catalog.module';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { SummaryCategoryBreakdown } from '@intelligence/entities/summary-category-breakdown.entity';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';
import { IntelligenceService } from '@intelligence/service/intelligence.service';
import { FinancialSummaryCalculatorService } from '@intelligence/service/financial-summary-calculator.service';
import {
  FINANCIAL_NARRATIVE_PROVIDER,
  FinancialAiAnalysisService,
} from '@intelligence/service/financial-ai-analysis.service';
import { RuleBasedFinancialNarrativeProvider } from '@intelligence/service/rule-based-financial-narrative.provider';
import { FinancialProfileReportService } from '@intelligence/service/financial-profile-report.service';
import { IntelligenceController } from '@intelligence/controller/intelligence.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialSummary,
      SummaryCategoryBreakdown,
      TaxSummary,
    ]),
    AuthModule,
    FinanceModule,
    BankingModule,
    CatalogModule,
    forwardRef(() => IdentityModule),
  ],
  controllers: [IntelligenceController],
  providers: [
    IntelligenceService,
    FinancialSummaryCalculatorService,
    FinancialAiAnalysisService,
    FinancialProfileReportService,
    {
      provide: FINANCIAL_NARRATIVE_PROVIDER,
      useClass: RuleBasedFinancialNarrativeProvider,
    },
  ],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}

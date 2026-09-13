import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '@identity/identity.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SupportModule } from '../support/support.module';
import { BankingModule } from '@banking/banking.module';
import { FinancialObjective } from './entities/financial-objective.entity';
import { FinancialPeriod } from './entities/financial-period.entity';
import { TransactionRecord } from './entities/transaction-record.entity';
import { ObjectivePayment } from './entities/objective-payment.entity';
import { Notification } from './entities/notification.entity';
import { CashArqueo } from './entities/cash-arqueo.entity';
import { Empresa } from './entities/empresa.entity';
import { StatementImport } from './entities/statement-import.entity';
import { StatementImportFile } from './entities/statement-import-file.entity';
import { TransactionCategoryRule } from './entities/transaction-category-rule.entity';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { CategoryBudget } from './entities/category-budget.entity';
import { FinancialObjectiveController } from './controller/financial-objective.controller';
import { FinancialPeriodController } from './controller/financial-period.controller';
import { TransactionRecordController } from './controller/transaction-record.controller';
import { ObjectivePaymentController } from './controller/objective-payment.controller';
import { StatementImportController } from './controller/statement-import.controller';
import { TransferController } from './controller/transfer.controller';
import { CashArqueoController } from './controller/cash-arqueo.controller';
import { EmpresaController } from './controller/empresa.controller';
import { GmfController } from './controller/gmf.controller';
import { CategoryBudgetController } from './controller/category-budget.controller';
import { FinancialObjectiveService } from './service/financial-objective.service';
import { FinancialPeriodService } from './service/financial-period.service';
import { TransactionRecordService } from './service/transaction-record.service';
import { ObjectivePaymentService } from './service/objective-payment.service';
import { StatementImportService } from './service/statement-import.service';
import { TransferService } from './service/transfer.service';
import { CashArqueoService } from './service/cash-arqueo.service';
import { EmpresaService } from './service/empresa.service';
import { FixedReminderScheduler } from './service/fixed-reminder.scheduler';
import { GmfService } from './service/gmf.service';
import { CategoryBudgetService } from './service/category-budget.service';
import { CategoryBudgetScheduler } from './service/category-budget.scheduler';
import { FinancialObjectiveRepository } from './repositories/financial-objective.repository';
import { FinancialPeriodRepository } from './repositories/financial-period.repository';
import { TransactionRecordRepository } from './repositories/transaction-record.repository';
import { ObjectivePaymentRepository } from './repositories/objective-payment.repository';
import { StatementImportRepository } from './repositories/statement-import.repository';
import { CashArqueoRepository } from './repositories/cash-arqueo.repository';
import { EmpresaRepository } from './repositories/empresa.repository';
import { CategoryBudgetRepository } from './repositories/category-budget.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialObjective,
      FinancialPeriod,
      TransactionRecord,
      ObjectivePayment,
      Notification,
      CashArqueo,
      Empresa,
      StatementImport,
      StatementImportFile,
      TransactionCategoryRule,
      FinancialAsset,
      FinancialLiability,
      CategoryBudget,
    ]),
    AuthModule,
    forwardRef(() => IdentityModule),
    AuditModule,
    NotificationModule,
    CatalogModule,
    SupportModule,
    BankingModule,
  ],
  controllers: [
    FinancialObjectiveController,
    FinancialPeriodController,
    TransactionRecordController,
    ObjectivePaymentController,
    StatementImportController,
    TransferController,
    CashArqueoController,
    EmpresaController,
    GmfController,
    CategoryBudgetController,
  ],
  providers: [
    FinancialObjectiveService,
    FinancialPeriodService,
    TransactionRecordService,
    ObjectivePaymentService,
    StatementImportService,
    TransferService,
    CashArqueoService,
    EmpresaService,
    FixedReminderScheduler,
    GmfService,
    CategoryBudgetService,
    CategoryBudgetScheduler,
    FinancialObjectiveRepository,
    FinancialPeriodRepository,
    TransactionRecordRepository,
    ObjectivePaymentRepository,
    StatementImportRepository,
    CashArqueoRepository,
    EmpresaRepository,
    CategoryBudgetRepository,
  ],
  exports: [
    FinancialObjectiveService,
    FinancialPeriodService,
    TransactionRecordService,
    ObjectivePaymentService,
  ],
})
export class FinanceModule {}

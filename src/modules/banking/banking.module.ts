import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '@auth/auth.module';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { BankAccountController } from '@banking/controller/bank-account.controller';
import { FinancialAssetController } from '@banking/controller/financial-asset.controller';
import { FinancialLiabilityController } from '@banking/controller/financial-liability.controller';
import { CurrencyController } from '@banking/controller/currency.controller';
import { BankAccountService } from '@banking/service/bank-account.service';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { MarketDataService } from '@banking/service/market-data.service';
import { InterestAccrualService } from '@banking/service/interest-accrual.service';
import { InterestAccrualScheduler } from '@banking/service/interest-accrual.scheduler';
import { BankAccountRepository } from '@banking/repositories/bank-account.repository';
import { FinancialAssetRepository } from '@banking/repositories/financial-asset.repository';
import { FinancialLiabilityRepository } from '@banking/repositories/financial-liability.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccount,
      FinancialAsset,
      FinancialLiability,
      TransactionRecord,
    ]),
    HttpModule,
    AuthModule,
  ],
  controllers: [
    BankAccountController,
    FinancialAssetController,
    FinancialLiabilityController,
    CurrencyController,
  ],
  providers: [
    BankAccountService,
    FinancialAssetService,
    FinancialLiabilityService,
    MarketDataService,
    InterestAccrualService,
    InterestAccrualScheduler,
    BankAccountRepository,
    FinancialAssetRepository,
    FinancialLiabilityRepository,
  ],
  exports: [
    BankAccountService,
    FinancialAssetService,
    FinancialLiabilityService,
  ],
})
export class BankingModule {}

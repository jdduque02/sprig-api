import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { I18nModule } from 'nestjs-i18n';
import { getI18nConfig } from '@config/i18n.config';
import { getThrottlerConfig } from '@config/throttler.config';
import { databaseConfig } from '@config/database.config';
import { IdentityModule } from '@identity/identity.module';
import { SharedModule } from '@shared/shared.module';
import { SharedEncryptionModule } from '@shared/shared-encryption.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';
import { BankingModule } from './modules/banking/banking.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FinanceModule } from './modules/finance/finance.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { NewsModule } from './modules/news/news.module';
import { MailModule } from './modules/mail/mail.module';
import { SupportModule } from './modules/support/support.module';
import { AdminModule } from './modules/admin/admin.module';
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor';
import { ErrorsInterceptor } from '@shared/interceptors/error.interceptor';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';

// Keycloak
import { KeycloakConnectModule } from 'nest-keycloak-connect';
import { getKeycloakConfig } from '@config/keycloak.config';

@Module({
  imports: [
    I18nModule.forRoot(getI18nConfig()),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getThrottlerConfig,
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
    ScheduleModule.forRoot(),
    SharedModule,
    SharedEncryptionModule,
    IdentityModule,
    AuthModule,
    NotificationModule,
    AuditModule,
    BankingModule,
    CatalogModule,
    FinanceModule,
    IntelligenceModule,
    NewsModule,
    MailModule,
    SupportModule,
    AdminModule,
    KeycloakConnectModule.registerAsync({
      useFactory: getKeycloakConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorsInterceptor,
    },
  ],
})
export class AppModule {}

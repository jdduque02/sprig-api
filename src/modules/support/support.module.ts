import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BankingEntity } from './entities/banking-entity.entity';
import { SupportRequest } from './entities/support-request.entity';
import { BankingEntityController } from './controller/banking-entity.controller';
import { SupportRequestController } from './controller/support-request.controller';
import { AdminSupportRequestController } from './controller/admin-support-request.controller';
import { BankingEntityService } from './service/banking-entity.service';
import { SupportRequestService } from './service/support-request.service';
import { BankingEntityRepository } from './repositories/banking-entity.repository';
import { SupportRequestRepository } from './repositories/support-request.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankingEntity, SupportRequest]),
    AuthModule,
  ],
  controllers: [
    BankingEntityController,
    SupportRequestController,
    AdminSupportRequestController,
  ],
  providers: [
    BankingEntityService,
    SupportRequestService,
    BankingEntityRepository,
    SupportRequestRepository,
  ],
  exports: [BankingEntityService, SupportRequestService],
})
export class SupportModule {}

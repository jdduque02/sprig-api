import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationGateway } from './gateway/notification.gateway';
import { NotificationService } from './service/notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationController } from './controller/notification.controller';
import { AuthModule } from '@auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationController],
  providers: [NotificationGateway, NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}

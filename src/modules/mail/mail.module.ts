import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '../identity/identity.module';
import { EmailTemplate } from './entities/email-template.entity';
import { MailService } from './service/mail.service';
import { MailTemplateController } from './controller/mail-template.controller';
import { AdminMailController } from './controller/admin-mail.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailTemplate]),
    forwardRef(() => AuthModule),
    forwardRef(() => IdentityModule),
  ],
  controllers: [MailTemplateController, AdminMailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

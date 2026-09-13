import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { AuthGuard } from './guards/auth.guard';
import { OwnershipGuard } from './guards/ownership.guard';
import { AdminGuard } from './guards/admin.guard';
import { IpBlockGuard } from './guards/ip-block.guard';
import { KeycloakAdminService } from './service/keycloak-admin.service';
import { IdentityModule } from '@identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PasswordResetOtp]),
    forwardRef(() => MailModule),
    forwardRef(() => IdentityModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    OwnershipGuard,
    AdminGuard,
    IpBlockGuard,
    KeycloakAdminService,
  ],
  exports: [
    AuthService,
    AuthGuard,
    OwnershipGuard,
    AdminGuard,
    IpBlockGuard,
    KeycloakAdminService,
  ],
})
export class AuthModule {}

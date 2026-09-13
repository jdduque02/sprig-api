import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AuthGuard } from '@auth/guards/auth.guard';
import { TestAuthGuard } from './test-auth.helper';

export interface TestAppContext {
  app: INestApplication;
  moduleRef: TestingModule;
}

/**
 * Arranca la aplicación completa (AppModule real: TypeORM contra la DB de
 * desarrollo local, Redis, RabbitMQ, todos los módulos de dominio) con una
 * única sustitución necesaria para correr e2e sin infraestructura externa de
 * identidad: `AuthGuard` -> `TestAuthGuard` (evita llamar a Keycloak real).
 * `OwnershipGuard`, `AdminGuard`, `ThrottlerGuard`, pipes, filtros e
 * interceptores globales corren sin mockear, igual que en producción (el
 * rate limit se relaja vía env, ver test/utils/env-setup.ts).
 */
export async function createTestApp(): Promise<TestAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AuthGuard)
    .useClass(TestAuthGuard)
    .compile();

  const app = moduleRef.createNestApplication();

  app.use(cookieParser(process.env.COOKIE_SECRET ?? 'test-cookie-secret'));

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new I18nValidationExceptionFilter());

  const apiVersion = process.env.VERSION ?? '1';
  app.setGlobalPrefix(`api/v${apiVersion}`);

  await app.init();

  return { app, moduleRef };
}

export async function closeTestApp(
  ctx: TestAppContext | undefined,
): Promise<void> {
  if (!ctx) return;
  await ctx.app.close();
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { getHelmetConfig } from '@config/helmet.config';
import { getCorsConfig } from '@config/cors.config';
import { getSwaggerConfig } from '@config/swagger.config';
import {
  getSwaggerCustomCss,
  getSwaggerCustomJs,
} from '@config/swagger-ui.config';
import { I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { getRabbitMQConfig } from '@config/rabbitmq.config';
import { getCsrfProtection } from '@config/csrf.config';
import { FileLogger } from '@shared/services/file-logger';
import { DataSource } from 'typeorm';
import type { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.enableShutdownHooks();

  // Logger personalizado que captura logs a archivo
  app.useLogger(new FileLogger());

  // Registrar adaptador Socket.io
  app.useWebSocketAdapter(new IoAdapter(app));

  app.connectMicroservice(getRabbitMQConfig(configService));

  // Pipe global de validación con i18n: traduce mensajes de class-validator automáticamente
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtro global de errores de validación i18n
  app.useGlobalFilters(new I18nValidationExceptionFilter());

  // --- Security setup ---
  const env = configService.get<string>('NODE_ENV', 'LOCAL');
  const isProd = env === 'PROD' || env === 'DEPLOY' || env === 'production';
  app.use(helmet(getHelmetConfig(isProd)));
  app.enableCors(getCorsConfig(configService));

  const cookieSecret = configService.get<string>('COOKIE_SECRET');
  if (!cookieSecret) throw new Error('COOKIE_SECRET env var no está definida.');
  if (isProd) {
    if (!configService.get<string>('OTP_SECRET')) {
      throw new Error('OTP_SECRET debe definirse en entornos de producción.');
    }
    if (!configService.get<string>('BCRYPT_PEPPER')) {
      throw new Error(
        'BCRYPT_PEPPER debe definirse en entornos de producción.',
      );
    }
    if (!configService.get<string>('CSRF_SECRET')) {
      throw new Error('CSRF_SECRET debe definirse en entornos de producción.');
    }
  }
  app.use(cookieParser(cookieSecret));

  // CSRF double-submit cookie. El cliente debe reenviar el cookie `x-csrf-token`
  // en el header `x-csrf-token` en POST/PUT/PATCH/DELETE.
  // Se puede desactivar con CSRF_ENABLED=false (útil en tests locales).
  const csrfEnabled =
    configService.get<string>('CSRF_ENABLED', isProd ? 'true' : 'false') ===
    'true';
  if (csrfEnabled) {
    const csrfMiddleware = getCsrfProtection(configService);
    // Skip CSRF for requests with Bearer token (mobile/SPA clients use Authorization header,
    // not cookies, so CSRF protection is not needed).
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
      }
      return csrfMiddleware(req, res, next);
    });
  }

  // Global Prefix for all routes (e.g., /api/v1)
  const apiVersion = configService.get<string>('VERSION') ?? '1';
  const globalPrefix = `api/v${apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  // Health (sin auth) — se monta tras el prefix global vía middleware simple
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(`/${globalPrefix}/health`, (_req: Request, res: Response) => {
    res.status(200).json({
      status: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // --- Swagger (deshabilitado en producción) ---
  const swaggerVersion = configService.get<string>('VERSION') ?? '1';
  if (!isProd) {
    const config = getSwaggerConfig(configService);
    const documentFactory = () => SwaggerModule.createDocument(app, config);

    const logoCandidates = [
      join(__dirname, '..', 'public', 'logo.svg'),
      join(__dirname, '..', '..', 'public', 'logo.svg'),
    ];
    const logoPath = logoCandidates.find((p) => existsSync(p));
    if (!logoPath) throw new Error('logo.svg not found');
    const logoBase64 = readFileSync(logoPath).toString('base64');

    SwaggerModule.setup(`api/v${swaggerVersion}/docs`, app, documentFactory, {
      customCss: getSwaggerCustomCss(),
      customJsStr: getSwaggerCustomJs(logoBase64),
      customSiteTitle: 'Sprig API Docs',
      customfavIcon: `data:image/svg+xml;base64,${logoBase64}`,
      jsonDocumentUrl: `api/v${swaggerVersion}/docs-json`,
      yamlDocumentUrl: `api/v${swaggerVersion}/docs-yaml`,
    });
  }

  // Using port from environment variable or 3000 as fallback
  const port = configService.get<number>('PORT') ?? 3000;
  await app.startAllMicroservices();
  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/api/v${swaggerVersion}`,
  );
  console.log(
    `Swagger Docs available at: http://localhost:${port}/api/v${swaggerVersion}/docs`,
  );
  console.log('RabbitMQ transport connected and listening for messages.');

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      try {
        const ds = app.get(DataSource, { strict: false });
        if (ds?.isInitialized) await ds.destroy();
      } catch {
        // DataSource may already be closed by Nest
      }
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
void bootstrap();

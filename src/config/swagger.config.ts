import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

type Environment = 'DEV' | 'PROD' | 'LOCAL';

const SERVER_URLS: Record<Environment, string> = {
  LOCAL: 'http://localhost:3000',
  DEV: 'https://api-dev.costmanager.com',
  PROD: 'https://api.costmanager.com',
};

export const getSwaggerConfig = (
  configService: ConfigService,
): Omit<OpenAPIObject, 'paths'> => {
  const environment = configService.get<Environment>('NODE_ENV') || 'LOCAL';
  const version = configService.get<string>('VERSION') || '1';
  const serverUrl = SERVER_URLS[environment];

  const builder = new DocumentBuilder()
    .setTitle(`Sprig API`)
    .setDescription(
      `Documentación interactiva de la API de **Sprig**.\n\n` +
        `Ambiente actual: **${environment}**\n\n` +
        `> Autenticación: obtén un token JWT en \`POST /auth/login\` y pégalo en el campo Authorize.`,
    )
    .setVersion(version)
    .addServer(serverUrl, `${environment} (v${version})`)
    .addTag('auth', 'Autenticación y gestión de sesiones')
    .addTag('identity', 'Gestión de usuarios y perfiles financieros')
    .addTag('banking', 'Cuentas bancarias, activos y pasivos')
    .addTag('finance', 'Transacciones, períodos y objetivos financieros')
    .addTag('catalog', 'Categorías y subcategorías')
    .addTag('intelligence', 'Resúmenes financieros e inteligencia fiscal')
    .addTag('audit', 'Registro de auditoría')
    .addTag('notification', 'Servicio de notificaciones')
    .addTag('news', 'Noticias y contenido informativo')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description:
          'Ingresa el access_token de Keycloak (sin el prefijo Bearer)',
        in: 'header',
      },
      'bearer',
    )
    .addGlobalParameters({
      name: 'x-lang',
      in: 'header',
      required: false,
      schema: { type: 'string', enum: ['es', 'en'], default: 'es' },
      description:
        'Idioma para los mensajes de respuesta. Por defecto: es (español).',
    });

  return builder.build();
};

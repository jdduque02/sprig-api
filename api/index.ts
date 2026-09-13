import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createNestApp } from '../src/create-app';

/**
 * Entrypoint HTTP-only para Vercel Serverless Functions.
 *
 * A propósito NO conecta el microservicio de RabbitMQ ni depende del
 * gateway WebSocket funcionando de verdad — una función serverless no
 * sostiene conexiones persistentes: cada invocación puede correr en una
 * instancia distinta (o congelada/destruida entre requests), así que un
 * consumer de cola o un socket persistente ahí se rompe o duplica mensajes.
 *
 * Notificaciones en tiempo real, el consumer de RabbitMQ y los schedulers
 * (`@nestjs/schedule`, p. ej. `interest-accrual.scheduler.ts`) siguen
 * corriendo en el despliegue Docker/VM (`src/main.ts`), apuntando a la
 * misma base de datos que este deployment de Vercel.
 */

let appPromise: ReturnType<typeof createNestApp> | undefined;

async function getExpressApp(): Promise<Express> {
  appPromise ??= createNestApp().then(async (app) => {
    await app.init();
    return app;
  });
  const app = await appPromise;
  return app.getHttpAdapter().getInstance() as Express;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const expressApp = await getExpressApp();
  expressApp(req, res);
}

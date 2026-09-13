import request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

/**
 * PDF mínimo con la cabecera `%PDF-` correcta (pasa el filtro de multer y el
 * chequeo de "magic bytes" del servicio) pero sin estructura interna válida.
 * No es un extracto real de Bancolombia/Nu/etc.: `pdfjs-dist` lo rechazará
 * al parsear, lo que ejercita el flujo asíncrono completo (creación de lote
 * -> procesamiento -> archivo marcado como fallido con PDF_INVALID) sin
 * necesitar un fixture real. El caso feliz con transacciones reales creadas
 * a partir de un extracto válido queda pendiente de un fixture real (ver
 * resumen final).
 */
const FAKE_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n%fake-pdf-for-e2e-error-path\nnot a real pdf structure\n%%EOF',
  'latin1',
);

describe('StatementImportController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Rango de userId exclusivo de este grupo de specs (finance).
  const userId = 940003;
  const otherUserId = 940004;
  const base = `/api/v1/users/${userId}/statement-imports`;

  let createdJobId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function waitForJobToFinish(
    jobId: number,
    maxAttempts = 15,
  ): Promise<{ status: string; files: { status: string }[] }> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await request(server)
        .get(`${base}/${jobId}`)
        .set(...authHeader({ userId }));
      const job = unwrapOne<{ status: string; files: { status: string }[] }>(
        res.body,
      );
      if (job.status !== 'pending' && job.status !== 'processing') return job;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('El lote de importación no terminó de procesar a tiempo.');
  }

  describe('flujo (creación + listado + procesamiento asíncrono)', () => {
    it('crea un lote de importación (POST multipart) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .field('skip_duplicates', 'true')
          .attach('files', FAKE_PDF_BUFFER, {
            filename: 'extracto-e2e.pdf',
            contentType: 'application/pdf',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        status: string;
        total_files: number;
      }>(res.body);
      expect(created.total_files).toBe(1);
      expect(['pending', 'processing']).toContain(created.status);
      createdJobId = Number(created.id);
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('lista los lotes de importación del usuario (GET) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(typeof res.body.total).toBe('number');
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('el archivo con PDF sintético inválido termina marcado como fallido (PDF_INVALID) tras el procesamiento asíncrono', async () => {
      const job = await waitForJobToFinish(createdJobId);
      expect(job.status).toBe('failed');
      expect(job.files.length).toBe(1);
      expect(job.files[0].status).toBe('failed');
    }, 15000);

    it('rechaza el reintento cuando el storage del archivo fallido ya fue limpiado (400)', async () => {
      const res = await request(server)
        .post(`${base}/${createdJobId}/retry`)
        .set(...authHeader({ userId }))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(base);
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(base)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso a statement-imports de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza creación sin archivos (400)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .field('skip_duplicates', 'true');
      expect(res.status).toBe(400);
    });

    it('rechaza creación con archivo no PDF (400, UNSUPPORTED_FILE)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .attach('files', Buffer.from('esto no es un pdf'), {
          filename: 'extracto.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar un lote inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${base}/not-a-number`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al reintentar un lote inexistente', async () => {
      const res = await request(server)
        .post(`${base}/999999999/retry`)
        .set(...authHeader({ userId }))
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(base)
            .set(...authHeader({ userId })),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

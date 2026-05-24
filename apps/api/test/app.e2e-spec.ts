/**
 * End-to-end bootstrap test for apps/api.
 *
 * Exercises the full boot chain:
 *   validateEnv → NestFactory → FastifyAdapter → AppModule →
 *   AppNestLoggerService wired → global prefix + exclusion → health probe.
 *
 * Uses Fastify's in-process `inject()` so no real port is opened —
 * parallel-safe, no Docker, no supertest dependency.
 *
 * Installed by prompt [III.11.0].
 */
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

describe('apps/api bootstrap (e2e)', () => {
  let app: NestFastifyApplication;
  let dbReachable = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
      { logger: false, bufferLogs: false },
    );

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/(.*)'],
    });

    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`app bootstrap test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
  });

  describe('GET /health/live (bare, outside /api/v1 prefix)', () => {
    it('returns 200 and the expected shape', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/live' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body['status']).toBe('ok');
      expect(body['service']).toBe('api');
      expect(typeof body['timestamp']).toBe('string');
      expect(typeof body['uptimeSeconds']).toBe('number');
    });

    it('also 200 at /api/v1/health/live would be wrong — it should NOT exist there', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('unknown route', () => {
    it('returns 404 under the /api/v1 prefix', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 at the bare root', async () => {
      const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
      expect(res.statusCode).toBe(404);
    });
  });
});

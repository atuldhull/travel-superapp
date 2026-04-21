/**
 * End-to-end tests for /health/{live,ready,startup}.
 *
 * Indicators are overridden with test doubles so CI can run without
 * Docker. Each /ready test asserts both the HTTP status and the per-dep
 * breakdown terminus puts in the response body.
 *
 * The "live docker" acceptance ("killing Redis flips /ready to 503") is
 * not simulated here by actually stopping Docker — it's simulated by
 * swapping the Redis indicator for one that throws. That is the same
 * code path terminus walks when Redis is really down.
 *
 * Installed by prompt [IV.18.1.16].
 */
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';
import { AppModule } from '../src/app.module';
import { PostgresHealthIndicator } from '../src/health/indicators/postgres.indicator';
import { RedisHealthIndicator } from '../src/health/indicators/redis.indicator';
import { HttpPingIndicator } from '../src/health/indicators/http-ping.indicator';
import { applyOfflineStubs } from './helpers/offline-stubs';

type IndicatorDouble = {
  isHealthy: jest.Mock<Promise<HealthIndicatorResult>, [string?, string?]>;
  onModuleDestroy?: () => Promise<void>;
};

function up(key: string, extra: Record<string, unknown> = {}): HealthIndicatorResult {
  return { [key]: { status: 'up', ...extra } };
}

function down(key: string, extra: Record<string, unknown> = {}): never {
  throw new HealthCheckError(`${key} simulated down`, {
    [key]: { status: 'down', ...extra },
  });
}

async function bootApp(doubles: {
  postgres: IndicatorDouble;
  redis: IndicatorDouble;
  http: IndicatorDouble;
}): Promise<NestFastifyApplication> {
  // Stub Postgres + Redis-backed throttler so the suite runs
  // without Docker — indicators are already mocked, and the
  // /health/* routes don't need real rate-limit accounting.
  const moduleRef = await applyOfflineStubs(Test.createTestingModule({ imports: [AppModule] }))
    .overrideProvider(PostgresHealthIndicator)
    .useValue(doubles.postgres)
    .overrideProvider(RedisHealthIndicator)
    .useValue(doubles.redis)
    .overrideProvider(HttpPingIndicator)
    .useValue(doubles.http)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
    { logger: false, bufferLogs: false },
  );
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('health probes (e2e)', () => {
  let app: NestFastifyApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('GET /health/live', () => {
    beforeEach(async () => {
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres')) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http: { isHealthy: jest.fn().mockResolvedValue(up('meilisearch')) },
      });
    });

    it('returns 200 and a trivial shape with no dep checks', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/live' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body['status']).toBe('ok');
      expect(body['service']).toBe('api');
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 with all three deps up when everything is healthy', async () => {
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres', { latencyMs: 4 })) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis', { latencyMs: 2 })) },
        http: {
          isHealthy: jest
            .fn()
            .mockResolvedValue(up('meilisearch', { latencyMs: 6, httpStatus: 200 })),
        },
      });

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        status: string;
        info: Record<string, { status: string }>;
        error?: unknown;
      };
      expect(body.status).toBe('ok');
      expect(body.info['postgres']?.status).toBe('up');
      expect(body.info['redis']?.status).toBe('up');
      expect(body.info['meilisearch']?.status).toBe('up');
    });

    it('returns 503 with postgres marked down when Postgres is down', async () => {
      app = await bootApp({
        postgres: {
          isHealthy: jest
            .fn()
            .mockImplementation(() => down('postgres', { error: 'connection refused' })),
        },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http: { isHealthy: jest.fn().mockResolvedValue(up('meilisearch')) },
      });

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as {
        status: string;
        error: Record<string, { status: string }>;
        info: Record<string, { status: string }>;
      };
      expect(body.status).toBe('error');
      expect(body.error['postgres']?.status).toBe('down');
      expect(body.info['redis']?.status).toBe('up');
      expect(body.info['meilisearch']?.status).toBe('up');
    });

    it('returns 503 with redis marked down when Redis is down (acceptance-test simulation)', async () => {
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres')) },
        redis: {
          isHealthy: jest.fn().mockImplementation(() => down('redis', { error: 'ECONNREFUSED' })),
        },
        http: { isHealthy: jest.fn().mockResolvedValue(up('meilisearch')) },
      });

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { error: Record<string, { status: string }> };
      expect(body.error['redis']?.status).toBe('down');
    });

    it('returns 503 with meilisearch marked down when Meili is down', async () => {
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres')) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http: {
          isHealthy: jest.fn().mockImplementation(() => down('meilisearch', { httpStatus: 500 })),
        },
      });

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { error: Record<string, { status: string }> };
      expect(body.error['meilisearch']?.status).toBe('down');
    });

    it('passes the Meili URL built from MEILI_HOST to the HTTP indicator', async () => {
      const http: IndicatorDouble = {
        isHealthy: jest.fn().mockResolvedValue(up('meilisearch')),
      };
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres')) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http,
      });

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      expect(http.isHealthy).toHaveBeenCalledTimes(1);
      const [key, url] = http.isHealthy.mock.calls[0] as [string, string];
      expect(key).toBe('meilisearch');
      expect(url).toMatch(/\/health$/);
      expect(url.startsWith('http')).toBe(true);
    });
  });

  describe('GET /health/startup', () => {
    beforeEach(async () => {
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockResolvedValue(up('postgres')) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http: { isHealthy: jest.fn().mockResolvedValue(up('meilisearch')) },
      });
    });

    it('returns 200 when Postgres is reachable', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/startup' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { info: Record<string, { status: string }> };
      expect(body.info['postgres']?.status).toBe('up');
    });

    it('returns 503 when Postgres is down', async () => {
      await app.close();
      app = await bootApp({
        postgres: { isHealthy: jest.fn().mockImplementation(() => down('postgres')) },
        redis: { isHealthy: jest.fn().mockResolvedValue(up('redis')) },
        http: { isHealthy: jest.fn().mockResolvedValue(up('meilisearch')) },
      });
      const res = await app.inject({ method: 'GET', url: '/health/startup' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { error: Record<string, { status: string }> };
      expect(body.error['postgres']?.status).toBe('down');
    });
  });
});

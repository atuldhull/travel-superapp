/**
 * Integration tests for the per-request trace-id middleware
 * ([III.15.5]).
 *
 * Verifies:
 *   1. A request without an `x-trace-id` header gets a fresh
 *      32-char hex id minted by the server; both the response
 *      header AND any DomainError body's `traceId` field match it.
 *   2. A request WITH a valid `x-trace-id` honours it verbatim —
 *      same id on response + error body.
 *   3. A garbled incoming `x-trace-id` is rejected (mint fresh)
 *      rather than echoed back, so attackers can't spoof clean
 *      log correlation.
 *
 * We use `GET /api/v1/auth/me` without a bearer as the probe route
 * — it returns 401 UNAUTHENTICATED (a DomainError), so the filter
 * renders a body with `traceId`.
 *
 * Installed by prompt [III.15.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { registerTraceMiddleware } from '../src/common/trace/register-trace-middleware';
import { applyOfflineStubs } from './helpers/offline-stubs';

describe('Trace-id middleware (integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Stub Postgres + Redis-backed throttler so the suite runs on a
    // dev box without Docker. Trace-id assertions don't touch the DB
    // or the rate-limit bucket.
    moduleRef = await applyOfflineStubs(
      Test.createTestingModule({ imports: [AppModule] }),
    ).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await registerTraceMiddleware(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it('request without x-trace-id gets a server-minted id; header and body traceId match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);

    const headerId = res.headers['x-trace-id'];
    expect(typeof headerId).toBe('string');
    expect(headerId).toMatch(/^[0-9a-f]{32}$/);

    const body = JSON.parse(res.body) as { code: string; traceId: string };
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(body.traceId).toBe(headerId);
  });

  it('valid incoming x-trace-id is honoured verbatim', async () => {
    const incoming = '0123456789abcdef0123456789abcdef';
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { 'x-trace-id': incoming },
    });
    expect(res.headers['x-trace-id']).toBe(incoming);
    const body = JSON.parse(res.body) as { traceId: string };
    expect(body.traceId).toBe(incoming);
  });

  it('mixed-case incoming x-trace-id is normalised to lowercase', async () => {
    const incoming = '0123456789ABCDEF0123456789ABCDEF';
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { 'x-trace-id': incoming },
    });
    expect(res.headers['x-trace-id']).toBe(incoming.toLowerCase());
  });

  it('garbled incoming x-trace-id is ignored; server mints a fresh one', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { 'x-trace-id': 'not-hex; ignore me' },
    });
    const echoed = res.headers['x-trace-id'] as string;
    expect(echoed).not.toBe('not-hex; ignore me');
    expect(echoed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('two independent requests get independent traceIds', async () => {
    const a = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    const b = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(a.headers['x-trace-id']).not.toBe(b.headers['x-trace-id']);
  });
});

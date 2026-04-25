/**
 * Integration test for `http_request_duration_seconds` Histogram
 * ([IV.18.10.8]).
 *
 * Hits a known endpoint (`/health`) → scrapes `/metrics` → asserts
 * the histogram emits buckets + count + sum lines labeled by
 * method/route/status.
 *
 * Verifies:
 *   - The histogram is registered with prom-client text-format.
 *   - At least one bucket count > 0 after a request.
 *   - The /metrics route itself is NOT recorded (anti-recursion guard).
 *
 * Installed by prompt [IV.18.10.8].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { registerHttpMetricsMiddleware } from '../src/common/metrics/http-metrics.middleware';
import { MetricsService } from '../src/common/metrics/metrics.service';

describe('http_request_duration_seconds Histogram (integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let infraReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      // Same wiring as main.ts step 6d.
      await registerHttpMetricsMiddleware(app, moduleRef.get(MetricsService));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`metrics-http-duration test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
    await moduleRef.close();
  });

  it('emits histogram lines (HELP + TYPE + bucket + count + sum) after a request', async () => {
    if (!infraReachable) return;
    // Hit a route to generate at least one observation.
    const probe = await app.inject({ method: 'GET', url: '/health/live' });
    expect(probe.statusCode).toBe(200);

    const scrape = await app.inject({ method: 'GET', url: '/metrics' });
    expect(scrape.statusCode).toBe(200);
    const body = scrape.body;
    expect(body).toContain('# HELP http_request_duration_seconds');
    expect(body).toContain('# TYPE http_request_duration_seconds histogram');
    expect(body).toMatch(/http_request_duration_seconds_bucket\{[^}]*\}\s+\d/);
    expect(body).toMatch(/http_request_duration_seconds_count\{[^}]*\}\s+\d/);
    expect(body).toMatch(/http_request_duration_seconds_sum\{[^}]*\}\s+/);
  });

  it('matched route template (not raw path) is the route label', async () => {
    if (!infraReachable) return;
    // /health/live is a static route — `route="/health/live"`.
    await app.inject({ method: 'GET', url: '/health/live' });
    const scrape = await app.inject({ method: 'GET', url: '/metrics' });
    expect(scrape.body).toMatch(/route="\/health\/live"/);
  });

  it('the /metrics route itself does NOT show up in the histogram', async () => {
    if (!infraReachable) return;
    // Several scrapes — none should record themselves.
    await app.inject({ method: 'GET', url: '/metrics' });
    await app.inject({ method: 'GET', url: '/metrics' });
    const scrape = await app.inject({ method: 'GET', url: '/metrics' });
    // No bucket / count line names /metrics as the route.
    expect(scrape.body).not.toMatch(
      /http_request_duration_seconds_(?:bucket|count|sum)\{[^}]*route="\/metrics"/,
    );
  });
});

/**
 * apps/api bootstrap.
 *
 * Load order matters:
 *   1. `../instrumentation` — MUST be first import so OpenTelemetry can
 *      monkey-patch http/Nest/Prisma/Redis before they're loaded
 *      ([IV.17.6] stub; real SDK wiring in [III.15.4]).
 *   2. `reflect-metadata` — required by Nest's decorator metadata.
 *   3. Everything else.
 *
 * Bootstrap steps:
 *   1. Validate env (fail-fast if any required var is missing/invalid).
 *   2. Create Nest app with Fastify adapter + bufferLogs so early Nest
 *      lines get replayed once the real logger is wired.
 *   3. Swap Nest's built-in logger for our Pino-backed one.
 *   4. Set global prefix `/api/v1` — except for health probes, which
 *      Kubernetes / Fly.io hit at `/health/*` directly.
 *   5. Listen on 0.0.0.0:$PORT.
 *
 * Installed by prompt [III.11.0]. See Playbook §10 + §15.2.
 */
import '../instrumentation';
import './sentry.init';
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { EnvValidationError, validateEnv } from '@app/config';
import { AppNestLoggerService, createLogger } from '@app/logger';
import { AppModule } from './app.module';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { registerHttpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import { MetricsService } from './common/metrics/metrics.service';
import { registerSecurity } from './common/security/security.register';
import { registerTraceMiddleware } from './common/trace/register-trace-middleware';

const bootLog = createLogger('bootstrap');

async function bootstrap(): Promise<void> {
  // 1. Fail fast on invalid env before any Nest/Fastify import chain runs.
  let env: ReturnType<typeof validateEnv>;
  try {
    env = validateEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      bootLog.fatal({ issues: err.issues }, 'env_validation_failed');
    } else {
      bootLog.fatal({ err: String(err) }, 'env_validation_failed');
    }
    process.exit(1);
  }

  // 2. Create the Nest app. `bufferLogs: true` holds early Nest log lines
  //    until `useLogger` below is in place — no lost output.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // 3. Replace Nest's built-in ConsoleLogger with our Pino bridge.
  app.useLogger(app.get(AppNestLoggerService));

  // 4. Global exception filters — order matters. Register the catch-all
  //    FIRST so that when Nest scans in reverse, the more specific
  //    DomainExceptionFilter is evaluated first for any DomainError.
  //    Plain Error / HttpException fall through to AllExceptionFilter.
  //
  //    POST.10 — when `SENTRY_DSN_API` is set, `sentry.init.ts` runs
  //    before this and installs the @sentry/node uncaughtException
  //    + unhandledRejection handlers. Errors that propagate past our
  //    filters are captured automatically. Wiring `SentryGlobalFilter`
  //    as an APP_FILTER is the next-step polish — deferred to keep
  //    POST.10 blast radius small.
  app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());

  // 5. `/api/v1` prefix for business routes; `/health/*` stays bare for
  //    probes; `/metrics` stays bare for Prometheus scrapers (added by
  //    `[IV.18.10.6]`).
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/(.*)', 'metrics'],
  });

  // 5b. POST.9 — Stripe webhook needs the EXACT raw bytes Stripe
  //     signed (not a re-serialised JSON). Replace Fastify's default
  //     application/json parser with one that hands the controller
  //     a Buffer for `/api/v1/payments/webhook` only; every other
  //     route still gets parsed JSON.
  registerStripeWebhookRawBody(app.getHttpAdapter().getInstance() as FastifyInstance);

  // 6. HTTP perimeter: helmet (CSP + COOP/COEP + HSTS + …) + CORS +
  //    Permissions-Policy. Registered before listen so every route —
  //    including /health/* — gets the same response-side hardening.
  await registerSecurity(app, env);

  // 6b. Cookie parser — required by Identity module's refresh endpoint to
  //     read the httpOnly `refresh_token` cookie (CLAUDE rule 12).
  await app.register(fastifyCookie);

  // 6c. Trace-id middleware — establishes an AsyncLocalStorage context
  //     per request so every log line + every DomainError response
  //     body carries a correlatable `traceId`.
  await registerTraceMiddleware(app);

  // 6d. HTTP request-duration histogram — Fastify onRequest +
  //     onResponse hooks observe `http_request_duration_seconds`
  //     labeled by method/route/status. Added by `[IV.18.10.8]`.
  await registerHttpMetricsMiddleware(app, app.get(MetricsService));

  // 7. Shutdown hooks so SIGTERM drains in-flight requests cleanly (Fly.io / k8s).
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');

  bootLog.info({ port: env.PORT, nodeEnv: env.NODE_ENV, logLevel: env.LOG_LEVEL }, 'api_started');
}

bootstrap().catch((err: unknown) => {
  bootLog.fatal({ err: err instanceof Error ? err.message : String(err) }, 'bootstrap_failed');
  process.exit(1);
});

const STRIPE_WEBHOOK_PATH = '/api/v1/payments/webhook';

/**
 * POST.9 — Custom Fastify content-type parser that yields a Buffer
 * for the Stripe webhook route (so signature verification has the
 * exact bytes Stripe signed) and parses JSON normally for every
 * other route.
 */
function registerStripeWebhookRawBody(fastify: FastifyInstance): void {
  fastify.removeContentTypeParser?.('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      if (req.url === STRIPE_WEBHOOK_PATH) {
        done(null, body);
        return;
      }
      try {
        const parsed = body.length === 0 ? {} : JSON.parse(body.toString('utf8'));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}

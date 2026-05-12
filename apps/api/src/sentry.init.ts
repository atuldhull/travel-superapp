/**
 * POST.10 — Sentry SDK initialisation for apps/api.
 *
 * MUST run BEFORE `NestFactory.create` so the SDK installs its
 * monkey-patches on the http / fetch / Prisma module surface — same
 * load-order requirement as the OTel instrumentation.
 *
 *   apps/api/src/main.ts:
 *     import '../instrumentation';  // 1st: OTel
 *     import './sentry.init';       // 2nd: Sentry
 *     // … rest of bootstrap
 *
 * No-op when `SENTRY_DSN_API` (or the legacy `SENTRY_DSN`) is unset —
 * the rest of the boot path stays identical to today. When the DSN
 * is set, every uncaught exception + every error returned from a
 * Nest controller (after `setupNestErrorHandler` runs in main.ts)
 * lands in the configured Sentry project.
 *
 * Sentry free tier covers 5k errors/mo + 100 perf transactions/min
 * with no credit card — comfortable for dev + early launch.
 *
 * Installed by prompt [POST.10].
 */
import * as Sentry from '@sentry/nestjs';

const dsn = process.env['SENTRY_DSN_API'] ?? process.env['SENTRY_DSN'];

if (dsn !== undefined && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Match @sentry/nestjs convention — tracesSampleRate must be
    // explicit (0 disables perf telemetry, 1 enables 100%). Dev
    // gets 100% so we see every span; prod sampling lands later.
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    // Don't drown the inbox during local hot-reload churn.
    enabled: process.env['NODE_ENV'] !== 'test',
    // Strip Express/Fastify request bodies by default — we don't
    // want raw user input in the error stream. Sentry's Nest
    // integration still captures route + headers + query.
    sendDefaultPii: false,
    // Filter out the noisy stripe-webhook-signature 400s which are
    // expected when an attacker probes the endpoint.
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err && typeof err === 'object' && 'code' in err) {
        if ((err as { code?: string }).code === 'WEBHOOK_SIGNATURE_INVALID') {
          return null; // drop — not actionable noise
        }
      }
      return event;
    },
  });
}

export {};

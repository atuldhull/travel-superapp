/**
 * POST.10 — Sentry server (SSR / Route Handler) init. Captures
 * exceptions thrown during React Server Component render + Server
 * Action execution + API Route Handler invocation.
 *
 * No-op when `SENTRY_DSN_WEB` is unset.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env['SENTRY_DSN_WEB'];

if (dsn !== undefined && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}

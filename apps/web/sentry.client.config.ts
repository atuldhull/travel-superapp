/**
 * POST.10 — Sentry client (browser) init. Auto-loaded by Next.js
 * App Router via `instrumentation-client` discovery; the SDK
 * monkey-patches `window.onerror` + `unhandledrejection` and
 * captures React render errors via the ErrorBoundary integration.
 *
 * No-op when `NEXT_PUBLIC_SENTRY_DSN_WEB` is unset — current behaviour
 * preserved. The DSN is mirrored to a public-prefixed env var so
 * Next.js inlines it into the client bundle.
 *
 * Sentry free tier: 5k errors + 100 perf transactions/min, no card.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN_WEB'];

if (dsn !== undefined && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Session Replay is opt-in — it captures DOM snapshots which can
    // be sensitive. We only enable replay on error sessions so the
    // event volume stays predictable.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    sendDefaultPii: false,
  });
}

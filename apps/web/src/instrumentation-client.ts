/**
 * Sentry browser init — Next 15 / Turbopack convention.
 *
 * Moved here from the legacy `sentry.client.config.ts`: under Turbopack the
 * SDK only auto-discovers `instrumentation-client.ts`, so the old file's
 * `Sentry.init()` silently never ran. Runs once on the client before
 * hydration. No-op when `NEXT_PUBLIC_SENTRY_DSN_WEB` is unset.
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
    // Session Replay is opt-in (DOM snapshots can be sensitive); only on
    // error sessions so event volume stays predictable.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    sendDefaultPii: false,
  });
}

// App Router navigation instrumentation (required under Turbopack so the
// SDK doesn't warn about a missing onRouterTransitionStart hook).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

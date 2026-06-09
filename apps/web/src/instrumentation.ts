/**
 * Next.js instrumentation hook — loads the server + edge Sentry init.
 *
 * In @sentry/nextjs v10 (and under Turbopack) the server/edge configs only
 * run via this `register()` hook — they are no longer auto-injected. Without
 * it, SSR / Route Handler / middleware errors were never captured.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Reports errors thrown inside nested React Server Components / Route Handlers.
export { captureRequestError as onRequestError } from '@sentry/nextjs';

/**
 * DEPRECATED — the browser Sentry init moved to `src/instrumentation-client.ts`.
 *
 * Under Next 15 / Turbopack this legacy `sentry.client.config.ts` filename is
 * no longer auto-discovered, so its `Sentry.init()` never ran. This file is
 * intentionally inert (no init) so that webpack production builds — which still
 * inject this file — don't double-initialize Sentry. See
 * `src/instrumentation-client.ts` for the real init.
 */
export {};

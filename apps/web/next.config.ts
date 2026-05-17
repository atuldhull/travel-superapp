/**
 * Next.js 15 config. Minimal — App Router defaults are fine.
 *
 * - `reactStrictMode`: catches lifecycle pitfalls early.
 * - `typedRoutes`: typed `<Link href>` helps prevent broken-link
 *   regressions across module renames.
 * - `output: 'standalone'`: required for the apps/web/Dockerfile runner
 *   stage (no pnpm install at runtime).
 * - `outputFileTracingRoot`: workspace siblings (`@app/sdk`) live
 *   outside apps/web — extend file tracing up to the monorepo root.
 *
 * POST.10 — wrapped with `withSentryConfig` so Next.js uploads source
 * maps + injects request-id propagation when `SENTRY_DSN_WEB` is set.
 * When the DSN is unset, the wrapper passes the config through
 * unchanged — no behaviour delta from before POST.10.
 *
 * Installed by prompt [IV.18.19.14]; Sentry wrap added in [POST.10].
 */
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  // react-globe.gl + three (cinematic globe) and maplibre-gl + pmtiles
  // + protomaps-themes-base (offline vector map) ship untranspiled
  // ESM; Next's bundler needs them here or the ssr:false components
  // fail to chunk/parse.
  transpilePackages: ['react-globe.gl', 'three', 'maplibre-gl', 'pmtiles', 'protomaps-themes-base'],
};

// `withSentryConfig` is safe to call unconditionally — it only
// uploads source maps when `SENTRY_AUTH_TOKEN` is set (CI / release
// builds). Local `next dev` runs see zero Sentry overhead even when
// the DSN is configured because the source-map upload step is gated
// on the auth token, not the DSN.
const sentryBuildOptions = {
  silent: true,
  // The Sentry org + project slugs only matter when source-map upload
  // runs (i.e. CI release builds). Local dev never reads them.
  org: process.env['SENTRY_ORG'] ?? 'travel-app',
  project: process.env['SENTRY_PROJECT_WEB'] ?? 'travel-web',
  authToken: process.env['SENTRY_AUTH_TOKEN'],
  // Skip every Sentry build-time step locally so `next dev` boots
  // fast. CI sets `SENTRY_AUTH_TOKEN` which flips these on.
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryBuildOptions);

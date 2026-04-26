/**
 * Public entry for `@app/sdk`. Re-exports the runtime fetcher +
 * (once generated) the typed client.
 *
 *   import { configureSdk, apiFetch } from '@app/sdk';
 *
 * Generated React Query hooks + plain fetchers live under
 * `src/generated/`. They aren't re-exported here yet — re-run
 * `pnpm --filter=@app/sdk sdk:gen` to populate them, then add
 * `export * from './generated/react-query'` (or per-tag exports
 * for cleaner consumer DX).
 *
 * Installed by prompt [IV.18.19.16].
 */
export { apiFetch, configureSdk, type ApiError, type ApiFetchConfig } from './runtime/fetcher';

/**
 * Public entry for `@app/sdk`. Re-exports the runtime fetcher +
 * the generated typed clients.
 *
 *   import { configureSdk, apiFetch } from '@app/sdk';
 *   import { useMemoryBookControllerFeatured } from '@app/sdk';
 *
 * Generated React Query hooks live under `src/generated/react-query/`
 * (one barrel per OpenAPI tag). Plain fetchers live under
 * `src/generated/plain/` for non-React consumers (RN, third-party).
 *
 * Re-run after any controller / DTO change:
 *   pnpm --filter=api api:openapi
 *   pnpm --filter=@app/sdk sdk:gen
 *
 * Installed by prompt [IV.18.19.16]; first wire-through [IV.18.19.17].
 */
export { apiFetch, configureSdk, type ApiError } from './runtime/fetcher';

// React Query hooks per OpenAPI tag. Add tags here as the web/mobile
// surface starts consuming them — this keeps the public API explicit
// rather than star-exporting every generated symbol at once.
export * from './generated/react-query/media/media';

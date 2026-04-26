# @app/sdk — auto-generated typed API client

> Installed by prompt `[IV.18.19.16]`. Companion to
> [`docs/api/README.md`](../../docs/api/README.md) +
> [`apps/api/scripts/export-openapi.ts`](../../apps/api/scripts/export-openapi.ts).

## What's here

- **`src/runtime/fetcher.ts`** — shared fetch wrapper. Centralises
  base URL, bearer token injection (memory-only per CLAUDE rule 12),
  domain-error parsing.
- **`src/index.ts`** — public entry. Re-exports `apiFetch` +
  `configureSdk`.
- **`orval.config.ts`** — generation config. Two outputs:
  - `src/generated/react-query/` — typed `@tanstack/react-query`
    hooks for the Next.js web app.
  - `src/generated/plain/` — plain fetch wrappers for non-React
    consumers (RN mobile, third-party integrators).
- **`src/generated/`** — the actual generated code. Empty until
  first generation; ignored from index re-export until populated
  to avoid breaking imports on a fresh checkout.

## Generate

```sh
# Regenerate the OpenAPI spec from the running API.
pnpm --filter=api api:openapi

# Then regenerate the SDK from the spec.
pnpm --filter=@app/sdk sdk:gen
```

Both steps are idempotent — re-run safely.

## Use from a consumer

```ts
// apps/web/src/app/providers.tsx (or similar bootstrap)
import { configureSdk } from '@app/sdk';

configureSdk({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  getAccessToken: () => sessionStore.getState().accessToken, // memory-only
});

// Anywhere a generated hook is in scope:
import { useGetMemoryBooksFeatured } from '@app/sdk/generated/react-query/media/media';

function FeaturedList() {
  const { data, error } = useGetMemoryBooksFeatured();
  // …
}
```

## When to regenerate

| Trigger                                                   | Action                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| You added or removed a route on the API                   | `pnpm --filter=api api:openapi && pnpm --filter=@app/sdk sdk:gen` |
| You changed a route's request or response shape           | Same as above                                                     |
| You changed an `@ApiOperation` / `@ApiResponse` decorator | Same as above                                                     |
| You bumped @nestjs/swagger or orval                       | Same; verify the diff                                             |

The CI gate that auto-checks staleness is queued — for now,
reviewers eyeball the openapi.yaml diff in PRs.

## Roadmap

1. **Per-route schemas via `@ApiBody` decorators** — rolling out
   module-by-module on the api side. Until those land, generated
   request bodies are loose (`unknown`); responses are typed from
   what `@ApiResponse` declares + what's inferred from controller
   return types.
2. **CI gate** — fail the PR if `openapi.yaml` is older than the
   most recent controller change.
3. **First real consumer** — wire `apps/web/src/app/featured/page.tsx`
   through `useGetMemoryBooksFeatured()` once generation runs.
4. **Mobile binding** — Expo / RN consumes `src/generated/plain/`
   via TanStack Query for RN.

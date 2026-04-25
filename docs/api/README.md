# API specification

> Installed by prompt `[IV.18.19.10]`. Companion to
> [`docs/onboarding.md`](../onboarding.md) +
> [`apps/api/scripts/export-openapi.ts`](../../apps/api/scripts/export-openapi.ts).

## Files

| File           | What                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openapi.yaml` | Generated OpenAPI 3 spec for the API. Committed so consumers (future SDK gen, mobile bindings, third-party integrators) have a stable artifact without booting the API. |
| `openapi.json` | Fallback emitted when the `yaml` package isn't installed. The export script prefers YAML when available — diffs in PRs are easier to read.                              |

## Regenerate

```sh
pnpm --filter=api api:openapi
```

The script boots `AppModule` in-process, walks Nest's controller +
route metadata via `@nestjs/swagger`'s `SwaggerModule.createDocument`,
and writes `openapi.yaml` (or `.json`) here. No HTTP server starts —
this is purely a metadata export.

⚠️ Re-run after **every** PR that:

- Adds, removes, or renames a route.
- Changes a `@Controller` path prefix.
- Adds / removes a query parameter.
- Adds `@ApiBody()` / `@ApiResponse()` / `@ApiBearerAuth()`
  decorators (rolling out per-module — see "Roadmap" below).

CI gating on this is queued; today it's a manual step. The lint
hook will warn if `openapi.yaml` is older than the most recent
controller change once the gate lands.

## Today's coverage

The export today gives you:

- Every route's HTTP verb + path
- Tags by module (identity, trip, media, social, notifications, admin, account)
- The bearer-auth security scheme (declared in the script)
- 401 / 403 / 404 / 500 inferred from global guards + DomainExceptionFilter

It does NOT yet give you:

- Per-route request body schemas
- Per-route response body schemas
- Per-route auth-requirement annotation
- Per-route example payloads

These land progressively as `@ApiBody` / `@ApiResponse` /
`@ApiBearerAuth` decorators get applied module-by-module — avoiding
a single mega-PR. Touch a controller, add the decorators for ITS
routes in the same PR, regenerate.

## Roadmap

1. **Per-module decoration** — start with the highest-traffic
   module (`trip`); roll out the others over the next few sessions.
2. **CI gate** — `openapi.yaml` must be regenerated when a
   controller / DTO file changes; failing CI catches stale specs.
3. **SDK generation via [orval](https://orval.dev)** — points at this
   `openapi.yaml` and emits typed React-Query hooks for the web app
   - a typed client for mobile. Lands as `packages/sdk`.
4. **OpenAPI viewer** — Stoplight or Redoc rendering of the YAML in
   a docs site. Cosmetic but useful for third-party integrators.

## Why YAML over JSON

Diffs are readable. A reviewer skimming a PR can spot "added GET
/foo/bar" or "removed `?limit=` query param" in YAML; the JSON
variant is one giant escaped blob. Both formats are equivalent —
import-side tooling reads either.

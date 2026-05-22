# ADR-015 — The generated orval SDK is the canonical web↔API client

- **Status:** Accepted
- **Date:** 2026-05-22
- **Prompt:** `[A4]` (architecture hardening — "road to 10")
- **Playbook reference:** §3.x (Frontend ↔ API contract)

## Context

The web app talked to the API through **two** mechanisms, and nobody had
written down which one was canonical:

1. **The generated orval SDK** (`@app/sdk`) — react-query hooks +
   plain fetch wrappers, generated from `docs/api/openapi.yaml`. The
   OpenAPI spec is itself emitted from the running NestJS app by
   `apps/api/scripts/export-openapi.ts`. **87 web files** import it.
2. **`apiFetch`-direct** — hand-written typed wrappers in
   `apps/web/src/lib/two-oh-api.ts` calling the SDK's own `apiFetch`
   mutator. **~14 web files** import it.

The split was never an intentional architecture decision. Its real
cause was mechanical: `docs/api/openapi.yaml` had gone **4 phases
stale** (153 routes, dated long before Phases 2–6 landed). Every
endpoint added by the G/H/I/J series therefore had **no SDK
coverage**, so each new web surface reached for `apiFetch`-direct as
the only option — and the habit stuck.

A secondary, genuine cause: orval has a known limitation — it does
not emit query parameters for routes whose `@Query()` is validated
by a Zod pipe rather than declared with `@ApiQuery()`. For those few
routes the generated hook is missing its query string, and
`apiFetch`-direct is the correct workaround.

## Decision drivers

- **One contract, one source of truth.** The SDK's types are
  generated from the API's own OpenAPI spec — the contract can't
  silently drift. A hand-written client re-types every payload by
  hand and rots independently.
- **The majority already voted.** 87 files vs 14 — the SDK is the de
  facto standard; the exception is the minority.
- **The split's root cause is fixable.** A stale spec is not an
  architecture; it's an un-run command.
- **orval's Zod-`@Query()` gap is real but narrow.** A blanket "SDK
  only" rule that ignores it would force broken generated hooks.

## Considered options

### A. Adopt `apiFetch`-direct everywhere, retire orval

- **Pros:** no codegen step; one hand-written client.
- **Cons:** throws away contract-syncing for 87 files of working,
  generated, type-safe code; every future DTO change becomes a
  manual re-type; the SDK already powers the bulk of the app.

### B. The generated SDK is canonical; `apiFetch`-direct is a narrow, documented escape hatch · **CHOSEN**

- **Shape:** new endpoints are consumed through `@app/sdk` generated
  hooks. `apiFetch`-direct is permitted **only** where orval cannot
  generate a correct client (the Zod-`@Query()` limitation), and
  only through the single `apps/web/src/lib/two-oh-api.ts` adapter —
  never scattered ad-hoc.
- **Pros:** contract stays machine-synced for the whole app; the
  escape hatch is one file, narrow, and justified.
- **Cons:** requires discipline — the spec + SDK must be regenerated
  whenever a controller or DTO changes.

## Decision

**The generated orval SDK (`@app/sdk`) is the canonical web↔API
client.** New web code consumes generated hooks.

`apiFetch`-direct is a **sanctioned but narrow escape hatch**, used
only when orval genuinely cannot generate a correct client, and
always routed through the single `two-oh-api.ts` adapter module. Any
such use carries a one-line comment naming the orval limitation it
works around.

**The spec + SDK are regenerated on every change to a controller or
DTO:**

```
pnpm --filter=api api:openapi      # re-emit docs/api/openapi.yaml
pnpm --filter=@app/sdk sdk:gen     # regenerate @app/sdk
```

A4 brought the spec current (153 → 179 routes) and regenerated the
SDK so the full surface — including the entire Phase 2–6 area — now
has generated coverage. The migration of the `two-oh-api.ts`
endpoints onto the now-available generated hooks is a tracked
follow-up; what legitimately remains afterwards is the documented
Zod-`@Query()` escape hatch.

## Consequences

**Positive:**

- One client story, written down. The 87/14 split had no rationale;
  now it has a rule.
- The contract can't go stale unnoticed — and once CI exists
  (dimension 3 / A6), a freshness check on `openapi.yaml` will gate
  it mechanically.
- `apiFetch`-direct shrinks to a justified minimum instead of being
  the default for anything new.

**Negative / open:**

- The OpenAPI export (`export-openapi.ts`) does not yet emit full
  request/response **body** schemas — it needs `@ApiBody` /
  `@ApiResponse` / `@ApiProperty` decorators rolled out per module.
  Until then, generated hooks for some POST/PATCH routes have loosely
  typed bodies. Completing that annotation is the remaining work to
  make the SDK fully type-safe end-to-end.
- Regeneration is a manual two-command step until CI gates it.
- orval's Zod-`@Query()` limitation keeps a small, permanent
  `apiFetch`-direct surface — acceptable, because it is narrow,
  documented, and funnelled through one adapter.

## Cross-references

- [ADR-005 — Frontend stack](./ADR-005-frontend-stack.md)
- `packages/sdk/orval.config.ts` — the generator config
- `apps/api/scripts/export-openapi.ts` — the spec emitter
- `apps/web/src/lib/two-oh-api.ts` — the sanctioned escape-hatch adapter
- `[A4]` — this decision; spec + SDK regenerated in commit `e5c11be`

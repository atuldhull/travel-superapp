# ADR-016 — API versioning & deprecation policy

- **Status:** Accepted
- **Date:** 2026-05-23
- **Prompt:** `[A6.3]` (architecture hardening — "road to 10")
- **Playbook reference:** §3.x (API contract & client coupling)

## Context

The NestJS API has shipped under a single global prefix —
`/api/v1/*` — set once in `apps/api/src/main.ts`
(`app.setGlobalPrefix('api/v1', { exclude: ['health', ...] })`) and
mirrored verbatim by the OpenAPI exporter and every e2e test setup.
**179 routes** sit under that prefix today. The web app consumes them
via the generated SDK ([ADR-015](./ADR-015-web-api-client-generation.md)),
which is regenerated from the spec — clients have **no
version-negotiation logic**; they hit the URL the SDK was generated
against.

We have so far been disciplined by accident: nothing has needed a
breaking change yet, so the "v1 forever" assumption has held. With
the modular monolith approaching the point where extracted services
(ai, media, notification, crawler) will start landing their own
controllers and the mobile (Expo) client comes online with a longer
upgrade tail than web, we need a **written** versioning + deprecation
policy before the first breaking change is proposed. Without it the
default path is "edit the v1 controller, ship, break clients" — and
the lack of a documented alternative is what makes that path get
taken.

## Decision drivers

- **Mobile clients have a long upgrade tail.** Expo OTA covers JS
  changes; native binary changes (and users who disable OTA) require
  store-review cycles. A breaking server change cannot assume every
  client is on HEAD.
- **The SDK is regenerated, not version-aware.** A new major version
  is a new SDK build, not a new code path inside one SDK. Versions
  must be parallel-hosted on the server so an old SDK keeps working
  while a new SDK rolls out.
- **HTTP has a standard for "this is going away."** RFC 8594
  (`Sunset` header) + the draft `Deprecation` header are widely
  supported by tooling; rolling our own header would buy nothing.
- **Most "breaking" requests aren't.** Adding fields, adding endpoints,
  loosening validation — all backward-compatible. We want a policy
  that doesn't force a new version for changes that don't need one.
- **OpenAPI already has `deprecated: true`.** A flag on the route,
  emitted into the spec, picked up by orval and by Swagger UI —
  costs us nothing to set.

## Considered options

### A. Version inside the body (`{ apiVersion: "1.2" }`)

- **Pros:** one URL surface.
- **Cons:** breaks HTTP caching by URL, breaks every existing client,
  the SDK can't dispatch on it cleanly, requires server-side fan-out
  on a payload field. Nobody who has tried this has been happy.

### B. Header-based version (`Accept: application/vnd.travel.v2+json`)

- **Pros:** spec-clean (content negotiation).
- **Cons:** the SDK + curl debugging both get less obvious; CDN /
  proxy caching needs `Vary: Accept` discipline that gets forgotten;
  the URL no longer tells you which version you're hitting.

### C. URL-path version (`/api/v2/...`), parallel-hosted · **CHOSEN**

- **Shape:** the prefix `/api/v1` we already have stays the v1
  surface forever; `/api/v2` is a new prefix mounted as a parallel
  controller surface in the SAME monolith — v1 and v2 use-cases share
  the application layer, only the interface controllers differ. A
  client picks its version by the URL it hits.
- **Pros:** matches every public-cloud API our consumers already use
  (Stripe, GCP, AWS, GitHub); the SDK build target is unambiguous;
  curl/Postman remain obvious; CDN caching is trivial; the server
  can deprecate + sunset v1 routes without touching v2.
- **Cons:** v1 + v2 controllers can drift in their input shape and
  someone must remember to land v2 changes in both — which is
  acceptable because that's the point of having two versions.

## Decision

**The API uses URL-path versioning. `/api/v1` is the current surface
and is the only surface that exists today. A v2 surface is added
only when a breaking change is unavoidable, never as a
forward-looking placeholder.**

A change requires a new major version (`/v2`) ONLY if it:

1. Removes or renames a field in a response body, OR
2. Changes a field's type or required-ness in a response body, OR
3. Removes or renames a route, OR
4. Tightens a request-body validator in a way that rejects payloads
   v1 previously accepted (loosening is non-breaking), OR
5. Changes authentication or authorization semantics for a route
   (e.g. now requires `admin`, or scope `X`).

A change does NOT require a new major version when it:

- Adds a new route.
- Adds an optional field to a request body.
- Adds a field to a response body.
- Adds a new value to an enum (clients SHOULD treat unknown enum
  values as the "other" branch — call this out in the field's
  description in the OpenAPI spec).
- Loosens a request validator (e.g. raising a `max(4_000)` to
  `max(8_000)`).
- Changes internal behavior, performance, or error messages
  (`code` field stays stable; `message` is informational).

### Bumping the major version

A `/v2` ships in the same monolith. Both surfaces are mounted in
`main.ts` via Nest's built-in URI versioning (`enableVersioning({
type: VersioningType.URI })`) or by leaving `setGlobalPrefix('api')`
in place and adding `@Version('1')` / `@Version('2')` decorators to
the controller classes that differ between versions. v1 controllers
that did not change need no `@Version` decorator — they apply to
both prefixes by default.

Bumping the version requires a new ADR (mandatory) that names:

1. **The breaking change** (the field / route / semantics being
   changed), and **why** it cannot be done additively under v1.
2. **The migration window** — minimum **6 months** from the day v2
   ships to the day v1 is removed.
3. **The deprecation signalling plan** (next section).
4. **The client landing plan** — which SDK versions, web releases,
   and mobile binaries land on v2, and how the mobile upgrade tail is
   surfaced (forced-upgrade screen vs. soft warning).

### Deprecation signalling — RFC 8594

When v2 ships, every v1 route that v2 replaces MUST start returning
two headers on every response:

```
Deprecation: true
Sunset: <RFC 1123 date — at least 6 months from this rollout>
Link: <https://travel.app/changelog/api-v2>; rel="deprecation"
```

- `Deprecation: true` — the [Deprecation HTTP Header](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header)
  draft form. Clients SHOULD log a warning. The SDK build that
  targets v1 SHOULD include a one-time `console.warn` per route on
  the first call that gets this header back.
- `Sunset: <date>` — [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594). After
  that date the route MAY return `410 Gone` with a body that points
  at the v2 equivalent.
- `Link: ...; rel="deprecation"` — points at the changelog entry that
  explains what changed and how to migrate. One link, one URL, one
  changelog. Not optional.

These three headers are added by a single global Fastify hook
(`onSend`) gated by a list of route patterns held in
`apps/api/src/common/deprecation/deprecated-routes.ts`. The list
starts empty; adding a route to it is the one-line action that
flips its deprecation state.

The OpenAPI spec MUST mark every such route `deprecated: true`. orval
propagates this into the generated SDK as a JSDoc `@deprecated` tag,
so consuming code surfaces the deprecation in the IDE.

### Removal

When the `Sunset` date passes:

1. The v1 controller for the route is deleted.
2. A new ADR records the removal and links back to the deprecation
   ADR.
3. A short-lived `410 Gone` shim controller is left in place for one
   minor release after removal, returning a body of
   `{ code: 'ROUTE_REMOVED', sunsetReplacedBy: '/api/v2/...', changelog: '<url>' }`.
4. The shim is removed in the next minor release. The route returns a
   standard `404 Not Found` thereafter.

### Internal endpoints

`/health/*`, `/metrics`, and the Stripe webhook (`/api/v1/payments/webhook`)
are excluded from versioning. `/health/*` and `/metrics` are
operational; the Stripe webhook URL is registered in Stripe's
dashboard and cannot be migrated atomically. Internal endpoints that
need a breaking change get a fresh path on `/internal/*` instead of
a version bump.

## Consequences

**Positive:**

- The first breaking change has a written playbook. No engineer has
  to invent a process under time pressure.
- Clients have a 6-month minimum to migrate, with mechanical
  warnings in the SDK + headers in the response.
- The OpenAPI spec carries the deprecation state, so reviewers see
  it on every PR.
- Once CI gates the spec (dimension 3 / future work), a route added
  to the deprecation list automatically updates `openapi.yaml` and
  fans out into the SDK.

**Negative / open:**

- v1 + v2 controllers can drift; landing a feature in both is more
  work than landing it in one. Accepted — that's the cost of having
  two versions, and it's the right tradeoff against breaking clients.
- A future client that ignores `Deprecation`/`Sunset` headers will
  experience a `410 Gone` instead of a graceful migration. The web +
  mobile SDKs we own will honour the headers; third-party consumers
  (none today) would be at-their-own-risk.
- The deprecation list lives in code, not in the spec generator — so
  the spec generator MUST be taught to read it. That work lands when
  the first deprecation lands; no work happens until then.

## Cross-references

- [ADR-015 — generated SDK is the canonical web client](./ADR-015-web-api-client-generation.md)
- [RFC 8594 — Sunset HTTP Header](https://www.rfc-editor.org/rfc/rfc8594)
- [draft-ietf-httpapi-deprecation-header](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header) —
  Deprecation HTTP Header
- `apps/api/src/main.ts` — current `setGlobalPrefix('api/v1', ...)`
- `apps/api/scripts/export-openapi.ts` — same prefix on export
- `[A6.3]` — this decision

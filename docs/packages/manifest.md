# Shared-Package Manifest

> Authoritative list of the 10 cross-cutting packages defined in Playbook §7.4. For each package this file records: **purpose · public exports · allowed consumers · forbidden consumers · peer-package dependencies**. Siblings to this doc: [ADR-004](../adr/ADR-004-bounded-contexts.md) (intra-api module rule) and [context-map](../architecture/context-map.md) (per-module events + facades + model ownership).
>
> **Installed by** `[II.7.4]`. **Update rule:** adding a package, adding an allowed consumer, or relaxing a forbidden-consumer rule is a manifest edit. Tightening a forbidden rule or deleting a package requires a new ADR.

---

## Consumer surfaces

The apps that may import a shared package. Anything NOT on this list is by definition forbidden.

| Surface      | Path                                                                    | Runtime                                                   |
| ------------ | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `api`        | `apps/api`                                                              | Node 22 (NestJS/Fastify)                                  |
| `workers`    | `apps/notification-worker`, `apps/crawler-worker`, `apps/media-service` | Node 22 (NestJS standalone + BullMQ / Playwright / Sharp) |
| `web`        | `apps/web`                                                              | Next.js 15 (Node runtime + Edge + browser)                |
| `admin`      | `apps/admin`                                                            | Next.js 15                                                |
| `mobile`     | `apps/mobile`                                                           | React Native + Expo 51                                    |
| `ai-service` | `apps/ai-service`                                                       | Python 3.12 (FastAPI)                                     |
| `tests`      | any `*.spec.ts` / `*.e2e-spec.ts` in the surfaces above                 | Jest                                                      |

`ai-service` cannot import TypeScript packages at all — it sees the TS world only through the HTTP/gRPC boundary. It appears in the tables below for completeness; `—` in its column means "N/A, not a TS runtime."

---

## Summary Table

Legend: ✅ allowed · ❌ forbidden · ⚠ allowed only in tests (devDependency) · — not applicable.

| Package              | Purpose (one line)                                               | `api` |   `workers`   | `web` | `admin` | `mobile` | `ai-service` |
| -------------------- | ---------------------------------------------------------------- | :---: | :-----------: | :---: | :-----: | :------: | :----------: |
| `@app/logger`        | Pino factory + trace-context mixin + PII redact.                 |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/config`        | Zod env schema + `validateEnv()` + Nest `AppConfigModule`.       |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/auth`          | JWT + Passport guards + CASL policies + token helpers.           |  ✅   | ⚠ verify-only |  ❌   |   ❌    |    ❌    |      —       |
| `@app/errors`        | `DomainError` base + concrete error classes.                     |  ✅   |      ✅       |  ✅   |   ✅    |    ✅    |      —       |
| `@app/observability` | OpenTelemetry NodeSDK bootstrap + tracer/meter helpers.          |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/events`        | `EventBus` port + `RedisStreamsEventBus` adapter.                |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/cache`         | Redis client + key-namespacer + TTL helpers.                     |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/ratelimit`     | Redis sliding-window limiter + peppered key hash.                |  ✅   |      ✅       |  ❌   |   ❌    |    ❌    |      —       |
| `@app/validation`    | Zod boundary helpers + `ZodValidationPipe` + unknown-key policy. |  ✅   |      ✅       |  ✅   |   ✅    |    ✅    |      —       |
| `@app/testing`       | Testcontainers helpers, factory-bot fixtures, mother objects.    |   ⚠   |       ⚠       |   ⚠   |    ⚠    |    ⚠     |      —       |

**Status key.** ✅ = listed as production dep. ⚠ = devDependency only (test code). ❌ = not installable; CI dependency-cruiser lint fails if the package appears in `dependencies` / `devDependencies` of a forbidden surface. — = Python runtime; no npm install is possible.

The `❌` column is the load-bearing one — it is the binding part of this doc.

---

## Per-package Detail

Each section states why the allow-list is what it is. Reviewers use this when a PR bumps a package's `dependencies` to a surface that was previously forbidden.

### `@app/logger`

- **Purpose.** Pino JSON logger + AsyncLocalStorage trace-context mixin + PII redact path list. The only logging primitive allowed anywhere in Node code (CLAUDE.md rule 9: no `console.log`).
- **Public exports.** `createLogger(opts)`, `AppLogger` type, `runWithTraceContext(traceId, fn)`, `AppNestLoggerService` (Nest-compatible adapter).
- **Allowed.** `api`, `workers`.
- **Forbidden.** `web`, `admin`, `mobile` — they run inside `next/` and `expo/` runtimes where `pino`'s transport assumptions break (Edge runtime has no `process.stdout`; RN has no Node streams). Those surfaces use their own framework-native logging wrapper (`next.config.js` logging + `expo-device` on mobile).
- **Peer-package dependencies.** None (this is the bottom of the stack).

### `@app/config`

- **Purpose.** The single Zod schema that validates `process.env` at bootstrap; `validateEnv()` throws `EnvValidationError` on failure. The NestJS `AppConfigModule.forRoot()` wires it into DI.
- **Public exports.** `EnvSchema`, `Env` (inferred type), `validateEnv(input)`, `EnvValidationError`, `AppConfigModule`, `AppConfigService`.
- **Allowed.** `api`, `workers`.
- **Forbidden.** `web`, `admin` — Next.js has its own `NEXT_PUBLIC_*` env story via `next.config.js`; leaking server-only secrets into a Next client bundle would be a critical vuln. `mobile` uses `expo-constants` for its env surface. `ai-service` uses `pydantic-settings`.
- **Peer-package dependencies.** Depends on no other `@app/*` package (intentional — env validation is the first thing to run, before logger binding).

### `@app/auth`

- **Purpose.** JWT access-token creation + verification, refresh-token rotation, Passport strategies (Google / Apple / local), CASL ability factory, `RolesGuard`, `JwtAuthGuard`. The canonical example in the prompt of "this package must not be usable by apps/web."
- **Public exports.** `AuthModule`, `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` decorator, `createTokenPair(user)`, `verifyAccessToken(token)`, `rotateRefreshToken(old)`, `AbilityFactory`.
- **Allowed.** `api`. `workers` may import the **verify-only** subset (`verifyAccessToken`) from `@app/auth/verify` — the notification worker needs to check a signed webhook token. Nothing else.
- **Forbidden.** `web`, `admin`, `mobile` — tokens never enter browser/RN JavaScript memory in a way that requires this package. Access tokens come in via a login response into memory-only state; refresh tokens live in httpOnly cookies the client code never sees (CLAUDE.md rule 12). Any JS-side "auth utility" on a client surface would be a footgun.
- **Forbidden.** `ai-service` — not a TS runtime; and ai-service auth is mTLS, not JWT.
- **Peer-package dependencies.** `@app/logger`, `@app/config`, `@app/errors`, `@app/cache` (for JTI revocation list + rate-limit of auth endpoints).

### `@app/errors`

- **Purpose.** `DomainError` abstract base with `code`, `httpStatus`, frozen `context`, timestamp, sanitising `toJSON()`. Concrete subclasses (one per predictable failure — `ValidationError`, `UnauthorizedError`, `ResourceNotFoundError`, `ConflictError`, `RateLimitError`, etc.).
- **Public exports.** `DomainError`, the concrete error classes, `isDomainError(u)` type guard.
- **Allowed.** Every surface. Errors are the one cross-cutting concern that all clients legitimately need — `web` / `admin` / `mobile` parse `{ code, message, traceId }` off the wire and need the same `code` constants the server uses to render localised UI.
- **Forbidden.** `ai-service` — Python. It interops with the error _wire format_ (defined in `@app/shared-types`), not with the TypeScript classes themselves.
- **Peer-package dependencies.** None. This package is frozen and has no runtime dep weight beyond TS types. Any imports from here to elsewhere would create a dependency cycle — by design it is a leaf.

### `@app/observability`

- **Purpose.** OpenTelemetry NodeSDK bootstrap (traces + metrics + logs bridge), instrumentation registrations, `getTracer(name)` / `getMeter(name)` helpers, correlation with `@app/logger`'s trace context.
- **Public exports.** `bootstrapTelemetry(config)`, `getTracer`, `getMeter`, `withSpan(name, fn)`.
- **Allowed.** `api`, `workers`.
- **Forbidden.** `web`, `admin`, `mobile` — those use browser / RN OTel SDKs which have a different lifecycle (page-load spans, not process-wide NodeSDK). Mixing `@opentelemetry/sdk-node` into a Next.js client bundle breaks the Edge runtime.
- **Peer-package dependencies.** `@app/logger`, `@app/config`.

### `@app/events`

- **Purpose.** `EventBus` port + `RedisStreamsEventBus` adapter ([ADR-003](../adr/ADR-003-event-backbone.md)). Event name catalogue comes from [context-map](../architecture/context-map.md).
- **Public exports.** `EventBus` (interface), `DomainEvent` (base type), `RedisStreamsEventBus` (class + `forRoot()` NestJS module factory), `@Subscribe(name)` method decorator for handlers.
- **Allowed.** `api`, `workers`.
- **Forbidden.** `web`, `admin`, `mobile` — clients don't publish domain events; they interact via HTTP. `ai-service` — Python runtime; if ai-service ever publishes events it implements its own Redis Streams client, not this TS package.
- **Peer-package dependencies.** `@app/logger`, `@app/config`, `@app/errors`, `@app/cache` (reuses the shared Redis connection).

### `@app/cache`

- **Purpose.** Typed Redis client wrapper with key-namespacing (so `trip:draft:<id>` never collides with `places:search:<hash>`), TTL defaults, `getOrSet(key, loader, ttl)` helper. The sole place a Redis connection is created in Node processes.
- **Public exports.** `CacheService`, `createRedisClient(opts)`, `namespacedKey(namespace, ...parts)`.
- **Allowed.** `api`, `workers`.
- **Forbidden.** `web`, `admin`, `mobile`, `ai-service` — no client surface should open a direct Redis connection.
- **Peer-package dependencies.** `@app/logger`, `@app/config`, `@app/errors`.

### `@app/ratelimit`

- **Purpose.** Redis-backed sliding-window limiter. Keys hashed with `RATE_LIMIT_PEPPER` so PII (email, IP) never lives in Redis in plaintext (Playbook §13.4). Per-route + per-user + per-IP windows.
- **Public exports.** `RateLimiter` (class), `@RateLimit({ window, max })` decorator, `RateLimitError` (re-exported from `@app/errors`).
- **Allowed.** `api`, `workers` (crawler needs outbound-request rate limits against Google Places + Foursquare).
- **Forbidden.** `web`, `admin`, `mobile`, `ai-service`.
- **Peer-package dependencies.** `@app/logger`, `@app/config`, `@app/errors`, `@app/cache`.

### `@app/validation`

- **Purpose.** Zod helpers at every service boundary: `ZodValidationPipe` (NestJS), `parseOrThrow(schema, input)`, unknown-key policy (strict by default). Complements `@app/shared-types` (which owns the schemas themselves).
- **Public exports.** `ZodValidationPipe`, `parseOrThrow`, `safeParseOrNull`.
- **Allowed.** Every TS surface — boundary validation is needed by `web` / `admin` / `mobile` too (form submissions must validate client-side before hitting the wire).
- **Forbidden.** `ai-service` — uses `pydantic`; receives already-validated data off the wire.
- **Peer-package dependencies.** `@app/errors` (for `ValidationError`).

### `@app/testing`

- **Purpose.** Test fixtures (factory-bot-style builders per aggregate), Testcontainers helpers (`withPostgres()`, `withRedis()`, `withMeilisearch()`), mother-object builders for common domain cases. Explicitly devDependency-only.
- **Public exports.** `buildUser()`, `buildTrip()`, `withPostgres(cb)`, `withRedis(cb)`, `flushAllTestState()`, plus matchers (`toBeDomainErrorWithCode`).
- **Allowed.** Any surface — in its `devDependencies`. Production `dependencies` of any surface is forbidden.
- **Forbidden.** Production builds — CI rejects any `package.json` where `@app/testing` appears outside `devDependencies`.
- **Peer-package dependencies.** `@app/errors` (for domain-error matchers). May reach into `@app/cache` / `@app/events` in tests, but only via public exports.

---

## Other packages in the repo (NOT on §7.4's list)

These exist in `packages/` and are legitimately cross-cutting, but they are not "cross-cutting concerns" in the §7.4 sense (application libraries). They're build-tooling and types. Listed for completeness.

| Package              | Purpose                                  | Allowed consumers         | Forbidden                                                            |
| -------------------- | ---------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `@app/tsconfig`      | Base TS compiler configs.                | Any TS package/app.       | Runtime imports of its JSON are irrelevant — consumed via `extends`. |
| `@app/eslint-config` | Shared flat ESLint config.               | Any TS package/app.       | Runtime imports forbidden — this is a devDependency.                 |
| `@app/shared-types`  | Zod schemas + inferred TS types.         | Every TS surface.         | `ai-service` (Python — schemas mirrored there in `pydantic`).        |
| `@app/sdk`           | Orval-generated API client from OpenAPI. | `web`, `admin`, `mobile`. | `api` / `workers` (they produce the API; can't depend on the SDK).   |
| `@app/ui`            | shadcn + Tailwind component library.     | `web`, `admin`.           | `api`, `workers`, `mobile` (RN uses `@app/mobile-ui`), `ai-service`. |
| `@app/mobile-ui`     | Tamagui component library for RN.        | `mobile`.                 | `web`, `admin`, `api`, `workers`, `ai-service`.                      |

**Rule:** `@app/shared-types` is the mandated transport between TS surfaces. `@app/sdk` sits on top of it for web/admin/mobile. `api` and `workers` MUST NOT depend on `@app/sdk` — that would be a cycle (the SDK is generated _from_ their OpenAPI output).

---

## Enforcement

Two layers, one at CI, one at ESLint:

1. **`dependency-cruiser` config** (to be installed by `[III.Tooling]`) reads this manifest's "Forbidden" cells as `forbidden` rules and fails CI if any `package.json` violates them. The CI job prints the offending `import` path alongside this doc's row so the reviewer lands directly on the rule they're breaking.
2. **ESLint `import/no-restricted-paths`** zones already cover the intra-api module rule ([ADR-004](../adr/ADR-004-bounded-contexts.md)). A separate zone is added per forbidden cell above — example: `{ target: 'apps/web', from: 'packages/auth' }`.

The two layers are redundant on purpose — dependency-cruiser catches `package.json` drift; ESLint catches import drift within a consumer that already has the package listed transitively.

---

## How to use this doc

- **Adding a shared package** → pick one of the 10 names in §7.4 (don't invent a new one without an ADR). Populate its row in the Summary Table. Write a per-package detail entry. Register it in `pnpm-workspace.yaml`.
- **Opening a PR that bumps a `dependencies` list** → grep this file for the package name. If the new consumer is ❌, the PR requires a manifest edit (and a reviewer comment on why the rule should be relaxed).
- **Removing an allowed consumer** → flip ✅ → ❌ in a dedicated PR that also removes the `dependencies` entry from the affected surface. This is a tightening — it goes in as a pure config change, no ADR needed.
- **Removing a forbidden consumer (i.e. adding permission)** → this is a loosening. Justify in the per-package detail section. Reviewer must confirm no rule in [ADR-004](../adr/ADR-004-bounded-contexts.md) or `CLAUDE.md` is violated by the new allowance.

---

## Links

- Playbook §7.4 (cross-cutting concerns list).
- [ADR-001](../adr/ADR-001-modular-monolith.md), [ADR-003](../adr/ADR-003-event-backbone.md), [ADR-004](../adr/ADR-004-bounded-contexts.md).
- [docs/architecture/context-map.md](../architecture/context-map.md) — per-module map; this manifest is the per-package counterpart.
- Prompt `[II.7.3]` — extracted-service contracts (the out-of-process counterpart: how ai-service, media-service, notification-worker, crawler-worker expose themselves).

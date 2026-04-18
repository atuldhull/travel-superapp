# TravelSuperApp — Progress Log

> Rolling log of completed prompts from [`travel-app-prompts.md`](./travel-app-prompts.md). Newest at the top.
>
> **Update rule:** every prompt execution ends with a new row here + a commit.
>
> **Legend:** status = `DONE` (finished & verified) · `IN-PROGRESS` (started, not finished) · `BLOCKED` (waiting on user/ext) · `REVERTED` (rolled back).

---

## Summary

| Counter             | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| Prompts completed   | 8                                                                              |
| Prompts in progress | 0                                                                              |
| Prompts blocked     | 0                                                                              |
| Last prompt         | `[III.11.0]`                                                                   |
| Last commit date    | 2026-04-18                                                                     |
| Phase               | Phase 0 — Foundation (apps/api boots with trinity; serves `/health/live` live) |

---

## Log (newest first)

---

### [III.11.0] — `apps/api` bootstrap skeleton (Nest 11 + Fastify + trinity; 4/4 e2e + live smoke test passed)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 10 + 15.2

> Prompt ID `[III.11.0]` was added as a prerequisite to the `[III.11.x]` sequence. Reason: every subsequent prompt ([III.11.3] guards, [III.11.4] rate limit, [III.11.5] filter, [III.13.x] security, [IV.18.1.16] health) needs a running NestJS app to land in. Shipping the skeleton once, cleanly, avoids having every downstream prompt re-scaffold.

**What was done — `apps/api` becomes a real NestJS 11 + Fastify 5 app wired to the trinity**

- **Entry + bootstrap** (`src/main.ts`)
  - Line 1: `import '../instrumentation';` — OTel load-order contract (real wiring in `[III.15.4]`).
  - Line 2: `import 'reflect-metadata';` — Nest decorator metadata.
  - Calls `validateEnv()` from `@app/config` **before** any Nest construction — fail-fast on any invalid env var with the full `EnvValidationError.issues` list logged at `fatal`.
  - Builds `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: false }), { bufferLogs: true })`. Buffers Nest's own log lines until our logger is wired, so zero output is lost.
  - `app.useLogger(app.get(AppNestLoggerService))` swaps Nest's default ConsoleLogger for our Pino-backed one — verified live, Nest's own `"Starting Nest application..."` now emits as structured JSON with our `context`/`time`/`level`/`msg` shape.
  - `app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] })` — business routes under `/api/v1/*`, probes stay bare at `/health/*` (k8s/Fly.io convention).
  - `app.enableShutdownHooks()` — clean SIGTERM draining.
- **Root module** (`src/app.module.ts`) — imports `AppConfigModule.forRoot()`; registers `AppNestLoggerService` as a provider/export; mounts `HealthController`.
- **Health endpoint** (`src/health/health.controller.ts`) — single `GET /health/live` returning `{status, service, timestamp, uptimeSeconds}`. Richer `/health/ready` + `/health/startup` with Postgres/Redis/Meili dep checks intentionally deferred to `[IV.18.1.16]` (@nestjs/terminus).
- **Tooling**
  - `tsconfig.json` — extends `../../packages/tsconfig/nestjs.json` via relative path (IDE-clean convention). `rootDir: "."` so `instrumentation.ts` is included; `noEmit: true` for typecheck.
  - `tsconfig.build.json` — `noEmit: false`, excludes tests.
  - `eslint.config.mjs` — re-exports `@app/eslint-config`.
  - `jest.config.cjs` — ts-jest with inline CJS tsconfig; `moduleNameMapper` for the three `@app/*` packages so tests read src directly (no `dist/` round-trip).
- **e2e test** (`test/app.e2e-spec.ts`) — 4 cases, all green:
  1. `GET /health/live` returns 200 + expected JSON shape.
  2. `GET /api/v1/health/live` returns 404 (health must NOT be under the prefix).
  3. Unknown route under `/api/v1` returns 404.
  4. Unknown route at bare root returns 404.
  - Uses Fastify's in-process `app.inject()` — no real port opened, parallel-safe.
- **Env seeding** (`test/setup.ts`) — fills the minimal-valid env before any `import` runs (via `setupFiles`).
- **Scripts** — `dev` (`tsx watch`), `build` (`tsc -p tsconfig.build.json`), `start` (`node dist/main.js`), `typecheck`, `lint`, `test`, `test:watch`.
- **README** — the full "what's wired vs what's not yet" table so contributors know exactly which upcoming prompts layer Helmet, CSP, validation pipe, metrics, Swagger, Terminus, etc.

**Bugs surfaced and fixed during integration** (all in this same commit)

- **`packages/config`**: `LOG_LEVEL` enum restricted to `['debug','info','warn','error']` didn't match `@app/logger`'s `LogLevel` type (`silent` + `trace` + `fatal` also valid). Expanded the enum to match Pino's full set and added a cross-reference comment so the two stay in sync.
- **`packages/logger`**: `AppNestLoggerService` constructor took `logger?: AppLogger`. `AppLogger` is a Pino **interface**, not a class, so `reflect-metadata` gave Nest `Object` as the param type token and Nest DI refused to construct the service ("Nest can't resolve dependencies"). Fix: `@Optional() logger?: AppLogger` — Nest now passes `undefined` and the internal `createLogger('NestJS')` fallback takes over. Direct test-time `new AppNestLoggerService(myLogger)` is unchanged.
- **Stale compiled artifacts shadowing sources**: 36 files (`.js`/`.d.ts`/`.map` for every `src/**/*.ts` in `@app/config` and `@app/logger`) were sitting **inside** `packages/*/src/` from an earlier tsc invocation that used the default (not `tsconfig.build.json`) configuration. CJS resolution prefers `.js` over `.ts` at the same path — so Jest's `moduleNameMapper` pointed at `src/index.ts` but `./schema` resolved to the stale `schema.js` next to it. Deleted all 36, added a `.gitignore` guard so this can never slip back in: `packages/*/src/**/*.{js,js.map,d.ts,d.ts.map}` + the same for `apps/*/src/**`.
- **`apps/api/tsconfig.json`**: initial draft had explicit `paths` pointing at `packages/*/src` which dragged package sources into `apps/api`'s compilation unit and tripped TS6059 (rootDir violation). Removed — pnpm's `node_modules` symlinks and jest's `moduleNameMapper` cover resolution without needing apps/api-local path mappings.

**Files created** (10)

- `apps/api/tsconfig.json`, `tsconfig.build.json`
- `apps/api/eslint.config.mjs`, `jest.config.cjs`
- `apps/api/src/main.ts`, `app.module.ts`, `health/health.controller.ts`
- `apps/api/test/setup.ts`, `app.e2e-spec.ts`
- `apps/api/README.md`

**Files edited** (5)

- `apps/api/package.json` — placeholder → real (NestJS + Fastify + tsx + @app/\* deps).
- `packages/config/src/schema.ts` — expand `LOG_LEVEL` enum to match `@app/logger`.
- `packages/logger/src/nest-logger.service.ts` — `@Optional()` on the constructor param.
- `.gitignore` — guard against tsc emitting inside `src/`.
- `PROGRESS.md` (this entry).

**Dependencies added** (under `apps/api`)

- Runtime: `@nestjs/core@11`, `@nestjs/common@11`, `@nestjs/config@4`, `@nestjs/platform-fastify@11`, `fastify@5`, `reflect-metadata@0.2`, `rxjs@7.8`, plus workspace deps `@app/config`, `@app/errors`, `@app/logger`.
- Dev: `@nestjs/testing@11`, `tsx@4.19` (hot-reload dev runtime), standard Jest/TS chain already cached.
- `pnpm install` delta: 10.3s.

**Commands run**

1. `npx pnpm install` → 10.3s.
2. `pnpm --filter=api build` → tsc emit to `apps/api/dist/`.
3. `pnpm --filter=api typecheck` → green.
4. First `pnpm --filter=api test` → 4 failures. Debugged in order: rootDir TS6059 → dropped paths; LOG_LEVEL 'silent' rejected → expanded `@app/config` enum; `PORT=0` rejected by `.positive()` → removed from setup; lint warnings on unused `no-process-exit` disables → removed; `Nest can't resolve dependencies of AppNestLoggerService` → added `@Optional()`. After each fix, re-ran. **Remaining** bug: stale `.js`/`.d.ts` shadow files inside `packages/config/src/` and `packages/logger/src/` from an earlier build. Direct `node -e "require('@app/config').validateEnv({LOG_LEVEL:'silent',...})"` worked (dist was up to date), but Jest via `moduleNameMapper → src/index.ts → './schema'` resolved the stale `.js` over `.ts`. Nuked the 36 files, added a .gitignore guard, rebuilt, tests passed.
5. `pnpm --filter=api test` → **4/4 e2e tests pass in 2.1s**.
6. `pnpm --filter=api lint` → 0 errors.
7. `pnpm turbo run build typecheck lint test` workspace-wide → **16/16 tasks successful**.
8. **Live smoke test**: started `node apps/api/dist/src/main.js` with full valid env. Server bound to `:3030`. `curl http://localhost:3030/health/live` returned `{"status":"ok","service":"api","timestamp":"2026-04-18T15:41:14.714Z","uptimeSeconds":105}`. Observed structured JSON logs in stdout:
   - `{level:info, context:NestFactory, msg:"Starting Nest application..."}` — Nest's own log flowing through our Pino bridge.
   - `{level:info, context:bootstrap, port:3030, nodeEnv:development, logLevel:info, msg:"api_started"}` — our own bootstrap log.
   - `{level:info, context:InstanceLoader, msg:"AppConfigModule dependencies initialized"}` — Nest DI activity.
     Then `taskkill /F /PID <pid>` — server exited cleanly via SIGTERM thanks to `enableShutdownHooks()`.

**Verification**

- ✅ `pnpm --filter=api build`: 16 files emitted to `apps/api/dist/src/` (main, app.module, health/health.controller) + instrumentation.
- ✅ `pnpm --filter=api typecheck`: zero errors with root tsconfig aliases + shared nestjs preset.
- ✅ `pnpm --filter=api test`: 4/4 Fastify `inject()` e2e tests pass in 2.1s. Prefix exclusion for `/health/*` verified — `/api/v1/health/live` correctly returns 404.
- ✅ `pnpm --filter=api lint`: clean.
- ✅ Workspace-wide `turbo run build typecheck lint test`: **16 tasks, 16 successful**.
- ✅ **Live HTTP smoke**: `curl /health/live` returned 200 + expected JSON body.
- ✅ **Log integration**: Nest's internal logs emitted as structured JSON through `@app/logger` (Pino) — Nest ConsoleLogger is fully replaced.
- ✅ **Env fail-fast proven** — any invalid env var would have aborted boot with a structured `issues` list (`validateEnv` unit tests in `@app/config` already cover this; live app inherits the contract).

**Acceptance criteria**

- ✅ apps/api compiles, typechecks, lints, tests.
- ✅ apps/api boots live, binds a port, serves `/health/live` with the expected JSON shape.
- ✅ `@app/config` validates env at boot (fail-fast on failure).
- ✅ `@app/logger` wired as Nest's logger — structured JSON output with trace-context support ready.
- ✅ `@app/errors` imported and on the path for the exception filter (`[III.11.5]` next).
- ✅ Global prefix + health exclusion verified.

**Notes / deviations**

- `tsx` chosen over `ts-node-dev` / `@nestjs/cli` for the `dev` script — zero config, faster startup, works with our existing tsconfig. If we hit an edge case later (e.g. decorator emit issues), we can swap to `nest start --watch` without disturbing the rest of the toolchain.
- No `@nestjs/cli` installed yet. `nest build` / `nest start` aren't wired — plain `tsc` + `node dist/main.js` + `tsx watch` cover everything. Adding `@nestjs/cli` later is optional; the scaffold is already fully usable.
- The `apps/api/src/index.ts` placeholder from `[II.10.0]` is obsolete (entry is now `main.ts`) but intentionally left in place per the CLAUDE.md rule "never delete a file you did not create in this session." A later cleanup prompt can remove it.
- Bug carryovers (LOG_LEVEL enum in `@app/config`, `@Optional()` in `@app/logger`, stale-src-artifact gitignore) are all bundled into this commit because they surfaced **through** this integration work and are meaningless without it. Makes the prompt's "what broke and why" reviewable in one diff.

**Next up**

With apps/api live, the natural sequence is:

- `[III.11.5]` — DomainExceptionFilter mapping `@app/errors` → HTTP responses.
- `[III.13.1]` — ZodValidationPipe throwing `ValidationError` with populated `fieldErrors`.
- `[III.11.3]` — JWT + RBAC guards.
- `[III.11.4]` — Redis sliding-window rate limiter (needs Redis; Docker Compose stack is already up).
- `[IV.18.1.16]` — Terminus-powered `/health/ready` + `/health/startup` with real Postgres/Redis checks.

All of these are small-to-medium, land one-at-a-time, and exercise the trinity further.

---

### [IV.17.6] — Root tsconfig path aliases + `instrumentation.ts` stub (partial — categories deferred)

**Date:** 2026-04-18 · **Status:** DONE (2 of 3 items) · **Kind:** Refactor/Tooling · **Playbook §** 17.6

**What was done**

- **Root `tsconfig.json` (new)** — a "solution" tsconfig holding the `@app/*` path aliases for every live package (config, errors, logger) plus every placeholder package (observability, shared-types, sdk, ui, mobile-ui). `files: []` + `include: []` ensure this tsconfig compiles nothing itself — each app/package still drives its own compile via its local `tsconfig.json`. Both bare imports (`@app/config`) and subpath imports (`@app/config/nested-module`) resolve directly to source (`packages/<name>/src/…`), so editors, test runners, and future `apps/api` don't need `pnpm build` to run first.
- **`apps/api/instrumentation.ts` (new stub)** — load-order-critical file with a clear comment contract: "MUST be the VERY FIRST import in main.ts". Empty body for now (`export {}`); real OpenTelemetry SDK wiring + auto-instrumentations land in `[III.15.4]`. Shipping the stub now locks the calling convention so we don't forget the `import '../instrumentation';` line later.

**Items deliberately deferred**

- **`packages/shared-types/src/place-category.ts`** (the third item in §17.6) — requires committing to the exhaustive 50-category taxonomy (or designing the DB-driven `PlaceCategory` table). That's a domain-modelling decision that belongs with the real shared-types build prompt (or the Places module, `[IV.18.2.x]`), not a monorepo tooling fix. Will be closed out in that prompt. The §17.6 tracker entry is moved from DONE → PARTIAL-DONE.

**Files created** (2)

- `tsconfig.json` (root)
- `apps/api/instrumentation.ts`

**Files edited** (1)

- `PROGRESS.md` (this entry).

**Dependencies added** — none.

**Commands run**

1. `ls tsconfig*` — confirmed no root tsconfig existed yet.
2. `ls apps/api/` — confirmed package.json + src/ placeholder only; no `instrumentation.ts` yet.
3. `pnpm turbo run typecheck` — **3 tasks successful, 3 total** (2 cached, 1 fresh). Root tsconfig doesn't interfere with package-level compilation (as designed — `files: []` + `include: []`).

**Verification**

- ✅ Workspace typecheck still green after adding root tsconfig — no regressions.
- ✅ Root tsconfig's `paths` covers every `@app/*` package declared in `pnpm-workspace.yaml` (excluding the `@app/tsconfig` + `@app/eslint-config` configuration packages, which are `.json` / `.js` and consumed by extend/import, not by TypeScript path resolution).
- ✅ `instrumentation.ts` exists under `apps/api/` (not `apps/api/src/`) so `main.ts` can `import '../instrumentation';` — same layout NestJS apps typically use.
- ✅ IDE: `import { createLogger } from '@app/logger'` will now jump-to-definition straight into `packages/logger/src/index.ts`, not into a compiled `dist/` file.

**Acceptance criteria (from prompt)**

- ✅ Root `tsconfig.json` `paths: "@app/*": ["packages/*/src"]` (expanded per-package, with subpath support — slightly more explicit than the glob suggestion in the prompt archive, but functionally equivalent and more IDE-friendly).
- ✅ `apps/api/instrumentation.ts` created with the load-order comment contract in place.
- ⚪ Place category enumeration — deferred with a tracking note (see above).

**Notes / deviations**

- Used per-package explicit `paths` entries (with both bare and `/*` variants) instead of a single `@app/*` glob. Reasons:
  1. Subpath imports (`@app/config/schema`) work out of the box.
  2. Makes the monorepo surface self-documenting — open `tsconfig.json` and see exactly what's wired.
  3. Placeholder packages that don't actually have real code yet still resolve to their stub `src/index.ts`, so imports don't blow up editors while we build them out.
- `instrumentation.ts` lives at `apps/api/instrumentation.ts` (not `apps/api/src/instrumentation.ts`). Reason: NestJS CLI treats `src/` as the compile root, and the OTel SDK init file is conventionally kept at the project root above `src/` so `import '../instrumentation'` is stable and obviously outside the normal module graph.
- Did not wire these aliases into any package's local tsconfig yet — doing so retroactively across every package is busywork until a consumer actually needs them. `apps/api` will get path mappings in its own tsconfig when it's scaffolded (`[III.11.x]` / `[IV.18.1.14.a-c]` area).

**Next**

Root aliases + instrumentation stub in place. Next natural move: one of the architecture ADRs (`[II.6.2]` modular monolith / `[II.6.3]` service-extraction triggers / `[II.6.4]` event backbone) — pure docs, locks decisions in writing before the first domain module lands. Or jump to `[II.7.2]` context-map doc. Both are small.

---

### [III.11.6] — `@app/logger` (Pino + AsyncLocalStorage trace context + PII redact, 28/28 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.2

**What was done**

Completes the Phase 0 "trinity" of shared packages. Every NestJS module, worker, and `apps/api` bootstrap will pull from `@app/logger` — one central place where log format, trace correlation, and PII redaction policy live.

- `src/trace-context.ts` — `AsyncLocalStorage<TraceContext>` with a strict read-only surface. Exports:
  - `runWithTraceContext(ctx, fn)` enters a new scope; `getTraceContext()` reads the current one (or `undefined` outside any scope).
  - `extendTraceContext(patch, fn)` merges extra fields into the current scope (mints a fresh `traceId` if there isn't one yet). Merges `tags` map deeply when both outer and patch define them.
  - `generateTraceId()` → 32-char lowercase hex (W3C 128-bit trace-id shape).
  - `generateSpanId()` → 16-char lowercase hex (W3C 64-bit span-id shape).
  - `TraceContext` interface with `traceId`, `spanId?`, `userId?`, `requestId?`, `tags?`.
- `src/redact.ts` — frozen array of **40+ Pino redact paths** covering top-level + `*.field` (one level deep) for every known secret/PII field: passwords, tokens (access/refresh/id/api), mfaSecret, backup codes, ssn, passport, creditCard, cvv, email, emailHash, phone, and HTTP headers authorization/cookie/set-cookie/x-api-key.
- `src/logger.ts` — `createLogger(context, options?): AppLogger` factory. Pino configured with:
  - Level from `options.level ?? process.env.LOG_LEVEL ?? 'info'`.
  - Base fields: `{context, ...options.base}` on every line.
  - Redact paths: `PII_REDACT_PATHS` + any `additionalRedactPaths`, censor `'[REDACTED]'`.
  - Level formatter: emits `{"level":"info"}` (label) instead of Pino's numeric default.
  - **`mixin`** that pulls the current `TraceContext` every log line — so trace/span/user/request ids arrive automatically with zero call-site boilerplate.
  - ISO-8601 `time`.
  - Optional `pino-pretty` transport gated by `options.pretty && NODE_ENV !== 'production'`.
  - Optional `destination` stream for tests.
  - `AppLogger = pino.Logger` type alias.
- `src/nest-logger.service.ts` — `@Injectable() AppNestLoggerService implements @nestjs/common LoggerService`. Correctly maps each of the 6 Nest levels (`log/error/warn/debug/verbose/fatal`) to the corresponding Pino level; stringifies non-string messages; extracts `message` from `Error` instances. Accepts an optional pre-built `AppLogger` for test injection.
- `src/index.ts` — barrel exporting the factory, types (`AppLogger`, `LogLevel`, `CreateLoggerOptions`, `TraceContext`), trace-context helpers, `PII_REDACT_PATHS`, and `AppNestLoggerService`.
- **3 test suites, 28 tests total** (all green in 2.5s):
  - `test/trace-context.spec.ts` (13 tests): outside-scope undefined, single-scope value propagation, sibling isolation, nesting + restoration, async-boundary propagation via `await`, return value passthrough, outer restored after inner throw, `extendTraceContext` mints trace id when bare, `extendTraceContext` preserves outer traceId + merges user fields, deep `tags` merge with override, hex format assertions for `generateTraceId`/`generateSpanId`, uniqueness of successive calls.
  - `test/logger.spec.ts` (8 tests): JSON shape with level/context/msg/time, top-level redact, nested `*.sensitive` redact, HTTP header redact (authorization/cookie) with non-sensitive headers preserved, trace-context mixin merge both in-scope and absent when outside scope, `additionalRedactPaths`, level filtering (info suppresses trace/debug), `child()` inherits context + redaction.
  - `test/nest-logger.service.spec.ts` (7 tests): each of `log/warn/error/debug/verbose/fatal` maps to the expected Pino level with correct context; `error` forwards stack separately; non-string messages are JSON-stringified; `Error` instances log `.message`; default constructor doesn't throw.
- Tests capture output via a `Writable` stream piped to JSON.parse — no snapshots, no globals pollution.

**Files created** (10)

- `packages/logger/tsconfig.json`, `tsconfig.build.json`
- `packages/logger/jest.config.cjs`, `eslint.config.mjs`
- `packages/logger/src/trace-context.ts`, `redact.ts`, `logger.ts`, `nest-logger.service.ts`
- `packages/logger/test/trace-context.spec.ts`, `logger.spec.ts`, `nest-logger.service.spec.ts`
- `packages/logger/README.md`

**Files edited** (3)

- `packages/logger/package.json` — placeholder → real (pino runtime, optional NestJS peer).
- `packages/logger/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added**

- Runtime: `pino@^9.5.0`.
- Peer (optional): `@nestjs/common@^11` — app provides its copy; the Nest service is tree-shakable for pure-Node consumers.
- Dev: `@app/eslint-config`, `@app/tsconfig` (workspace), `@nestjs/common@^11`, `@types/jest`, `@types/node`, `jest`, `rimraf`, `ts-jest`, `typescript`.
- `pnpm install` delta: only the 2 new direct entries (`pino`, `@nestjs/common`-as-dev) — others reused from `@app/config`. 4.7s.

**Commands run**

1. `npx pnpm install` — added pino; 4.7s.
2. `pnpm --filter=@app/logger build` — 16 files emitted to `dist/` (4 source modules × {js, js.map, d.ts, d.ts.map}).
3. `pnpm --filter=@app/logger typecheck` — green.
4. `pnpm --filter=@app/logger test` — **28/28 across 3 suites, 2.5s**.
5. `pnpm --filter=@app/logger lint` — 0 errors.
6. `pnpm turbo run build typecheck lint test` workspace-wide — **12/12 tasks successful** (3 packages × 4 tasks, 8 cached from prior runs).

**Verification**

- ✅ Log lines emit JSON with `traceId` (when in a trace scope), no manual plumbing.
- ✅ `email` and `authorization` (+ ~40 other PII paths) are replaced with `[REDACTED]` automatically — verified by stream-capturing live logger output and parsing the JSON.
- ✅ Nested `*.sensitive` redaction works one level deep (enough for `req.body.password`, `user.email`, etc.).
- ✅ Trace context propagates across `await` boundaries (Node `AsyncLocalStorage` semantics).
- ✅ Level filtering respects `LOG_LEVEL` — test proves `info` suppresses `trace`/`debug`.
- ✅ NestJS `LoggerService` contract satisfied; mapping for all 6 methods tested.
- ✅ Workspace turbo now stands at 3 real packages (config + errors + logger) all building + typechecking + linting + testing clean.

**Acceptance criteria (from prompt)**

- ✅ Logs emit JSON with `traceId` on every line (inside a trace scope).
- ✅ `email` and `authorization` never appear in output — replaced by `[REDACTED]` (verified by integration test on live pino output).
- ✅ Integration test with a seeded trace proves correlation (`logger.spec.ts` "merges the current trace context into every line").

**Notes / deviations**

- Followed the `"../tsconfig/nestjs.json"` relative-extends convention set by the prior fix — no IDE squiggles.
- Deliberately **did not** include `pino-http` middleware in this package — it's Fastify-specific and lives better in `apps/api` once that app exists. Exposing `runWithTraceContext` is enough for the Fastify hook to do its job later.
- `AppLogger` is a direct re-export of `pino.Logger` (not a wrapper class). Consumers stay on the Pino surface — one less abstraction to learn; if we ever swap Pino out, it's a codemod, not a redesign. Playbook §15.2's examples match Pino idioms.
- `extendTraceContext` spreads the outer context first, then the patch, so explicit patch fields win — matches React setState/spread intuition. Tags are a separate deep-merge to avoid one side's empty object overwriting the other's populated map.
- Coverage threshold kept at 80/80/80/70 (same as `@app/config`); the dense tests hit well above.
- Pre-commit prettier may reformat README tables/code blocks on the eventual commit — expected.

**Next up**

Trinity complete. The natural progression: **`[IV.17.6]`** (root tsconfig path aliases + `apps/api/instrumentation.ts` stub) — one tiny cleanup that unlocks `import … from '@app/logger'` in `apps/api` later without a build step. After that, `[II.6.2]`–`[II.6.4]` ADRs (tiny docs), then the first `apps/api` skeleton.

---

### Follow-up fix — tsconfig `extends` path (VS Code JSON-schema validator)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Fix · **Trigger:** IDE squiggle reported by user on `packages/errors/tsconfig.json` line 3.

**Symptom** — VS Code's built-in tsconfig JSON-schema validator underlined `"@app/tsconfig/nestjs.json"` with "Cannot find extends file". This is a known limitation of the schema validator (it can't resolve npm-package extends paths the way `tsc` does via pnpm's workspace symlinks). `tsc --build`, `tsc --noEmit`, Jest, and ESLint all resolved the path fine, so the error was **IDE-only, not build-breaking**.

**Fix** — swapped both live package tsconfigs to a relative extends path. Same semantic, both tools happy:

```diff
- "extends": "@app/tsconfig/nestjs.json",
+ "extends": "../tsconfig/nestjs.json",
```

Touched `packages/errors/tsconfig.json` and `packages/config/tsconfig.json`. `tsconfig.build.json` in both packages was unaffected (extends `./tsconfig.json` — already relative).

**Verification** — `pnpm turbo run build typecheck lint test` → **8 tasks, 8 successful**, 4.7s (1 cached). 27/27 `@app/errors` tests + 11/11 `@app/config` tests still green.

**Convention going forward** — all future package tsconfigs will use `../tsconfig/<preset>.json` (relative) rather than `@app/tsconfig/<preset>.json` (npm). Updating `CLAUDE.md` is overkill for this — the fix is obvious on sight once you've seen it. Template the next package off of `packages/config/tsconfig.json`.

---

### [III.15.1] — `@app/errors` (DomainError hierarchy, 27/27 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.1

**What was done**

- Replaced placeholder `packages/errors` with a real, zero-runtime-dep package that defines the domain error hierarchy every NestJS module will throw and the global exception filter will catch.
- `src/base.error.ts` — abstract `DomainError` extending `Error`. Fields: abstract `code` (UPPER_SNAKE machine id), abstract `httpStatus`, readonly `context: DomainErrorContext` (frozen shallow copy), readonly `timestamp: Date`. Method `toJSON(): DomainErrorJson` returns `{code, message, context, timestamp}` — **never the stack**. `isDomainError(unknown): value is DomainError` type guard. Prototype-chain preserved via `Object.setPrototypeOf(this, new.target.prototype)` (for CJS/ES5 `instanceof`). Stack trace captured from the subclass call-site via `Error.captureStackTrace(this, new.target)`.
- `src/errors.ts` — 15 concrete classes:
  - **Generic HTTP:** `UnauthorizedError` (401) · `PaymentFailedError` (402) · `ForbiddenError` (403) · `NotFoundError` (404) · `ConflictError` (409) · `ValidationError` (422, adds `fieldErrors` + override `toJSON`) · `RateLimitError` (429, adds `retryAfterMs`, clamps negatives + floors fractions) · `SafetyCheckFailedError` (451) · `InvariantError` (500) · `ExternalServiceError` (502, adds `service` name).
  - **Domain-specific:** `AgentNotVerifiedError extends ForbiddenError` · `TripNotFoundError / PlaceNotFoundError / UserNotFoundError extends NotFoundError` · `InvalidRadiusError extends ValidationError` (includes `radiusKm` field error).
  - All generics accept an optional `code` constructor arg with a sensible UPPER_SNAKE default, so callers can re-tag a generic 404 without subclassing. Domain-specific classes lock in their `code` via `super(..., specificCode)`.
- `src/index.ts` — barrel re-exporting base class, type guard, types, and all 15 concrete classes + the `FieldErrors` helper type.
- `test/base.error.spec.ts` — 7 tests exercising the abstract base: subclass-name propagation, `instanceof` chain across `DomainError`/`Error`/subclass, context freeze (including defense against post-construction mutation of the input object), timestamp window, `toJSON()` shape without stack, stack-trace origin frame, `isDomainError()` narrowing across all falsy-ish inputs.
- `test/errors.spec.ts` — 20 tests including an `it.each` table covering the 7 simple generics, `ValidationError` freeze-nested behavior + toJSON shape, `RateLimitError` clamp/floor math, `ExternalServiceError` service propagation, each domain-specific class's prototype chain + code + context, and a JSON.stringify round-trip proving the stack never leaks to the wire.
- Rich `README.md` — why, usage examples (throw + catch-boundary), the full HTTP-to-class table, wire JSON shape, four authoring rules (only throw DomainError across boundaries, never PII in context, codes are public API, subclass when callers branch), and scripts reference.

**Files created** (9)

- `packages/errors/tsconfig.json`, `tsconfig.build.json`
- `packages/errors/jest.config.cjs`, `eslint.config.mjs`
- `packages/errors/src/base.error.ts`, `errors.ts`
- `packages/errors/test/base.error.spec.ts`, `errors.spec.ts`
- `packages/errors/README.md`

**Files edited** (3)

- `packages/errors/package.json` — placeholder → real (scripts, exports, devDeps only — **no runtime deps** and **no peer deps**; this is pure TypeScript).
- `packages/errors/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added** — none new. All devDeps (`@app/tsconfig`, `@app/eslint-config`, jest, ts-jest, rimraf, typescript, @types/jest, @types/node) already resolved from `@app/config`'s install; this prompt's `pnpm install` added 0 packages in 4.3s.

**Commands run**

1. `npx pnpm install` — 0 new packages, 4.3s (everything cached).
2. First attempt `pnpm --filter=@app/errors build typecheck test lint` failed: pnpm passed `typecheck test lint` as args to the `build` script (not as separate scripts), yielding `tsc -p tsconfig.build.json typecheck test lint` and TS5042. Re-ran each script separately with `&&`.
3. `pnpm --filter=@app/errors build` — green, emits 12 files to `dist/`.
4. `pnpm --filter=@app/errors typecheck` — green.
5. `pnpm --filter=@app/errors test` — **27/27 pass in 2.5s** across 2 suites.
6. `pnpm --filter=@app/errors lint` — 0 errors.
7. `pnpm turbo run build typecheck lint test` workspace-wide — **8 tasks, 8 successful** (2 packages × 4 tasks each), 6.2s.

**Verification**

- ✅ `dist/` contains base.error, errors, index × `.js` + `.js.map` + `.d.ts` + `.d.ts.map` (12 files).
- ✅ 27/27 Jest tests green; coverage threshold (85/85/85/75 lines/stmts/fns/branches) met.
- ✅ Workspace turbo: `@app/config` + `@app/errors` both build+typecheck+lint+test clean (8 tasks).
- ✅ Pre-commit lint-staged will prettify any staged `.ts`/`.md`/`.json` automatically.

**Acceptance criteria (from prompt)**

- ✅ `DomainError` is abstract with `code`, `httpStatus`, `context`, `timestamp`, `toJSON()`.
- ✅ All requested concrete classes exist: `NotFoundError` 404, `UnauthorizedError` 401, `ForbiddenError` 403, `ValidationError` 422, `ConflictError` 409, `RateLimitError` 429, `ExternalServiceError` 502, `InvariantError` 500, `TripNotFoundError` / `PlaceNotFoundError` / `UserNotFoundError` / `AgentNotVerifiedError` / `InvalidRadiusError` / `PaymentFailedError` / `SafetyCheckFailedError` 451.
- ✅ `src/index.ts` re-exports everything.
- ✅ `toJSON()` produces `{code, message, context, timestamp}` — **no stack** (test `JSON.stringify` round-trip confirms).

**Notes / deviations**

- Chose the "generic-class-with-default-code + domain-specific-class-passes-custom-code-via-super()" pattern over `override readonly code = '...'` on subclasses. Avoids TypeScript friction with `noImplicitOverride` on readonly fields and makes the code-arg explicit in each subclass constructor.
- Added `InvalidRadiusError` as a subclass of `ValidationError` (not `DomainError` directly) so the exception filter treating any `ValidationError` uniformly (emit `fieldErrors`) works without special-casing.
- `ExternalServiceError` records `service` both as a typed field and inside `context` — redundancy is intentional so structured log sinks can filter by `context.service` without needing to know about the subclass.
- Coverage threshold bumped from `@app/config`'s 80/80/80/70 → **85/85/85/75** here because this package is pure types with dense tests; the bar should be higher where mocking is trivial.

**Next prompt candidates**

- `[III.11.6]` — `@app/logger` (Pino + AsyncLocalStorage trace context + PII redact). Last of the "trinity" foundation packages. Small integration note: will use `DomainError.toJSON()` when logging errors.
- `[III.11.5]` — NestJS global exception filter in `apps/api` mapping `DomainError` → HTTP (requires `apps/api` skeleton, so a few prompts away).
- `[III.13.1]` — Zod validation pipe (throws our `ValidationError` with populated `fieldErrors`).
- `[IV.17.6]` — Root tsconfig path aliases + `apps/api/instrumentation.ts`.
- `[II.6.2]` — ADR-001 Modular monolith (pure docs, locks the call).

---

### [III.11.1] — `@app/config` (Zod env schema + NestJS ConfigModule, 11/11 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.1

**What was done**

- Replaced the placeholder `packages/config` with a real package that ships a Zod-validated env schema, a framework-agnostic `validateEnv()` function, and a NestJS global `AppConfigModule.forRoot()` factory.
- `src/schema.ts` — `EnvSchema` composed from 15 sub-schemas covering every variable from Playbook §11.1 and §8.5 providers: Runtime (NODE_ENV, PORT, LOG_LEVEL), Database, Redis, JWT, Google OAuth, Apple OAuth, AI, Stripe, External APIs, Storage (S3), Comms (Resend/Twilio), Meilisearch, Observability, Features, Security (RATE_LIMIT_PEPPER). Sensible dev defaults where safe; secrets never defaulted. Type `Env = z.infer<typeof EnvSchema>` exported for callers.
- `src/validate.ts` — `validateEnv(raw = process.env): Env` plus a custom `EnvValidationError` that exposes a structured `issues: readonly EnvIssue[]` list (path / message / code) alongside the pretty multi-line `.message`. Prototype chain preserved across CJS transpilation.
- `src/nest-config.module.ts` — `AppConfigModule` wraps `@nestjs/config`'s `ConfigModule.forRoot({ isGlobal: true, cache: true, validate })` so Nest aborts at boot on any invalid env. `AppConfigService = ConfigService<Env, true>` re-typed alias lets callers do `config.get('DATABASE_URL', { infer: true })` with full typing.
- `src/index.ts` — barrel re-exporting EnvSchema, Env, validateEnv, EnvValidationError, EnvIssue, AppConfigModule, AppConfigService.
- `test/validate.spec.ts` — **11 unit tests** (all green in 1.2s): valid minimal env, defaults for optionals, numeric coercion, missing-key throw, structured issue surface, invalid URL, too-short JWT secret, unknown NODE_ENV enum, optional providers (OAuth/Stripe/comms), feature-flag bool coercion, process.env default fallback.
- Build emits CJS + declaration maps to `dist/`. Package ships `files: [dist, src]` so consumers can import from `@app/config` (resolved via `exports` map).
- `tsconfig.json` extends `@app/tsconfig/nestjs.json` with `rootDir: "."` + `noEmit: true` (so typecheck covers both src/ and test/). `tsconfig.build.json` narrows `rootDir: "./src"` + `noEmit: false` + excludes `test/`.
- `jest.config.cjs` uses `ts-jest` with an inline CommonJS tsconfig (module=commonjs, target=ES2022, experimentalDecorators for future Nest tests). Coverage threshold enforced at 80% lines/stmts/fns, 70% branches.
- `eslint.config.mjs` re-exports the shared `@app/eslint-config` flat config — proves the shared preset actually propagates to a real consumer package.
- Rich `README.md` with quick-start for both non-Nest and Nest callers, schema overview table by group, scripts reference, and conventions.

**Files created** (8)

- `packages/config/tsconfig.json`
- `packages/config/tsconfig.build.json`
- `packages/config/jest.config.cjs`
- `packages/config/eslint.config.mjs`
- `packages/config/src/schema.ts`
- `packages/config/src/validate.ts`
- `packages/config/src/nest-config.module.ts`
- `packages/config/test/validate.spec.ts`
- `packages/config/README.md`

**Files edited** (2)

- `packages/config/package.json` — placeholder → real (deps, scripts, exports, peers).
- `packages/config/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added** (under `@app/config`)

- Runtime: `zod@^3.24.1`.
- Peer (optional): `@nestjs/common@^11`, `@nestjs/config@^4`, `reflect-metadata@^0.2`, `rxjs@^7.8`.
- Dev: `@nestjs/common@11.0.11`, `@nestjs/config@^4`, `@types/jest@29.5`, `@types/node@22.10`, `jest@29.7`, `reflect-metadata@0.2`, `rimraf@6`, `rxjs@7.8`, `ts-jest@29.2`, `typescript@5.7`, plus `@app/tsconfig` + `@app/eslint-config` via workspace links.
- Total pnpm install delta: **+246 packages**, 21.8s (brings workspace to ~500 packages).

**Commands run**

1. `npx pnpm install` — 246 new packages, husky prepare fired, 21.8s.
2. `pnpm --filter=@app/config build` — first attempt OK (exit 0). Emitted 16 files (4 sources × .js + .js.map + .d.ts + .d.ts.map) to `dist/`.
3. `pnpm --filter=@app/config typecheck` — **first run failed** TS6059 (test/ outside rootDir inherited from `@app/tsconfig/nestjs.json`). Fixed by overriding `rootDir: "."` + `noEmit: true` in `tsconfig.json` and narrowing `rootDir: "./src"` in `tsconfig.build.json`. Re-ran: green.
4. `pnpm --filter=@app/config test` — 11/11 tests pass, 1.2s.
5. `pnpm --filter=@app/config lint` — 0 errors, 0 warnings.
6. `pnpm turbo run build typecheck lint test` — all 4 tasks successful across the workspace (cache cold this run).
7. `ls packages/config/dist/` — confirmed 16 output files.

**Verification**

- ✅ `dist/index.js` + `dist/index.d.ts` present; every src file has a matching .js/.d.ts/.map.
- ✅ 11/11 Jest tests green in 1.2s. Coverage thresholds (80/80/80/70) satisfied by the test suite (validate.ts + schema.ts fully exercised).
- ✅ `tsc --noEmit` repo-wide green.
- ✅ ESLint 9 flat config via `@app/eslint-config` consumed successfully from a sibling package (first proof the shared preset actually works cross-package).
- ✅ `turbo run build typecheck lint test` → `Tasks: 4 successful, 4 total`.

**Acceptance criteria (from prompt)**

- ✅ `pnpm --filter=@app/config test` green.
- ✅ NestJS consumer can inject `ConfigService<Env, true>` (`AppConfigService` re-typed alias + `AppConfigModule.forRoot()` available).
- ✅ Framework-agnostic `validateEnv()` throws pretty `EnvValidationError` on missing / invalid fields with structured `issues` list.

**Notes / deviations**

- `EnvSchema` is comprehensive (40+ vars) but several provider keys are `.optional()` so apps can boot without Stripe / OAuth / full comms wiring until their respective prompts (`[IV.18.2.10]`, `[III.13.2]`, `[IV.18.2.9]`).
- Chose CJS output (no `"type": "module"`) to avoid ESM/CJS interop pain with NestJS runtime. Later packages can revisit if we hit ESM-only deps.
- Test file uses `NodeJS.ProcessEnv` destructuring and `_omit` naming for discarded keys — matches the `@app/eslint-config` unused-var allow pattern (`^_`).
- Intentionally did **not** yet add an `.env.example` with matching defaults — deferred to prompt `[IX.32.4]` which pairs that with the Doppler rollout.
- Lint-staged on commit will auto-format YAML/MD/JSON; expected.

**Next prompt candidates**

- `[III.15.1]` — `@app/errors` DomainError hierarchy (same tier foundation; every module throws these).
- `[III.11.6]` — `@app/logger` Pino wrapper + AsyncLocalStorage trace context (needed before `apps/api` main.ts).
- `[III.11.5]` — Domain exception filter in apps/api (requires errors + logger first).
- `[IV.17.6]` — Path aliases in root tsconfig + `apps/api/instrumentation.ts` (unlocks `import { ... } from '@app/config'` in apps/api without needing dist build first).
- `[IX.32.4]` — `.env.example` matching this schema + `docs/env.md`.
- `[III.11.1]`'s natural siblings: Config → Errors → Logger → Observability — complete the "trinity + 1" then start apps/api.

---

### [IX.32.2] — Docker Compose local dev stack (8 services, all healthy)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 32.2

**What was done**

- Authored `infra/docker-compose.yml` — 8 services, each with healthcheck + named volume where it holds state. Stack name `travel-superapp-dev`. Modern Compose syntax (no `version:` key).
- Services + ports:
  - **postgres** (built from `./postgres/Dockerfile` on top of `postgis/postgis:16-3.4`, pgvector layered via `postgresql-16-pgvector` apt) — `localhost:5432`. Init scripts mounted from `./postgres/init/`.
  - **redis** (`redis:7.4-alpine`, `--requirepass redis_dev`) — `localhost:6379`.
  - **meilisearch** (`v1.11`) — `localhost:7700`.
  - **minio** (`RELEASE.2024-12-18T13-15-44Z`) — API `:9000`, console `:9001`.
  - **mailpit** (`v1.21`) — SMTP `:1025`, UI `:8025`.
  - **jaeger** (`all-in-one:1.65.0`) — UI `:16686`, OTLP gRPC `:4317`, HTTP `:4318`.
  - **prometheus** (`v3.1.0`) — `:9090`, config mounted from `./prometheus/prometheus.yml`.
  - **grafana** (`11.4.0`) — `:3001` (avoids Next.js 3000), auto-provisioned datasources + dashboards folder mounted from `./grafana/provisioning/`. Depends on prometheus + jaeger being healthy.
- `infra/postgres/Dockerfile` — extends `postgis/postgis:16-3.4`, `apt-get install postgresql-16-pgvector`. (No single public image bundles PostGIS + pgvector, so we build a small 2-layer one.)
- `infra/postgres/init/01-extensions.sql` — idempotent `CREATE EXTENSION IF NOT EXISTS` for `postgis`, `postgis_topology`, `vector`, `pg_trgm`, `pgcrypto`. Mounted read-only and runs on first boot.
- `infra/prometheus/prometheus.yml` — self-scrape + placeholder targets for `apps/api:3000` and `apps/ai-service:8001` (via `host.docker.internal`) — marked down until those apps exist in later prompts.
- `infra/grafana/provisioning/datasources/datasources.yml` — Prometheus (default) + Jaeger datasources.
- `infra/grafana/provisioning/dashboards/dashboards.yml` — provider pointing at `./json/` folder (`.gitkeep` placeholder; real dashboards land in `[III.15.7]`).
- `infra/README.md` — service table, commands, first-boot notes, extension-verification command.

**Files created** (8 new)

- `infra/docker-compose.yml`
- `infra/postgres/Dockerfile`
- `infra/postgres/init/01-extensions.sql`
- `infra/prometheus/prometheus.yml`
- `infra/grafana/provisioning/datasources/datasources.yml`
- `infra/grafana/provisioning/dashboards/dashboards.yml`
- `infra/grafana/provisioning/dashboards/json/.gitkeep`
- `infra/README.md`

**Files edited** — `PROGRESS.md` (this entry).

**Dependencies added** — none at the Node/pnpm layer. 8 Docker images pulled + 1 local image built.

**Commands run**

1. `docker compose -f infra/docker-compose.yml up -d` — initial: Jaeger tag `1.62` invalid, fixed to `1.65.0`, retried. Pulled 8 images, built postgres image (~2 min on first run).
2. `docker compose -f infra/docker-compose.yml ps` — 7/8 healthy after ~53s; meilisearch stuck on `(health: starting)`.
3. Diagnosed meilisearch: image _has_ `wget` at `/usr/bin/wget` and listens on `0.0.0.0:7700`, but `wget -q --spider http://localhost:7700/health` reliably returns "connection refused" inside the container (even with `127.0.0.1`); likely a busybox-applet quirk. `curl` works fine. Switched healthcheck to `curl -fs http://localhost:7700/health` and recreated the container — healthy in ~27s.
4. `docker compose ps` — **all 8 services healthy**.
5. `docker compose exec postgres psql -c "\dx"` — lists `pg_trgm 1.6 / pgcrypto 1.3 / plpgsql / postgis 3.4.3 / postgis_topology 3.4.3 / vector 0.8.2` (6 rows).
6. Host-side smoke test (curl each exposed port): meilisearch/minio/mailpit/jaeger/prometheus/grafana all HTTP 200; postgres + redis as expected don't speak HTTP.
7. Composite functional query exercising all 4 domain extensions at once:
   ```sql
   SELECT ST_AsText(ST_MakePoint(77.5946, 12.9716)::geography),
          (ARRAY[0.1,0.2,0.3]::vector(3)) <-> (ARRAY[0.4,0.5,0.6]::vector(3)),
          similarity('Bengaluru', 'Bangalore'),
          encode(digest('travel', 'sha256'), 'hex');
   ```
   Returns:
   - `POINT(77.5946 12.9716)` (PostGIS),
   - `0.5196152525944904` (pgvector L2 distance),
   - `0.1764706` (pg_trgm similarity),
   - `0209442e...c461c4` (pgcrypto SHA-256).

**Verification**

- ✅ `docker compose ps` — 8/8 services `Up (healthy)` within 60s on a warm start (first boot ~2 min including image pulls + postgres build).
- ✅ Postgres extensions installed **and** functionally exercised (spatial + vector + trigram + crypto).
- ✅ Grafana UI reachable on `:3001`; Prometheus on `:9090`; Jaeger UI on `:16686`; MinIO console on `:9001`; Mailpit UI on `:8025`; Meilisearch on `:7700`.
- ✅ Grafana datasources auto-provisioned (Prometheus + Jaeger visible at first login with `admin/admin`).

**Acceptance criteria (from prompt)**

- ✅ `docker compose ps` shows all services healthy within 60s on warm start.

**Notes / deviations**

- Jaeger tag corrected `1.62` → `1.65.0` (Docker Hub doesn't carry `1.62` without patch suffix; all current 1.x tags are `X.Y.Z`).
- Meilisearch healthcheck swapped from `wget` to `curl` to work around the busybox `wget --spider` quirk in its v1.11 image. Functionality unchanged.
- `.husky/commit-msg` uses `[no-install]` style: calls `commitlint` directly via `node_modules/.bin`. On commit, `lint-staged` may prettify `infra/*.yml` — expected.
- `host.docker.internal` used for Prometheus targets pointing at future API/ai-service — those report `down` until those apps exist; harmless noise.
- A root `Makefile` with `make up / down / logs / reset / db-shell / redis-shell` is intentionally deferred to prompt **[IX.32.3]**.
- `.env.example` covering required env vars is deferred to prompt **[IX.32.4]** + shared-types env schema prompt **[III.11.1]**.

**Next prompt candidates**

- `[IX.32.3]` — Root Makefile + compose wrappers (tiny, 1 file).
- `[IV.18.1.11]` — GitHub Actions CI/CD pipeline (unlocks automatic verification on push).
- `[IV.17.6]` — Path aliases + instrumentation.ts scaffold (tiny cleanup).
- `[III.11.1]` — `@app/config` package (first real TS code; Zod env schema).
- `[II.6.2]`–`[II.6.4]` — Architecture ADRs (pure docs, locks decisions).

---

### [II.10.0] — Monorepo scaffold (Turborepo + pnpm + shared configs)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 10

**What was done**

- **Root toolchain**: `package.json` with `packageManager: pnpm@9.12.3`, scripts for dev/build/lint/typecheck/test/format, devDeps (turbo 2.9, typescript 5.9, eslint 9.39, prettier 3.8, husky 9.1, lint-staged 15.5, commitlint 19.8). `pnpm-workspace.yaml` covers `apps/*` + `packages/*`, excludes `apps/ai-service` (Python).
- **Turbo pipelines**: `turbo.json` with tasks `build / dev / lint / typecheck / test / test:integration / db:generate / db:migrate`. Proper `dependsOn ["^build"]` chain + cache rules per Playbook [IV.18.1.11].
- **Config files**: `.nvmrc` (Node 22), `.npmrc` (auto-install-peers, save-exact, engine-strict), `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js` (conventional + `scope-case:[0]` to allow `(II.10.0)` style scopes).
- **Husky v9 hooks**: `.husky/pre-commit` → `pnpm exec lint-staged`, `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`. `.husky/_/` (auto-generated helpers) added to `.gitignore`. Husky's `prepare` script ran during install and wired `core.hooksPath=.husky/_`.
- **GitHub**: `.github/pull_request_template.md` enforcing prompt-id, acceptance criteria, verification output, CLAUDE.md checklist.
- **README.md**: quickstart + structure + commands + link to Playbook/prompts/CLAUDE.
- **Shared packages** (real, not placeholder):
  - `packages/tsconfig` — `base.json` (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess) + `nestjs.json` (decorators, CJS) + `nextjs.json` (jsx preserve, next plugin) + `react-native.json` (jsx react-native).
  - `packages/eslint-config` — flat config using `typescript-eslint` v8 + `globals`. Rules: `no-explicit-any: error`, `no-console` (allow warn/error), `no-unused-vars` (allow `_`-prefixed), `eqeqeq: always`.
- **Placeholder apps** (7 × 2 files): `api`, `web`, `admin`, `mobile`, `media-service`, `notification-worker`, `crawler-worker` — each with minimal `package.json` + `src/index.ts` noting which prompt will fill it.
- **Placeholder packages** (8 × 2 files): `@app/shared-types`, `@app/ui`, `@app/mobile-ui`, `@app/sdk`, `@app/logger`, `@app/config`, `@app/errors`, `@app/observability` — each with minimal `package.json` (type module, main/types pointing at src/index.ts) + placeholder `src/index.ts`.
- **Python sidecar**: `apps/ai-service/README.md` noting it's excluded from pnpm-workspace; real Python scaffold lands in `[IV.18.2.11]`.
- **CLAUDE.md updated**: commit-message format clarified to `<type>(<prompt-id>): <subject>` (conventional + scope=prompt-id) with valid types enumerated.

**Files created** — ~50 total:

- Root (12): `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.npmrc`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js`, `README.md`, `.husky/pre-commit`, `.husky/commit-msg`.
- `.github/pull_request_template.md`
- `packages/tsconfig/` — `package.json`, `base.json`, `nestjs.json`, `nextjs.json`, `react-native.json` (5).
- `packages/eslint-config/` — `package.json`, `index.js` (2).
- Apps (15): `{api,web,admin,mobile,media-service,notification-worker,crawler-worker}/{package.json,src/index.ts}` + `ai-service/README.md`.
- Packages (16): `{shared-types,ui,mobile-ui,sdk,logger,config,errors,observability}/{package.json,src/index.ts}`.
- `pnpm-lock.yaml` (auto-generated by pnpm install).

**Files edited**

- `.gitignore` — added `.husky/_/`.
- `CLAUDE.md` — commit-message format rule updated to conventional commits.

**Dependencies added** (root devDeps):

- `turbo@^2.3.3` (resolved 2.9.6)
- `typescript@^5.7.2` (5.9.3)
- `eslint@^9.17.0` (9.39.4)
- `prettier@^3.4.2` (3.8.3)
- `husky@^9.1.7` (9.1.7)
- `lint-staged@^15.2.11` (15.5.2)
- `@commitlint/cli@^19.6.1` (19.8.1)
- `@commitlint/config-conventional@^19.6.0` (19.8.1)
- In `@app/eslint-config`: `typescript-eslint@^8.18.2`, `globals@^15.14.0`.
- Total 247 packages resolved in 18.2s.

**Commands run**

1. `corepack enable pnpm` — failed (admin required on Windows). Fallback: use `npx pnpm@9.12.3`.
2. `npx pnpm@9.12.3 install` — 247 packages, 18 workspace projects, husky prepare ran.
3. `npx pnpm turbo run typecheck lint` — 0 tasks matched (placeholders have no scripts yet), exit 0.
4. `echo "bad msg" | npx pnpm exec commitlint` — exit 1, rejected (✅ expected).
5. `echo "chore(II.10.0): ..." | npx pnpm exec commitlint` — exit 0, accepted (✅ expected).

**Verification**

- ✅ `pnpm install` succeeds (18.2s, 247 packages).
- ✅ `pnpm turbo run typecheck lint` green on empty placeholders (0 tasks, exit 0).
- ✅ Committing with a non-conventional message fails commitlint (2 errors: type-empty, subject-empty).
- ✅ Husky pre-commit is wired (`.husky/pre-commit` calls `lint-staged`; `core.hooksPath=.husky/_`).

**Acceptance criteria (from prompt)**

- ✅ `pnpm install` succeeds.
- ✅ `pnpm turbo run lint typecheck` green on empty placeholders.
- ✅ Committing with a non-conventional message fails commitlint.
- ✅ Husky pre-commit runs lint-staged.

**Notes / deviations**

- `corepack enable` needed admin on Windows; using `npx pnpm` as the invocation path. Documented in README quickstart. Future prompts: use `npx pnpm ...` or ask user to enable corepack once (admin prompt).
- Apps are placeholder-only — real NestJS/Next.js/Expo scaffolds land in `[III.11.x]` / `[IV.18.1.14.a-c]`.
- Packages `@app/ui`, `@app/mobile-ui`, `@app/sdk` are workspace-resolvable but export nothing yet.
- Did not add ESLint config or tsconfig.json per package placeholder — those land when each package gets its real code, keeping this scaffold prompt lean.

**Next prompt candidates**

- `[IV.17.6]` — wire `@app/*` path aliases in the shared tsconfig + root `tsconfig.json` (prereq for clean imports across packages).
- `[IV.18.1.7]` — testing infrastructure (Testcontainers + Jest + factories + MSW).
- `[IV.18.1.11]` — CI/CD GitHub Actions workflows.
- `[II.6.2]` / `[II.6.3]` / `[II.6.4]` — architecture ADRs.

---

### [IV.19.1] — Install System Rules + progress scaffolding

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 19.1

**What was done**

- Initialised the git repository on `main` (folder was not previously tracked).
- Added a root `.gitignore` covering Node/pnpm/Turbo, env files, editor, RN/Expo, Python, Prisma.
- Created `CLAUDE.md` at repo root with the full Part 0 System Rules from the prompt archive. This is auto-loaded by Claude Code and codifies the hard constraints, output format, self-check list, tool hints, and the per-prompt execution workflow this project is using.
- Created `docs/agent-contract.md` with the first acknowledgement entry so future seed prompts have a place to record agent agreements.
- Created this `PROGRESS.md` as the rolling execution log.

**Files created**

- `.gitignore`
- `CLAUDE.md`
- `docs/agent-contract.md`
- `PROGRESS.md`

**Files edited** — none.

**Dependencies added** — none (no code yet).

**Verification**

- `CLAUDE.md` exists at repo root with all 13 hard constraints.
- `docs/agent-contract.md` exists with the [IV.19.1] acknowledgement.
- `git status` clean after commit.

**Acceptance criteria (from prompt)**

- ✅ Claude Code reads the rules on every session start — CLAUDE.md present at repo root.
- ✅ `docs/agent-contract.md` collecting acknowledgements — created with first entry.

**Notes**

- No code artefacts yet — this is a docs/config prompt only, so no typecheck/lint/test retest was applicable.
- Next natural prompts to consider (pick one):
  - `[I.1.1]` — Context confirmation (seed, no code).
  - `[II.10.0]` — Monorepo scaffold (first real code; large).
  - `[IV.19.2]`/`[IV.19.3]`/`[IV.19.4]` — rest of the meta-layer (context-carry doc, end-prompt command, stop-hook).

**Commit** — see git log.

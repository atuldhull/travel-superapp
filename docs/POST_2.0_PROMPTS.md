# POST‑2.0 Prompt Book — Agentic + Social Upgrade

> **Status:** drop‑in execution prompts for TravelSuperApp **2.0**. Same shape,
> workflow, and rigor as the 1.0 series in [`docs/POST_VUX_GAPS.md`](POST_VUX_GAPS.md) §7.
>
> **Strategy source of truth:** [`docs/APP_VISION_2.0.html`](APP_VISION_2.0.html)
> (read §1–§24 before executing anything here).
>
> **How an agent runs one:** _"Execute POST.2A.1 from docs/POST_2.0_PROMPTS.md."_
> Each block is fully self‑contained. `CLAUDE.md` hard constraints apply on top.
>
> **Scope:** 1 setup prompt + 11 feature prompts · 1 new api module (`agent`) ·
> 6 additive Prisma tables · 0 new runtime dependencies · **$0 to run.**

---

## 0. Read this first — the seriousness contract

This is the highest‑stakes work in the repository. Every prompt below is written
so that an executing agent **cannot drift, cannot reach for a paid service, and
cannot ship an unsafe path** — because those failure modes are encoded as
_acceptance criteria that block the commit_, not as advice.

### The Three Laws (every prompt enforces all three)

1. **LAW 1 — FREE.** No prompt may require a paid key to pass its acceptance
   criteria. Every external call has a free source **and** a stub fallback. The
   only paid tier in the whole system (Anthropic, tier‑1 of the existing 4‑tier
   AI chain) **must remain key‑absent** — 2.0 adds no new paid path. **Every
   prompt's `How to verify` includes a full `--runInBand` e2e run with ZERO new
   env vars set; if it is not green with zero keys, the prompt is not done.**

2. **LAW 2 — SAFE & TRUSTED.** Safety is a domain invariant, never a UI nicety.
   - The agent **never autonomously spends money or books anything.**
     Propose‑and‑confirm only. Each agent prompt's AC includes a literal grep:
     `rg -i "stripe|payment|booking|charge|checkout" apps/api/src/modules/agent`
     must return **nothing**.
   - No user PII (email, name, precise home address) is ever sent to an
     external signal API. Only trip‑relevant coordinates and public flight
     identifiers leave the system.
   - Publishing is **private by default**; a trip whose end date is in the
     future **cannot** be published — enforced in the domain layer with a test
     that does not go through HTTP.
   - **Zero new runtime dependencies.** Every adapter uses native `fetch`
     (the project's established no‑SDK rule). This is a deliberate
     supply‑chain posture, not a convenience. `Deps:` is `none` unless a line
     explicitly states otherwise (only `POST.2C.2` may, and it does not).

3. **LAW 3 — NO DRIFT.** Scope‑lock and dependency‑lock are absolute. Modify
   **only** the files in `Files to touch`. Prisma schema is **append‑only**
   (CLAUDE.md #8) — a schema prompt states its explicit permission and the
   migration must contain no `DROP`/destructive `ALTER` (the reviewer greps the
   `.sql`). No `any`. No `console.log` (use `@app/logger`). Clean/hex
   dependency rule: `domain ← application ← infrastructure/interface`, never
   inverted.

### Inherited from CLAUDE.md (do not restate, but obey)

One prompt per session · plan before multi‑file work · run typecheck + lint +
the relevant suite before commit · update `PROGRESS.md` · never auto‑advance ·
end with the `FILES CREATED / EDITED / DEPS / COMMANDS / VERIFICATION / NEXT
PROMPT` block.

### Workflow hazards (verified during the 1.0 POST series — obey in every prompt)

- **api dev runner is broken** (`tsx watch` + Nest 11 DI bug). Build, then run:
  `pnpm --filter=@app/config build; pnpm --filter=api build` →
  `node apps/api/dist/src/main.js`. Source edits need a rebuild.
- **Full api suite must run `--runInBand`** — default Jest concurrency exhausts
  Postgres `max_connections` and cascade‑fails with false 500s.
- **Tests:** export `DATABASE_URL`/`REDIS_URL` with `127.0.0.1` (not
  `localhost` — it resolves to IPv6 on this box; Docker binds IPv4 only).
- **Web typecheck only** for web prompts (`pnpm --filter=web typecheck`) — the
  Expo workspace is intentionally isolated; do not run a root typecheck.
- **Adapters whose ctor needs env must NOT be class‑registered** — register the
  stub; the factory `new`s the real adapter conditionally (Nest eager‑instantiates
  `providers:` and a throwing ctor crashes boot).
- **Web routes added → regenerate the SDK:** `pnpm --filter=@app/sdk gen`
  (orval config at `packages/sdk/orval.config.ts`, contract at
  `docs/api/openapi.yaml`). Bundle the regen if two web prompts ship together.

### Verified codebase facts (deep-verified 2026-05-16 — these are ground truth)

Every prompt below assumes these. They were read from source, not guessed. If a
prompt and this block disagree, **this block wins** — report the discrepancy.

- **Scheduler:** there is **no `@nestjs/schedule`**. Cron is a hand-rolled
  pattern: `@Injectable()` class `implements OnModuleInit, OnModuleDestroy`,
  `setInterval` started in `onModuleInit` (fires once immediately + on a
  period), a re-entrant guard, and **skipped when `NODE_ENV==='test'`**.
  Exact precedents to copy: `modules/account/interface/account-purge.scheduler.ts`,
  `modules/social/interface/karma-recompute.scheduler.ts`,
  `modules/notifications/interface/weekly-digest.scheduler.ts`. The agent
  scheduler MUST follow this shape — do not add a scheduler dependency.
- **Redis:** there is **no shared Redis module / injection token**. Each module
  constructs its own `ioredis` `Redis` instance from
  `ConfigService.get('REDIS_URL')`. Precedent:
  `common/rate-limit/redis-throttler.storage.ts`,
  `common/cache/typed-redis-cache.ts`. A per-watch lock = a new `Redis`
  instance + `SET key val EX <ttl> NX`. No lock service exists.
- **pgvector:** extension installed (`schema.prisma` `extensions = [postgis,
vector, pg_trgm, pgcrypto]`). The **established embedding dimension is
  `vector(1024)`** — see model `PlaceEmbedding` (`embedding
Unsupported("vector(1024)")`) and migration
  `20260420081604_vector_ivfflat` (`USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100)`). **2.0 MUST use `vector(1024)` + the same
  `vector_l2_ops` ivfflat lists=100** for consistency. (An embedding model
  emitting any other dimension is a hard bug.)
- **Embedding source:** `AI_SERVICE_URL` exists in config (default
  `http://localhost:8001`) **but `apps/ai-service` is a README only — there is
  no Python service. Do NOT use it.** Embeddings go through the
  already-wired local **Ollama** via native `fetch`
  (`POST {OLLAMA_URL}/api/embeddings`), model **`mxbai-embed-large`**
  (1024-dim, free, local — matches the `PlaceEmbedding` dimension). Stub
  fallback when Ollama/model absent. Note `OLLAMA_MODEL` (default
  `llama3.1:8b`) is the **chat** model — embeddings need a separate
  `EMBEDDING_MODEL` var.
- **Weather:** a clean `WeatherProvider` port already exists
  (`modules/weather/application/ports/weather-provider.ts`:
  `getDailyForecast` / `getHourlyForecast`) with `OpenMeteoWeatherProvider`
  - a `CachedWeatherProvider` decorator + `RedisWeatherCache`. The agent's
    weather signal MUST depend on the existing `WeatherProvider` port — **do
    not re-implement an Open-Meteo HTTP client.** (OpenSky has no existing
    adapter — that one is genuinely new, native `fetch`.)
- **Trip planner port:** `TRIP_PLANNER_PORT = Symbol('TRIP_PLANNER_PORT')`;
  `interface TripPlannerPort { generatePlan(request: TripPlannerRequest):
Promise<TripPlannerResult> }`. `TripPlannerRequest` today = `{ title,
center{lng,lat}, radiusKm, startsOn, endsOn }` — **it has no free-text /
  grounding field.** Seam 2 (POST.2C.3) therefore requires an _additive
  optional_ field on `TripPlannerRequest` + folding it into the Gemini/Ollama
  adapter prompts (scope is in that prompt).
- **Notifications:** categories are a const tuple
  `NOTIFICATION_CATEGORIES = ['trip','safety','social','digest','account']`
  - per-event handlers in `modules/notifications/application/handlers/*` with
    an `EVENT_NAME` and a prefix→category map
    (`notification-category.helper.ts`). Minimal-blast-radius for agent: a new
    handler `agent-replan-proposed.handler.ts`, `EVENT_NAME='Trip.ReplanProposed'`,
    **reuse the existing `'trip'` category** (no edit to the categories tuple).
- **Feature flags:** add to `FeaturesSchema` in `packages/config/src/schema.ts`
  exactly: `FEATURE_AGENT_ENABLED: z.coerce.boolean().default(false),`.
- **Memory Books:** in `modules/media`. Create =
  `CreateMemoryBookUseCase.execute(cmd)`
  (`application/create-memory-book.use-case.ts`). A separate
  `publish-memory-book.use-case.ts` already exists — Seam 1 creates a
  **PRIVATE draft only** and must NOT call publish. `TripPublication`
  (POST.2B.2) is the _2.0 social_ artifact and merely references
  `memoryBookId`; it does not replace the 1.0 memory-book publish concept.
- **Prisma:** no `enum Visibility` exists (POST.2B.2 may add it, no clash).
  `Subscription` model exists (POST.9). Migration dir = `YYYYMMDDHHMMSS_slug`.
  Schema header documents an `// append-only` marker convention for log/
  forecast tables — `AgentStep` uses it.
- **Social blocking:** no "blocked user cannot react" check exists yet;
  reaction gating today is trip-ownership/share based in `CastVoteUseCase` /
  `CreateReviewUseCase` (application layer). POST.2B.1 adds the block gate
  there.

### The order — execute strictly top to bottom

```
POST.2.0.0  ─ Phase 0 gate: clean baseline + lock decisions D1–D8
POST.2A.1   ┐
POST.2A.2   ┤ Phase A — agent core
POST.2A.3   ┤
POST.2A.4   ┤
POST.2A.5   ┘ →→ PHASE A GATE (zero‑key e2e green + manual demo) ←← hard stop
POST.2B.1   ┐
POST.2B.2   ┤ Phase B — social substrate
POST.2B.3   ┘ →→ PHASE B GATE ←← hard stop
POST.2C.1   ┐
POST.2C.2   ┤ Phase C — the fusion
POST.2C.3   ┘ →→ PHASE C GATE (whole‑product flywheel demo) ←← done
```

A **GATE** is a mandatory checkpoint, not a suggestion: do not begin the next
phase while the previous phase's e2e is red.

---

## Phase 0

### POST.2.0.0 — Clean baseline + lock the 2.0 decisions

```
[POST.2.0.0] Establish a clean, known-good baseline before any 2.0 code

Context:
  2.0 starts from an uncommitted working tree (schema.ts optionalUrl
  helper, main.ts Fastify env-gate, a health revert, three docs).
  POST.2A.1 re-edits packages/config/src/schema.ts — starting on top
  of an uncommitted diff destroys scope-lock and the review surface.
  Also: 8 product decisions (APP_VISION_2.0.html §22 D1–D8) change
  the contents of the prompts below and must be locked first.

Files to touch:
  PROGRESS.md                          (append a "## 2.0 decisions" block: record the user's chosen D1–D8 verbatim, dated)
  (commit only — no source edits in this prompt)

Deps:
  none

Env vars needed:
  none — runs $0

Acceptance criteria:
  - The user's D1–D8 picks are written into PROGRESS.md (if any
    decision is unset, STOP and ask — do not guess a default)
  - `pnpm turbo run typecheck` green for all touched packages
  - `pnpm turbo run lint` green
  - All currently-uncommitted work is committed as ONE chore commit
    (schema.ts, main.ts, health.{controller,module}.ts, docs/*)
  - No behavior change vs the pre-commit tree (this is hygiene only)
  - `git status` is clean after this prompt
  - The 1.0 e2e suite still passes: `pnpm --filter=api test -- --runInBand`

How to verify:
  1. Confirm D1–D8 are answered (ask the user if not)
  2. pnpm turbo run typecheck && pnpm turbo run lint
  3. cd apps/api && DATABASE_URL=...127.0.0.1... pnpm test -- --runInBand
  4. git add -A && git commit  (chore subject below)
  5. git status → clean; git log -1 → the baseline commit

Commit: chore(POST.2.0.0): clean baseline + lock 2.0 decisions D1–D8
```

---

## Phase A — Agent core (highest value + highest risk → first)

### POST.2A.1 — Agent module skeleton + ports (inert, flag-gated)

```
[POST.2A.1] Create modules/agent hex skeleton + the three ports

Context:
  2.0 Track A is a new event-driven agent. This prompt lays the
  hexagonal skeleton ONLY — no behaviour. It must be inert behind a
  default-off feature flag so it ships dark with zero risk to 1.0.

Files to touch:
  apps/api/src/modules/agent/                                  (NEW MODULE)
    agent.module.ts
    domain/
      agent-run.entity.ts             (aggregate: id, tripId, status, planVersion)
      trip-watch.entity.ts            (what signals a run subscribes to + thresholds)
      plan-diff.vo.ts                 (immutable proposed change: add/move/drop a stop)
    application/
      ports/
        signal-source.port.ts         (snapshot() => typed signal; weather|flight|geofence)
        agent-memory.port.ts          (recall(query) — pgvector; no impl yet)
        plan-tool.port.ts             (draftReplan(...) — wraps the 1.0 trip planner; no impl yet)
    infrastructure/
      stub-signal.adapter.ts          (always returns "nothing changed"; the env-gated default)
    interface/
      agent.controller.ts             (registered ONLY when flag on; otherwise not mounted)
  apps/api/src/app.module.ts                                   (conditionally import AgentModule)
  packages/config/src/schema.ts                                (add to the existing FeaturesSchema object, byte-for-byte: `FEATURE_AGENT_ENABLED: z.coerce.boolean().default(false),`)

Deps:
  none

Env vars needed:
  FEATURE_AGENT_ENABLED   (optional boolean, default false) — $0

Acceptance criteria:
  - LAW 1: api boots + full e2e green with NO new env set
    (`pnpm --filter=api test -- --runInBand`)
  - With flag false (default): AgentModule is inert — no agent route
    is reachable, no scheduler registered, no DI side effects
  - With flag true: module loads; controller mounts; still no
    behaviour beyond a health/echo endpoint
  - StubSignalAdapter unit-tested (≥ 80% on domain + the stub)
  - Hex boundaries respected; no `any`; no `console.log`
  - LAW 2 grep: `rg -i "stripe|payment|booking|charge|checkout"
    apps/api/src/modules/agent` returns nothing
  - LAW 3: only the listed files changed; Deps unchanged

How to verify:
  1. pnpm --filter=@app/config build && pnpm --filter=api build
  2. node apps/api/dist/src/main.js  → boots, no agent routes (flag off)
  3. FEATURE_AGENT_ENABLED=true node apps/api/dist/src/main.js → agent health route 200
  4. pnpm --filter=api test -- --runInBand  → green with zero new env
  5. pnpm turbo run typecheck && pnpm turbo run lint

Commit: feat(POST.2A.1): agent module skeleton + signal/memory/plan ports (flag-gated, inert)
```

---

### POST.2A.2 — Append-only run log + TripWatch (additive schema)

```
[POST.2A.2] Persist the agent: AgentRun + AgentStep + TripWatch

Context:
  An agent needs durable, auditable state. Add three additive Prisma
  models and the start-trip-watch use-case. AgentStep is an
  append-only audit log — there must be no update/delete path for it.

Files to touch:
  apps/api/prisma/schema.prisma                                (APPEND-ONLY edit EXPLICITLY PERMITTED by this prompt: add models AgentRun, AgentStep, TripWatch + optional back-relations only; NO column drops, NO type changes to existing models)
  apps/api/prisma/migrations/<ts>_agent_run_log/migration.sql  (new; additive only)
  apps/api/src/modules/agent/
    domain/                                                    (flesh out the 3 entities to match schema)
    application/
      start-trip-watch.use-case.ts
      ports/agent-run.repository.ts                            (new port)
      ports/trip-watch.repository.ts                           (new port)
    infrastructure/
      prisma-agent-run.repository.ts
      prisma-trip-watch.repository.ts
    agent.module.ts                                            (wire repos)

Deps:
  none

Env vars needed:
  none — $0

Acceptance criteria:
  - LAW 3: the migration .sql contains NO `DROP`, NO destructive
    `ALTER` (reviewer greps it); it only CREATEs the 3 tables + indexes
  - AgentStep repository exposes append + read ONLY (no update, no
    delete) — enforced by the port's type, not convention
  - A TripWatch can be created for a trip and listed; one trip → at
    most one active watch (domain invariant + test)
  - Repo + use-case specs ≥ 80% (application + domain)
  - LAW 1: `pnpm --filter=api test -- --runInBand` green, zero new env
  - LAW 2 grep on modules/agent → still nothing
  - no `any`; hex boundaries intact

How to verify:
  1. pnpm --filter=api prisma migrate dev --name agent_run_log
  2. grep -iE "drop|alter .* drop" apps/api/prisma/migrations/*agent_run_log*/migration.sql → empty
  3. pnpm --filter=api test -- --runInBand  → green
  4. pnpm turbo run typecheck && lint

Commit: feat(POST.2A.2): append-only agent run log + TripWatch (additive schema)
```

---

### POST.2A.3 — Deterministic loop + Open-Meteo / OpenSky free adapters

```
[POST.2A.3] evaluate-signals (pure) + free, keyless signal sources

Context:
  The loop core is a PURE function: poll → diff vs last snapshot →
  threshold gate. The LLM is NOT in this loop (Track A design stance,
  §5/§6). Weather signal REUSES the existing WeatherProvider port (do
  NOT re-implement Open-Meteo — see Verified facts). Flight signal is
  a genuinely new OpenSky adapter (anonymous, native fetch). Both FREE,
  both stub-backed. NO paid provider may appear anywhere.

Files to touch:
  apps/api/src/modules/agent/
    application/
      evaluate-signals.use-case.ts     (PURE: snapshot in → PlanDiff[] out; unit-testable, no I/O)
      ports/signal-source.port.ts       (finalise the contract)
    infrastructure/
      weather-signal.adapter.ts         (DEPENDS ON the existing WEATHER_PROVIDER port from modules/weather — no new HTTP client; maps forecast → signal vs rain/temp thresholds)
      opensky-flight.adapter.ts         (native fetch; FREE; anonymous; delay/airborne state — genuinely new, no existing adapter)
      stub-signal.adapter.ts            (extend: deterministic "no change")
    interface/
      agent.scheduler.ts                (Injectable implements OnModuleInit/OnModuleDestroy + setInterval + re-entrant guard + skip when NODE_ENV==='test' — copy account-purge.scheduler.ts shape EXACTLY; no @nestjs/schedule dep)
    agent.module.ts                     (import WeatherModule's exported WEATHER_PROVIDER; env-gated factory: real flight adapter only if reachable, else stub; construct own ioredis via ConfigService for the lock — pattern: redis-throttler.storage.ts)
  packages/config/src/schema.ts         (add OPENSKY_BASE_URL + AGENT_TICK_INTERVAL_MS to a schema group, both optional with safe defaults — there is NO cron-string infra, it's setInterval ms)

Deps:
  none — native fetch only (project no-SDK adapter rule)

Env vars needed:
  none required. OpenSky used anonymously (no key). Open-Meteo no key. $0.

Acceptance criteria:
  - LAW 2 (privacy): adapters send ONLY trip coordinates / public
    flight callsigns to the external APIs — NO user email/name/home.
    A test asserts the outbound request body/query contains no PII.
  - evaluate-signals is a pure function: unit-tested with fixture
    snapshots (rain ≥ threshold → swap-day diff; flight delay diff;
    sub-threshold → empty). No network in these tests.
  - Concurrency: a per-watch lock (own ioredis instance via
    ConfigService REDIS_URL; `SET lock:watch:<id> 1 EX <ttl> NX`)
    prevents two scheduler ticks double-proposing for one watch
    (test the race). No shared lock service exists — build it here.
  - LAW 1: with no network / no env, adapters degrade to stub and
    `pnpm --filter=api test -- --runInBand` is green
  - LAW 1 grep: no "anthropic", no paid SDK, no API key constant
    anywhere in modules/agent
  - coverage ≥ 80% on the use-case; no `any`; no `console.log`

How to verify:
  1. pnpm --filter=api build
  2. pnpm --filter=api test -- --runInBand  → green with zero env
  3. Unit: feed a "rain 90% Tuesday" fixture → expect one swap-day PlanDiff
  4. Manual: FEATURE_AGENT_ENABLED=true + a seeded trip → scheduler tick logs a snapshot (via @app/logger, not console)
  5. typecheck + lint

Commit: feat(POST.2A.3): deterministic signal loop + WeatherProvider reuse + OpenSky free adapter
```

---

### POST.2A.4 — propose / confirm re-plan + notification (the SAFE boundary)

```
[POST.2A.4] LLM leaf-call proposal, human confirm, never autonomous

Context:
  When evaluate-signals emits a material PlanDiff, propose-replan
  calls the EXISTING 1.0 trip planner as a tool. Verified contract:
  inject `TRIP_PLANNER_PORT` (Symbol), call
  `generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult>`
  ({ plan, model, provider, tokenUsage? }). It writes a proposal +
  pushes a notification. confirm-replan applies the diff ONLY on
  explicit user acceptance. The agent has NO authority to spend or
  book — ever.

Files to touch:
  apps/api/src/modules/agent/
    application/
      propose-replan.use-case.ts        (calls plan-tool port; writes AgentStep + proposal; emits notification event)
      confirm-replan.use-case.ts        (user-accepted → apply PlanDiff to the trip; declined → record + raise threshold)
      ports/plan-tool.port.ts           (finalise)
    infrastructure/
      trip-planner-tool.adapter.ts      (delegates to the existing modules/trip planner port — NO new LLM plumbing)
    interface/
      agent.controller.ts               (GET /agent/runs/:id status; POST /agent/proposals/:id/accept|decline)
    agent.module.ts
  apps/api/src/modules/notifications/
    application/handlers/agent-replan-proposed.handler.ts  (new handler; EVENT_NAME='Trip.ReplanProposed')
    notification-category.helper.ts                        (map the 'Trip.' prefix is already mapped → REUSE existing 'trip' category; do NOT edit NOTIFICATION_CATEGORIES)
    notifications.module.ts                                (register the new handler only)

Deps:
  none

Env vars needed:
  none — uses the existing 4-tier chain (Gemini→Ollama→stub). $0 with stub.

Acceptance criteria:
  - LAW 2 (the core safety AC): `rg -i
    "stripe|payment|booking|charge|checkout|spend" apps/api/src/modules/agent`
    returns NOTHING. A confirm only mutates the itinerary, never money.
  - propose-replan writes a proposal + an AgentStep + pushes the
    notification; it does NOT mutate the trip
  - confirm-replan(accept) applies the PlanDiff; confirm-replan(decline)
    records the decline and raises the watch threshold
  - e2e: weather fixture → material change → proposal notification →
    accept applies diff → decline path raises threshold (≥ 4 cases)
  - LAW 1: passes with ZERO AI keys (stub planner) under `--runInBand`
  - autonomy respects the D1 default chosen in POST.2.0.0
  - coverage ≥ 80% application; hex intact; no `any`

How to verify:
  1. pnpm --filter=api build && pnpm --filter=api test -- --runInBand
  2. rg -i "stripe|payment|booking|charge|checkout|spend" apps/api/src/modules/agent → empty
  3. e2e spec: fixture rain → GET run shows a proposal → POST accept → trip itinerary changed; POST decline → threshold raised
  4. typecheck + lint

Commit: feat(POST.2A.4): propose/confirm re-plan via existing planner tool + notify
```

---

### POST.2A.5 — Agent web surfaces (flag-gated, no new deps)

```
[POST.2A.5] Trip card + inbox actions + autonomy toggle

Context:
  Surface the agent on EXISTING pages — no new top-level nav. Behind
  the same flag. Reuse 1.0 POST.8 primitives (toast, EmptyState,
  Skeleton, RelativeTime). No new web dependency.

Files to touch:
  apps/web/src/app/trips/[id]/page.tsx                 ("Agent watching" pill + proposal timeline card; flag-gated render)
  apps/web/src/app/inbox/page.tsx                      (actionable Accept/Decline on agent.replan-proposed notifications)
  apps/web/src/app/account/preferences/page.tsx        (autonomy slider: off / notify-only / auto-trivial; default = D1)
  apps/web/src/components/agent/                        (new: AgentWatchCard, ProposalRow — composed from existing UI primitives)
  packages/sdk/                                         (regenerate IF POST.2A.4 added documented routes: pnpm --filter=@app/sdk gen)
  docs/api/openapi.yaml                                 (only if new routes are documented)

Deps:
  none

Env vars needed:
  NEXT_PUBLIC_FEATURE_AGENT_ENABLED  (optional, mirrors server flag) — $0

Acceptance criteria:
  - Flag off: ZERO new UI, no layout shift on /trips/[id], /inbox,
    /account/preferences
  - Flag on: card renders; proposal Accept/Decline calls the
    POST.2A.4 endpoints via the regenerated SDK
  - Uses ONLY existing components (EmptyState, SkeletonCard, toast,
    RelativeTime) — no new web dependency added
  - a11y: heading hierarchy, focus rings, ARIA on actions; passes in
    dark mode and comfort mode (1.0 checklist)
  - LAW 1: `pnpm --filter=web typecheck` green (web only — Expo
    workspace stays isolated); `pnpm --filter=web lint` green
  - LAW 3: only listed files; package.json unchanged (no new dep)

How to verify:
  1. pnpm --filter=@app/sdk gen   (if routes changed)
  2. pnpm --filter=web typecheck && pnpm --filter=web lint
  3. cd apps/web && npx next dev --port 3002  (must say Next 15)
  4. Flag off → pages identical to 1.0. Flag on → card + working Accept
  5. Toggle dark + comfort mode → still correct

Commit: feat(POST.2A.5): agent surfaces — trip card, inbox actions, autonomy toggle
```

> ### ⛔ PHASE A GATE — do not start Phase B until ALL of this is true
>
> - `pnpm --filter=api test -- --runInBand` green with **zero 2.0 env vars**
> - `rg -i "stripe|payment|booking|charge|checkout" apps/api/src/modules/agent` → empty
> - Manual demo: create a trip → inject a weather‑change fixture → a proposal
>   appears in `/inbox` → Accept applies the new day. Decline raises the threshold.
> - `PROGRESS.md` has a row for each of POST.2A.1–5.
> - This proves the single hardest part of all of 2.0 (an agentic loop on the
>   free LLM tier) **before** any B/C investment. If A is unviable, stop here.

---

## Phase B — Social substrate

### POST.2B.1 — Follow graph + UserBlock (additive, domain-gated)

```
[POST.2B.1] The smallest graph that works

Context:
  Extend the EXISTING modules/social (it already owns hearts, votes,
  reviews, karma — do not greenfield). Add a directed follow edge and
  a block edge. Block is a DOMAIN concept; its ENFORCEMENT is wired
  into the existing application-layer reaction gates (verified: today
  the gates live in CastVoteUseCase.assertCanVote /
  CreateReviewUseCase.assertTripAccess / HeartSharedTripUseCase — NOT
  a domain method and NOT the controller). Add the block check
  alongside those existing gates, not a new layer.

Files to touch:
  apps/api/prisma/schema.prisma                                (APPEND-ONLY PERMITTED: add Follow (composite key followerId+followeeId) + UserBlock; additive; index followeeId)
  apps/api/prisma/migrations/<ts>_follow_block/migration.sql   (new; additive only)
  apps/api/src/modules/social/
    domain/                                                    (Follow + Block as domain concepts; block invariant)
    application/
      follow.use-case.ts  unfollow.use-case.ts
      block-user.use-case.ts  unblock-user.use-case.ts
      ports/follow.repository.ts  ports/block.repository.ts
    infrastructure/
      prisma-follow.repository.ts  prisma-block.repository.ts
    application/cast-vote.use-case.ts                          (add the block guard alongside the existing assertCanVote gate)
    application/create-review.use-case.ts                      (add the block guard alongside the existing assertTripAccess gate)
    infrastructure/trip-heart-counter.ts                       (add the block guard to the heart path)
    interface/social.controller.ts                             (POST/DELETE follow + block routes)
    social.module.ts

Deps:
  none

Env vars needed:
  none — $0

Acceptance criteria:
  - LAW 3: migration .sql has NO drop/destructive alter (greps clean);
    Follow is a composite-key table (no array columns)
  - A blocked user CANNOT follow, heart, vote, or review the blocker
    — the block guard is added to the existing application reaction
    gates; a dedicated use-case-level test (no HTTP) proves each of
    follow / heart / vote / review is refused for a blocked pair
  - follow/unfollow idempotent; self-follow rejected by the domain
  - specs ≥ 80% (domain + application)
  - LAW 1: `pnpm --filter=api test -- --runInBand` green, zero env
  - no `any`; hex intact

How to verify:
  1. pnpm --filter=api prisma migrate dev --name follow_block
  2. grep -iE "drop|alter .* drop" the new migration.sql → empty
  3. Use-case test: blocked pair → follow()/heart()/vote()/review() refused (no HTTP)
  4. pnpm --filter=api test -- --runInBand → green
  5. typecheck + lint

Commit: feat(POST.2B.1): follow graph + user block (additive, domain-gated)
```

---

### POST.2B.2 — TripPublication + privacy-fenced publish (domain invariant)

```
[POST.2B.2] Publishing is a safety feature, not a sharing convenience

Context:
  Travel content broadcasts that a home is empty and where a person
  physically is. The publish model is privacy-first BY THE DOMAIN.
  Add TripPublication (NO embedding column yet — that is POST.2C.2).
  Per decision D6, the publication lives in modules/feed; the graph
  stays in modules/social. Verified: NO `enum Visibility` exists in
  schema.prisma — safe to add, no clash. This is a DISTINCT concept
  from the existing modules/media publish-memory-book.use-case (which
  publishes a book to /featured); TripPublication is the 2.0 social
  artifact and merely references memoryBookId — do not conflate or
  modify the 1.0 memory-book publish path.

Files to touch:
  apps/api/prisma/schema.prisma                                  (APPEND-ONLY PERMITTED: add TripPublication { tripId @unique, authorId, memoryBookId?, visibility Visibility, publishedAt? } + enum Visibility { PRIVATE FOLLOWERS PUBLIC }; additive)
  apps/api/prisma/migrations/<ts>_trip_publication/migration.sql (new; additive only)
  apps/api/src/modules/feed/
    domain/
      trip-publication.entity.ts        (invariants live here)
    application/
      publish-trip.use-case.ts
      unpublish-trip.use-case.ts
      ports/trip-publication.repository.ts
    infrastructure/prisma-trip-publication.repository.ts
    interface/feed.controller.ts        (POST publish / DELETE unpublish)
    feed.module.ts

Deps:
  none

Env vars needed:
  none — $0

Acceptance criteria:
  - LAW 2 — INVARIANT A: a trip whose endDate is in the future CANNOT
    be published. Enforced in TripPublication domain entity. A unit
    test proves rejection WITHOUT going through the controller.
  - LAW 2 — INVARIANT B: visibility PUBLIC coarsens stored geo to
    city-level; FOLLOWERS may keep precise geo only if the user opts
    in. Tested at the domain layer.
  - unpublish flips visibility to PRIVATE (and is the seam POST.2C.2
    extends to also de-index)
  - default visibility on publish = decision D2
  - LAW 3: migration additive only (grep clean)
  - LAW 1: `pnpm --filter=api test -- --runInBand` green, zero env
  - specs ≥ 80%; no `any`; hex intact

How to verify:
  1. pnpm --filter=api prisma migrate dev --name trip_publication
  2. Unit: publish a trip with endDate = tomorrow → domain throws (no HTTP)
  3. Unit: publish PUBLIC → persisted geo is city-level, not exact
  4. pnpm --filter=api test -- --runInBand → green
  5. grep migration for drop/alter → empty; typecheck + lint

Commit: feat(POST.2B.2): trip publication + privacy-fenced publish (domain invariant)
```

---

### POST.2B.3 — Pull feed + creator profile

```
[POST.2B.3] The boring-correct feed (reverse-chron, one query)

Context:
  At zero scale the correct feed is pull / fan-out-on-read: one
  indexed query over (authors I follow ∪ public), reverse-chron,
  paginated, visibility + block filtered. NO engagement ranking, NO
  precompute (§13). Upgrade /users/[id] to a creator profile.

Files to touch:
  apps/api/src/modules/feed/
    application/get-feed.use-case.ts            (one indexed query; excludes blocked; respects visibility)
    application/get-creator-profile.use-case.ts (published trips + follower count)
    interface/feed.controller.ts                (GET /feed, GET /creators/:id)
    feed.module.ts
  apps/web/src/app/feed/page.tsx                (new; reverse-chron list; EmptyState + SkeletonList from 1.0)
  apps/web/src/app/users/[id]/page.tsx          (upgrade to creator profile + Follow button)
  apps/web/src/components/feed/                  (new; composed from existing primitives)
  packages/sdk/                                  (regenerate: pnpm --filter=@app/sdk gen)
  docs/api/openapi.yaml                          (new feed routes)

Deps:
  none

Env vars needed:
  none — $0

Acceptance criteria:
  - Feed query EXCLUDES content from blocked users and content the
    viewer's visibility tier may not see — a test proves both filters
  - Feed is strictly reverse-chronological (no ML / no ranking)
  - Pagination works; empty + loading use 1.0 EmptyState / SkeletonList
  - LAW 1: `pnpm --filter=api test -- --runInBand` green zero env;
    `pnpm --filter=web typecheck` green (web-only)
  - LAW 3: only listed files; no new dependency
  - no `any`; hex intact

How to verify:
  1. pnpm --filter=@app/sdk gen
  2. pnpm --filter=api test -- --runInBand → green
  3. e2e: B follows A; A publishes FOLLOWERS → appears in B's feed;
     A blocks B → disappears
  4. pnpm --filter=web typecheck && lint; visit /feed + /users/[id]

Commit: feat(POST.2B.3): pull feed + creator profile
```

> ### ⛔ PHASE B GATE — do not start Phase C until ALL of this is true
>
> - Follow a user · publish a trip privately · a future‑end‑date trip is
>   **rejected by the domain** (proven without HTTP) · it appears in the feed ·
>   a blocked user is excluded everywhere.
> - `pnpm --filter=api test -- --runInBand` green with **zero 2.0 env vars**.
> - `PROGRESS.md` has a row for each of POST.2B.1–3.

---

## Phase C — The fusion (small, because A + B already exist)

### POST.2C.1 — Seam 1: auto-draft Memory Book on trip-watch close

```
[POST.2C.1] The agent makes the network's content as a byproduct

Context:
  When a TripWatch closes, compose the real itinerary + the change
  log + the user's photos into a Memory Book DRAFT. Memory Books live
  in modules/media; create =
  CreateMemoryBookUseCase.execute(cmd: CreateMemoryBookCommand)
  (application/create-memory-book.use-case.ts). A separate
  publish-memory-book.use-case.ts EXISTS in that module — the draft
  path MUST NOT call it. The draft is PRIVATE. Nothing auto-publishes.
  Note: TripPublication (POST.2B.2) is the 2.0 social artifact and
  later references this book's id via memoryBookId — this prompt only
  produces the private draft, it does not publish anything.

Files to touch:
  apps/api/src/modules/agent/
    application/draft-memory-book.use-case.ts   (on TripWatch close → compose draft via the media module's create path)
    interface/agent.scheduler.ts                (on watch-close, invoke draft use-case)
    agent.module.ts                             (depend on the media create port — interface only, no layering violation)
  apps/api/src/modules/media/
    application/draft-book-from-trip.use-case.ts  (NEW additive use-case: ORCHESTRATES the existing CreateMemoryBookUseCase + attach-media-to-book.use-case; PRIVATE; reuses the 1.0 Sharp variant pipeline; does NOT touch publish-memory-book.use-case)
    application/ports/                             (a small inbound port the agent calls; keeps hex direction correct — agent → media, never media → agent)
  apps/web/src/app/trips/[id]/page.tsx          (end-of-trip "Review & publish your Memory Book" CTA; flag-gated)

Deps:
  none

Env vars needed:
  none — $0

Acceptance criteria:
  - LAW 2: the drafted book is PRIVATE. A test asserts visibility =
    PRIVATE after draft. `rg -i "publish" apps/api/src/modules/agent`
    shows NO publish call in the draft path.
  - Closing a TripWatch produces exactly one draft Memory Book linked
    to the trip; idempotent (closing twice does not double-draft)
  - Reuses the existing media variant pipeline (no new image code)
  - hex: the agent depends on a media INBOUND port; media does not
    depend on agent
  - LAW 1: `pnpm --filter=api test -- --runInBand` green zero env
  - coverage ≥ 80%; no `any`

How to verify:
  1. pnpm --filter=api build && test -- --runInBand → green
  2. e2e: close a watch → one PRIVATE draft book exists; close again → still one
  3. rg -i "publish" apps/api/src/modules/agent → no publish in draft path
  4. typecheck + lint; flag-on /trips/[id] shows the review CTA

Commit: feat(POST.2C.1): seam 1 — auto-draft Memory Book on trip-watch close
```

---

### POST.2C.2 — Trip embeddings via local Ollama + pgvector (additive)

```
[POST.2C.2] Embeddings with ZERO new service, ZERO new dep, $0

Context:
  There is NO Python ai-service in this repo (apps/ai-service is a
  README only). DO NOT stand one up. Use the ALREADY-RUNNING local
  Ollama (OLLAMA_URL, already wired in 1.0) embedding endpoint
  (POST {OLLAMA_URL}/api/embeddings, model mxbai-embed-large = 1024
  dims) via native fetch, with a stub (skip-index) fallback when
  Ollama or the model is absent. Fully local, free, trusted, no new
  attack surface. pgvector is installed since 1.0 and the ESTABLISHED
  DIMENSION IS vector(1024) (model PlaceEmbedding + migration
  20260420081604_vector_ivfflat). 2.0 MUST match: 1024 dims +
  vector_l2_ops ivfflat lists=100. nomic-embed-text (768) would be a
  hard dimension bug — use mxbai-embed-large (emits exactly 1024).

Files to touch:
  apps/api/prisma/schema.prisma                                  (APPEND-ONLY PERMITTED: add `embedding Unsupported("vector(1024)")?` to TripPublication — NULLABLE additive column ONLY; 1024 to match PlaceEmbedding; no backfill, no NOT NULL)
  apps/api/prisma/migrations/<ts>_trip_pub_embedding/migration.sql (new: add nullable column + `CREATE INDEX ... USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)` — copy the PlaceEmbedding precedent exactly; `CREATE EXTENSION` is a no-op since 1.0)
  apps/api/src/modules/feed/
    application/ports/embedding.port.ts
    application/publish-trip.use-case.ts        (extend: embed on publish — best-effort, swallow failure like the 1.0 media pipeline)
    application/unpublish-trip.use-case.ts      (extend: NULL the embedding in the SAME transaction as the visibility flip)
    infrastructure/ollama-embedding.adapter.ts  (native fetch; FREE; local)
    infrastructure/stub-embedding.adapter.ts    (returns null → publication still works, just unindexed)
    feed.module.ts                              (env-gated factory: real adapter only if OLLAMA reachable; else stub)
  packages/config/src/schema.ts                 (add EMBEDDING_MODEL to a schema group, optional, default "mxbai-embed-large" — note OLLAMA_MODEL default llama3.1:8b is the CHAT model, embeddings need this separate var)

Deps:
  none — native fetch (NO new runtime dependency; this is a LAW 2 supply-chain requirement)

Env vars needed:
  none required. Reuses existing OLLAMA_URL. Absent → stub (skip-index). $0.

Acceptance criteria:
  - LAW 1: with Ollama/model ABSENT, publish/unpublish still succeed
    (stub) and `pnpm --filter=api test -- --runInBand` is green with
    zero new env
  - LAW 3: migration adds ONLY a nullable column + an ivfflat index;
    NO backfill, NO NOT NULL, NO drop (reviewer greps the .sql)
  - unpublish NULLs the embedding in the SAME transaction as the
    visibility flip (no ghost in discovery) — proven by a test
  - embedding dimension is guarded: a vector whose length != 1024 is
    rejected before any DB write (a test proves the guard)
  - embed-on-publish is best-effort: an Ollama failure must NOT fail
    the publish (mirrors the 1.0 Sharp pipeline pattern)
  - no `any`; hex intact

How to verify:
  1. pnpm --filter=api prisma migrate dev --name trip_pub_embedding
  2. grep -iE "drop|not null|backfill" the migration.sql → empty
  3. Stop Ollama → publish a trip → succeeds, embedding NULL, e2e green
  4. Start Ollama → publish → embedding populated; unpublish → embedding NULL (same tx)
  5. pnpm --filter=api test -- --runInBand; typecheck + lint

Commit: feat(POST.2C.2): trip embeddings via local Ollama + pgvector (additive)
```

---

### POST.2C.3 — Seam 2: pgvector grounding + "trips like this" rail

```
[POST.2C.3] The network makes every agent smarter — loop closes

Context:
  propose-replan (POST.2A.4) now retrieves the top-k PUBLISHED, real
  outcomes near this destination/situation from pgvector and injects
  them as grounding into the planner tool call. The same index powers
  a "trips like this" discovery rail. Visibility + block filters are
  NON-NEGOTIABLE on both reads.

  SCOPE NOTE (verified): TripPlannerRequest currently = { title,
  center, radiusKm, startsOn, endsOn } — it has NO grounding field.
  Grounding therefore requires an ADDITIVE, OPTIONAL field on the
  port + folding it into the Gemini/Ollama adapter prompts. This
  expands scope into modules/trip (listed below). The field is
  optional so all existing planner callers + the Anthropic/stub
  adapters are unaffected.

Files to touch:
  apps/api/src/modules/trip/
    application/ports/trip-planner.port.ts   (ADDITIVE: add `readonly groundingContext?: readonly string[]` to TripPlannerRequest — optional, non-breaking)
    infrastructure/gemini-trip-planner.adapter.ts  (if groundingContext present, prepend it to the prompt)
    infrastructure/ollama-trip-planner.adapter.ts  (same; Anthropic + stub adapters unchanged — optional field ignored)
  apps/api/src/modules/agent/
    application/propose-replan.use-case.ts   (extend: query embedding port for top-k visible outcomes; pass them as groundingContext to the plan-tool call)
  apps/api/src/modules/feed/
    application/similar-trips.use-case.ts    (cosine-nearest published trips; visibility + block filtered)
    interface/feed.controller.ts             (GET /trips/:id/similar)
  apps/web/src/app/feed/page.tsx             ("Trips like this" rail)
  apps/web/src/components/feed/              (rail component; existing primitives)
  packages/sdk/                              (regenerate: pnpm --filter=@app/sdk gen)
  docs/api/openapi.yaml                      (similar-trips route)

Deps:
  none

Env vars needed:
  none — $0 (no embeddings → grounding gracefully degrades to ungrounded)

Acceptance criteria:
  - LAW 2: similar-trips + grounding retrieval NEVER return content
    the viewer cannot see — a test seeds PRIVATE + blocked content
    and asserts it is excluded from BOTH the rail and the grounding
  - A seeded fixture shows a grounded proposal differs from the
    ungrounded one (proves the grounding actually feeds the LLM)
  - With no embeddings present, propose-replan still works (ungrounded)
    and the rail shows an EmptyState — no crash
  - The TripPlannerRequest change is ADDITIVE + OPTIONAL: existing
    planner callers compile unchanged; Anthropic + stub adapters are
    untouched; a test proves a request WITHOUT groundingContext still
    works exactly as before (non-breaking proof)
  - LAW 1: full `pnpm --filter=api test -- --runInBand` green with
    ZERO 2.0 env vars; `pnpm --filter=web typecheck` green
  - LAW 3: only listed files; no new dependency
  - no `any`; hex intact

How to verify:
  1. pnpm --filter=@app/sdk gen
  2. e2e: seed 3 published trips (1 PRIVATE, 1 from a blocked user) →
     rail + grounding return only the 1 visible one
  3. Fixture: grounded vs ungrounded proposal text differs
  4. pnpm --filter=api test -- --runInBand → green; web typecheck + lint

Commit: feat(POST.2C.3): seam 2 — pgvector grounding + trips-like-this rail
```

> ### ⛔ PHASE C GATE — the whole-product flywheel demo
>
> One seeded trip, end to end: agent re‑plans on a weather signal → trip ends →
> a **PRIVATE** Memory Book auto‑drafts → user publishes (future‑end‑date trip
> rejected) → it embeds via local Ollama → a **second** trip's proposal is
> visibly grounded by the first. Full `--runInBand` e2e green with zero 2.0
> keys. `PROGRESS.md` has a row for POST.2C.1–3. **2.0 is done.**

---

## How to use this book

### For an AI assistant

1. Confirm the previous prompt's GATE (if any) is green.
2. _"Execute POST.2X.Y from docs/POST_2.0_PROMPTS.md."_ — the block is
   self‑contained; `CLAUDE.md` + the Three Laws apply.
3. Plan → execute scope‑locked → typecheck + lint + relevant suite
   (`--runInBand` for the full api suite) → update `PROGRESS.md` → **stop and
   ask.** Never auto‑advance. Never cross a GATE without it being green.

### Bundling (per the "two small slices per proceed" rule)

| Bundle under one "proceed" | Why                                                      | Otherwise |
| -------------------------- | -------------------------------------------------------- | --------- |
| `2A.1 + 2A.2`              | skeleton + its schema; both small, one module            | —         |
| `2B.1 + 2B.2`              | the two Phase‑B schema slices; one migration pass        | —         |
| `2C.2 + 2C.3`              | only if 2C.2 stays small (embedding adapter is the risk) | —         |
| —                          | `2A.3`, `2A.4`, `2A.5`, `2B.3`, `2C.1` are each meaty    | ship solo |

### Tracking completion

After each prompt commits, append to `PROGRESS.md` under `## POST‑2.0 log`:

```
### [POST.2X.Y] — <title>
- Date: YYYY-MM-DD
- Commit: <hash>
- Files changed: <count>
- Tests added: <count>
- Zero-key e2e: <paste the green --runInBand summary line>
- LAW 2 grep: <paste the empty result proving no spend/booking path>
```

---

**Provenance:** companion to [`docs/APP_VISION_2.0.html`](APP_VISION_2.0.html)
(strategy, §1–§24) · same format as [`docs/POST_VUX_GAPS.md`](POST_VUX_GAPS.md)
§7 (1.0 series) · **deep-verified against source on 2026‑05‑16** (see
"Verified codebase facts" above) — every path, port symbol, scheduler/Redis
pattern, the pgvector dimension (1024, not 768 — corrected), the notifications
extension point, and the additive TripPlannerRequest scope were read from the
codebase, not assumed · `modules/agent` new; `modules/social`, `modules/feed`,
`modules/media`, `modules/notifications`, `modules/trip`, `modules/weather`
extended · honors CLAUDE.md hard constraints · **not yet committed; no code
written — these are specifications awaiting the user's go.**

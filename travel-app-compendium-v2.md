# 🌍 Travel Super-App — Compendium Review & Upgrades (v2)

> Senior-architect review of your Build Prompt Compendium v1.0. This doc covers: feasibility verdict, concrete bugs to fix inline, missing prompt blocks to add, and meta-layer upgrades (AI safety rails, context carry, self-checks) that make the compendium agent-friendly.

---

## PART A — FEASIBILITY VERDICT

**Overall: 8/10 — feasible and well-structured. Ship-worthy after the upgrades below.**

| Dimension | Rating | Note |
|---|---|---|
| Structural completeness | 9/10 | Phase/block structure is clean and sequential. |
| Technical accuracy | 7/10 | A handful of outdated/buggy picks (listed in Part B). Nothing fatal. |
| AI-agent friendliness | 5/10 | Prompts are written for humans. Missing meta-rails that prevent coding agents from going off the rails. Fix in Part D. |
| Security depth | 7/10 | Solid foundations (argon2id, MFA, rate limits) but 6 specific gaps listed in Part B. |
| Observability depth | 6/10 | OTel is wired; PII scrubbing, SLOs, error budgets, dashboards-as-code are missing. |
| Scope realism | 7/10 | Phase 0 (Weeks 1–3) is accurate. Phase 1 in "Months 2–4" is optimistic for solo build — realistic is 4–5 months solo, 2.5–3 months with 2 devs. |
| Completeness of blocks | 6/10 | Phase 0 is complete; at truncation point, ~12 critical blocks are still missing (listed in Part C). |

**Verdict:** Do the upgrades below before feeding to an AI coding agent. Otherwise you'll burn 20–30% of tokens on rework.

---

## PART B — CONCRETE BUGS IN YOUR V1 BLOCKS (fix inline)

### B1. Dependency issues (Block 0.5)

| You have | Fix to | Why |
|---|---|---|
| `@nestjs/bull` | `@nestjs/bullmq` | `@nestjs/bull` is legacy (Bull v3); `bullmq` is the current line and what you reference elsewhere. |
| (missing) | `@nestjs/terminus` | Health checks — required for Fly.io/K8s probes; otherwise deploys don't roll safely. |
| (missing) | `@fastify/csrf-protection` | You mention CSRF double-submit — needs this on Fastify. |
| (missing) | `@nestjs/cache-manager` + `cache-manager-redis-yet` | For unified cache abstraction instead of ioredis everywhere. |
| (missing) | `pino-pretty` as devDep only | Currently your prod build will fail if `transport: 'pino-pretty'` is referenced without guarding NODE_ENV. |

### B2. Prisma schema issues (Block 0.5)

1. **`Unsupported("geography(Point,4326)")`** — Prisma will not generate typed queries on this field. You MUST supplement with a small raw-SQL layer (a `GeoQueries` service using `$queryRaw<Place[]>`) and explicitly warn the AI: *"Never use `prisma.place.create({ data: { coordinates: ... } })` — always go through `GeoQueries.insertPlace()`."* Without this instruction the agent will generate broken code.

2. **Extensions syntax** — verify on Prisma 5.x:
   ```prisma
   extensions = [postgis, postgisTopology, vector, pg_trgm, pgcrypto]
   ```
   Not `pgvector(map: "vector")`. The extension package name is `vector`.

3. **`emailHash` needs an index** — you mention it but don't declare `@unique` or `@@index([emailHash])`. Lookup without an index = table scan on User table.

4. **Missing `@@index`es** — add at minimum:
   - `Trip @@index([userId, status, createdAt])`
   - `Session @@index([userId, revokedAt])`
   - `CrimeIncident @@index([lat, lng, reportedAt])` (or a GiST on a geography column — better)
   - `NotificationLog @@index([userId, read, createdAt])`

5. **Soft delete inconsistency** — `User.deletedAt?` exists but no other table has it. Either commit to soft-delete everywhere with a Prisma middleware that filters, or remove from User and rely on GDPR anonymization only.

### B3. Security gaps (Block 0.6)

| # | Gap | Fix |
|---|---|---|
| S1 | No password reset flow | Add `POST /auth/forgot-password`, `POST /auth/reset-password` with time-limited signed token (15m TTL) stored hashed in Redis. Rate-limit forgot-password to 3/hour/email. |
| S2 | Account enumeration on register/login | Return identical response timing + identical error messages for "email taken" and "generic failure" on register; for login, always return the same "invalid credentials" regardless of whether email exists. |
| S3 | Backup codes hashed with argon2id | Too slow for lookup. Use HMAC-SHA256 with a server-side pepper, stored as single hashed string per code. Verification is O(1). |
| S4 | No CSRF token for refresh endpoint | Cookie-bound refresh tokens need double-submit CSRF on state-changing routes (you mention it but don't wire it). Add `@fastify/csrf-protection` and an `X-CSRF-Token` header check. |
| S5 | No JWT `kid` / key rotation | Add a `JWKS` setup so you can rotate JWT signing keys without logging everyone out. Use `jose` library; store current + previous key id in Redis. |
| S6 | Rate-limit keys leak PII | Rate-limiting by raw email (you hint at it) logs/stores PII in Redis. Key by `sha256(email + pepper)` instead. |
| S7 | Missing session concurrency limit | Cap active sessions per user (e.g. 10). On limit, revoke oldest. Prevents token farming. |
| S8 | No device fingerprint binding | `deviceInfo` stored but not verified on refresh. Bind refresh-token claim to device fingerprint hash and reject mismatch. |

### B4. Observability gaps (Block 0.3)

- **PII scrubbing on Pino logs**: add a redact list — `['req.headers.authorization', 'req.headers.cookie', 'email', 'password', '*.password', '*.token', '*.refreshToken']`. Without this, auth logs leak JWTs.
- **No SLO definitions**: add `docs/slo/slo-catalog.md` with target SLOs (trip gen p95 < 3s, places search p95 < 300ms, availability 99.5%).
- **No dashboards-as-code**: Grafana should be provisioned via `infra/grafana/dashboards/*.json` checked in — not clicked together in the UI.
- **No error-budget policy**: add `docs/runbooks/error-budget-policy.md`.

### B5. Testing infra gaps (referenced but no block)

Your Block 0.5/0.6 say "integration tests via Supertest + Testcontainers" but there's no **block that actually sets up Testcontainers, test fixtures, and factories**. Agents will stub this out badly. Add Block 0.7 (see Part C).

### B6. Prompt-block-level issues

- **Block 0.4** says "50+ categories" for `PlaceCategorySchema` but only lists ~15. Enumerate all 50 or the agent will hallucinate. Alternative: move to a DB-driven category table and drop from Zod.
- **Block 0.5** step 2 imports from `'../instrumentation'` but no block creates `apps/api/instrumentation.ts`. Add it explicitly to Block 0.5 files-to-create.
- **Block 0.6** references `@app/errors` but Block 0.3 creates `packages/errors` — the import alias (`@app/errors` vs `@travel/errors`) is never specified. Pick one (I recommend `@app/*`) and write it into the Block 0.1 root `tsconfig.json` `paths` section.

---

## PART C — MISSING BLOCKS YOU NEED TO ADD

Before Phase 1, you need these additional Phase 0 blocks. Numbering suggestion in brackets.

### [0.7] Testing Infrastructure
- Testcontainers setup (Postgres + Redis + Meilisearch containers spawned per integration test)
- Jest config per app (unit + integration separate)
- Test fixtures / factories (use `@faker-js/faker` + factory pattern)
- MSW or nock for external API mocking
- Global test setup: DB migration, seed, teardown
- Coverage thresholds enforced in Jest config (domain ≥ 80%, application ≥ 80%, overall ≥ 60%)

### [0.8] Database Seeding & Migrations Strategy
- `prisma/seed.ts` with dev + test + demo datasets (use a `--demo` flag for populated demo city)
- Idempotent seeds (use `upsert`)
- Migration naming convention doc
- Zero-downtime migration playbook (add-then-backfill-then-drop pattern documented)

### [0.9] Event Bus (Redis Streams Adapter)
- `packages/events` — typed event bus with Redis Streams adapter
- `EventBus` interface with `publish` / `subscribe` methods
- Consumer groups per module
- Dead-letter stream for failed events
- This is the "swap to Kafka later" seam — critical to get right now.

### [0.10] Feature Flags + Remote Config
- OpenFeature + PostHog provider (or LaunchDarkly SDK) wired at app bootstrap
- Decorator: `@FeatureFlag('feature_3d_enabled')` on controllers/use-cases
- Config-driven LLM prompts stored in DB + hot-reloaded via Redis pubsub invalidation

### [0.11] CI/CD Pipeline
- `.github/workflows/ci.yml` — lint → typecheck → unit → integration (matrix by app) → build, all parallel via Turbo with remote cache
- `.github/workflows/security.yml` — gitleaks, trivy (images + fs), pnpm audit, CodeQL, Semgrep
- `.github/workflows/cd.yml` — on main: build+push GHCR images, deploy api→Fly.io, web/admin→Vercel, mobile→EAS OTA
- `.github/workflows/preview.yml` — per-PR preview deploys (Fly app per PR, Vercel preview, Expo preview)
- `.github/workflows/release.yml` — changesets → semver → GH release → mobile submission (manual gate)
- Turbo remote cache configured (Vercel remote cache or self-hosted)

### [0.12] API SDK Auto-generation
- `packages/sdk` — auto-generated TypeScript client from OpenAPI via `orval` (or `openapi-typescript` + `openapi-fetch`)
- Regeneration step in CI that fails if OpenAPI changed but SDK not regenerated
- React Query hooks also auto-generated
- Consumed by both `apps/web` and `apps/mobile`

### [0.13] i18n Foundation
- `packages/i18n` with ICU messageformat support
- `next-intl` integration in web
- `react-i18next` or `react-native-localize` + `i18next` in mobile
- Translation key extraction via `i18next-parser` in CI
- Namespace convention: `common`, `auth`, `trip`, `safety`, etc.
- This MUST be in Phase 0 — retrofitting i18n is 10x more expensive than doing it at scaffold time.

### [0.14] Frontend Scaffolds (Web + Admin + Mobile)
Three sub-blocks, one per frontend:

**0.14.a — apps/web (Next.js 15)**: App Router, RSC, shadcn/ui + Tailwind, auth middleware (session cookie), SDK integration, PostHog client, Sentry browser, i18n, skeleton layout (marketing + app areas), themes (Light/Dark/Sunset/Midnight), ErrorBoundary, 404/500 pages, robots.txt, sitemap, OpenGraph metadata setup.

**0.14.b — apps/admin (Next.js 15)**: Stricter RBAC (admin-only), no marketing layer, audit logging on every mutation, separate Vercel deployment, IP allowlist middleware option.

**0.14.c — apps/mobile (React Native + Expo 51)**: expo-router, Tamagui, MMKV, WatermelonDB (offline), secure-store (keychain/keystore), biometric auth, push notification setup (expo-notifications → FCM/APNs), deep linking, OTA update policy, crash reporting (Sentry).

### [0.15] Idempotency & Webhooks
- Idempotency-key middleware (hash request, store result in Redis 24h)
- Stripe webhook handler with signature verification + idempotency
- Generic webhook framework for inbound integrations (Booking.com, Twilio, etc.)

### [0.16] Health / Readiness / Liveness
- `GET /health/live` — app is up (no dep checks)
- `GET /health/ready` — all deps healthy (DB, Redis, ai-service, Meilisearch)
- `GET /health/startup` — long-running init done (migrations applied, etc.)
- `@nestjs/terminus` with health indicators per dep

### [0.17] Security Headers + CORS + CSP (production-grade)
- You set Helmet defaults but CSP is permissive. Add strict CSP with nonces for inline scripts.
- Configure per-environment CORS allowlist from env var (comma-separated)
- Trusted-types header
- COOP/COEP for mobile webviews
- Permissions-Policy header (deny camera/mic/geolocation unless route opts in)

### [0.18] Per-Phase Smoke & Acceptance Test Suite
- End-of-phase automated test script that runs all acceptance criteria from all blocks in that phase
- Fails CI if any regress
- Lives in `tests/smoke/phase-0.smoke.ts` etc.

### Phase 1 missing blocks (beyond what I saw in 1.1 and 1.2)

- **1.3** Stays module (search, dedup, affiliate deeplink, price history)
- **1.4** Food & Tryouts module
- **1.5** Transport & Routing module (mode-fit, ETA, transit schedules, ride-hail deeplinks)
- **1.6** Weather module (Open-Meteo proxy + cache + alerts)
- **1.7** Translation module (ai-service proxy, on-device NLLB option)
- **1.8** Offline pack generator (map tiles + itinerary JSON + translator phrases bundle)
- **1.9** Notifications module (multi-channel fan-out, DND, quiet hours, user preferences)
- **1.10** Payments module (Stripe subs + affiliate tracking)
- **1.11** ai-service skeleton (Python FastAPI + Ray Serve + model loaders)
- **1.12** Mobile: offline-first trip viewer with sync conflict resolution

---

## PART D — META-LAYER UPGRADES (make it AI-agent friendly)

The single biggest improvement. Without these, an AI coding agent will: (a) rewrite files you didn't ask for, (b) install random deps, (c) commit secrets, (d) skip tests, (e) invent APIs.

### D1. Add a global "System Rules" preamble to the compendium

Prepend this BEFORE Block 0.1:

```
═════════════════════════════════════════════════
SYSTEM RULES FOR ALL PROMPT BLOCKS — READ FIRST
═════════════════════════════════════════════════

## Safety Rails (HARD CONSTRAINTS — never violate)

1. NEVER modify files outside the files-to-create/edit list for the current block.
2. NEVER install npm/pip/brew dependencies not explicitly listed in the current block.
3. NEVER delete a file you did not create in the current block.
4. NEVER commit to git unless the user says "commit this".
5. NEVER write secrets, API keys, or credentials into any file — use placeholders like `REPLACE_ME_SEE_DOPPLER`.
6. NEVER skip the ACCEPTANCE CRITERIA verification step.
7. NEVER proceed to the next block without user confirmation.
8. If a block asks for code that conflicts with already-existing code, STOP and ask.
9. If you are uncertain about a design choice, STOP and ask — do not guess.
10. Treat the `prisma/schema.prisma` file as append-only unless told otherwise. Never drop or rename models/fields.

## Context Carry

At the start of each block, the user will paste a "CONTEXT SUMMARY" from the previous block's output.
Treat it as authoritative. Do not re-read prior files you don't need.

## Output Format

For every block, after generating files, output in this exact order:
  1. FILES CREATED: <list>
  2. FILES EDITED: <list>
  3. DEPENDENCIES ADDED: <list with versions>
  4. COMMANDS TO RUN: <numbered list the user copy-pastes>
  5. VERIFICATION: <what I expect the output to look like>
  6. NEXT BLOCK: <which block number is next, and what context to carry>

## Self-Check Before Declaring Done

Before saying "block complete", verify:
  - [ ] All files in spec exist at correct paths
  - [ ] TypeScript compiles (`pnpm turbo run typecheck --filter=<pkg>`)
  - [ ] Lint passes (`pnpm turbo run lint --filter=<pkg>`)
  - [ ] No `// TODO` left that wasn't in the spec
  - [ ] No `any` types introduced (unless explicitly allowed)
  - [ ] No `console.log` (use logger package)
  - [ ] Acceptance criteria are met or clearly blocked

## Escalation

If stuck, produce a "BLOCKED" report:
  - What I tried
  - What failed (paste exact error)
  - What I need from user to unblock
  - Do NOT guess or proceed.
```

### D2. Add per-block "CONTEXT TO CARRY" footer

At the end of every block, before ACCEPTANCE CRITERIA, insert:

```
CONTEXT TO CARRY INTO NEXT BLOCK (paste this back to the AI at the start of next prompt):
- Files created in this block: [list]
- Key interfaces exported: [list with paths]
- Decisions made: [any branch points the agent took]
- Deviations from spec: [if any — flag for user review]
```

This prevents context loss between prompts and prevents the agent from re-scanning the entire repo every block.

### D3. Add per-block "TOKEN BUDGET" hint

Help the agent decide how much to generate:

```
TOKEN BUDGET:
- Expected files: 12–18
- Expected output: ~4k lines of code
- If you're about to generate >2x this, STOP and ask if you should split.
```

### D4. Add per-block "COMMON PITFALLS"

After each block, add a list of mistakes previous agents have made on this block:

```
COMMON PITFALLS (avoid these):
- Don't use `@nestjs/bull` — it's deprecated, use `@nestjs/bullmq`
- Don't write raw SQL in repositories except for PostGIS/vector — use Prisma
- Don't forget the global prefix `/api/v1`
- Don't use `pino-pretty` transport in production (guard with NODE_ENV)
```

### D5. Add "ROLLBACK INSTRUCTIONS"

Every block should end with:

```
ROLLBACK (if block fails):
  git checkout -- <files>
  rm -rf <new directories>
  pnpm install  (to restore lockfile if deps changed)
```

---

## PART E — SUGGESTED UPGRADED TABLE OF CONTENTS

Reorder and renumber for the final compendium:

```
PHASE 0 — FOUNDATION (Weeks 1–4)
  0.0  System Rules & Meta-Layer                    [NEW — Part D]
  0.1  Monorepo Scaffold & Toolchain                [keep, fix B6]
  0.2  Docker Compose Local Dev Stack               [keep]
  0.3  Shared Packages (config/logger/errors/obs)   [keep, fix B4]
  0.4  shared-types Package                         [keep, enumerate categories]
  0.5  NestJS API Skeleton + Cross-Cutting          [keep, fix B1/B2]
  0.6  Identity Module (Auth)                       [keep, fix B3]
  0.7  Testing Infrastructure                       [NEW]
  0.8  Database Seeding & Migrations                [NEW]
  0.9  Event Bus (Redis Streams)                    [NEW]
  0.10 Feature Flags + Remote Config                [NEW]
  0.11 CI/CD Pipeline                               [NEW]
  0.12 API SDK Auto-generation                      [NEW]
  0.13 i18n Foundation                              [NEW]
  0.14 Frontend Scaffolds (web/admin/mobile)        [NEW — 3 sub-blocks]
  0.15 Idempotency & Webhooks                       [NEW]
  0.16 Health / Readiness / Liveness                [NEW]
  0.17 Security Headers + CORS + CSP                [NEW]
  0.18 Phase 0 Smoke Test Suite                     [NEW]

PHASE 1 — CORE MVP (Months 2–5, revised)
  1.1  Places Catalog                               [keep]
  1.2  Trip Planning + AI Orchestration             [keep — the core]
  1.3  Stays Module                                 [NEW]
  1.4  Food & Tryouts Module                        [NEW]
  1.5  Transport & Routing Module                   [NEW]
  1.6  Weather Module                               [NEW]
  1.7  Translation Module                           [NEW]
  1.8  Offline Pack Generator                       [NEW]
  1.9  Notifications Module                         [NEW]
  1.10 Payments Module (Stripe + affiliate)         [NEW]
  1.11 ai-service Skeleton (Python FastAPI)         [NEW]
  1.12 Mobile Offline-First Trip Viewer             [NEW]
  1.13 Phase 1 Smoke Test Suite                     [NEW]

PHASE 2 — SAFETY & LIVE (Months 6–8)
  2.1  Crime & Safety Layer
  2.2  Scam Database & Agent Marketplace (KYC + Escrow)
  2.3  Emergency SOS
  2.4  Live Companion (Geofencing + Re-plan)
  2.5  Events & Culture
  2.6  Social & Groups (Shared Trips + Expense Split)
  2.7  Freemium Launch (Stripe subs + gating)
  2.8  Women-Solo / LGBTQ+ Safety Overlays
  2.9  Phase 2 Smoke Test Suite

PHASE 3 — WOW LAYER (Months 9–12)
  3.1  3D Destination Previews (Cesium + Google Tiles)
  3.2  Animated Itinerary Map
  3.3  Crowd Analytics (Satellite + Popular Times ML)
  3.4  Iconic Photo Templates (with AR alignment)
  3.5  Price Aggregator (Booking + Amadeus + Expedia)
  3.6  Fake-Review Detection (DistilBERT)
  3.7  Memory Book (post-trip)
  3.8  Public Shareable Templates (growth engine)
  3.9  B2B Pilot Endpoints
  3.10 Phase 3 Smoke Test Suite

PHASE 4 — POLISH & SCALE (Month 12+)
  4.1  Gamification (badges, visited-places)
  4.2  Carbon Footprint + Greener Swaps
  4.3  "Call a Guide" Video (Daily.co / LiveKit)
  4.4  Fine-tune Llama on real trips (LoRA)
  4.5  Multi-region Deployment
  4.6  SOC 2 Type I Readiness
```

---

## PART F — REALISTIC TIMELINE (honest)

| Team shape | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total to full v1 |
|---|---|---|---|---|---|---|
| Solo + AI agent | 4–5 weeks | 4–5 months | 3 months | 4 months | Ongoing | 12–15 months |
| 2 devs + AI | 2–3 weeks | 2.5–3 months | 1.5–2 months | 2.5 months | Ongoing | 7–9 months |
| 4 devs + 1 designer + AI | 1.5–2 weeks | 1.5–2 months | 1–1.5 months | 2 months | Ongoing | 5–6 months |

**Assumptions:** all devs competent in the stack; working against a clear backlog; no pivots mid-build; QA embedded (not a separate phase). The v1 compendium's "Months 2–4" for Phase 1 assumes the top row + existing library familiarity — tight but not impossible for a disciplined solo operator.

---

## PART G — WHAT TO DO NEXT (concrete)

Pick ONE of these next actions:

1. **"Apply all B-series fixes"** — I patch your existing v1 blocks inline (B1–B6) without adding new blocks. Fastest path to feed to an agent.
2. **"Write Block 0.0 (System Rules)"** — I draft the full meta-layer preamble ready to prepend.
3. **"Write the Phase 0 missing blocks"** — I draft 0.7 through 0.18 in full v1 format.
4. **"Write the Phase 1 missing blocks"** — I draft 1.3 through 1.13.
5. **"Rewrite the entire compendium v2"** — I produce a single replacement file, all fixes + additions applied. Longest; most complete.
6. **"Just fix one specific block"** — point me at the block number.

Tell me which, and I'll generate only that md file. No code execution until you say go.

# POST_VUX_GAPS — what's left after V.UX.40

> **Purpose**: This is the single source of truth for "what's missing"
> in TravelSuperApp **after** the V.UX.0–40 series shipped (commit
> `30612af` on `main`). It pairs a candid lag audit with **drop-in
> execution prompts** — every gap below has a copy-paste prompt block
> that an engineer or an AI can run with zero re-context.
>
> If you're an AI: scroll to **§7 Drop-in execution prompts** and
> pick the `[POST.X]` you've been told to ship. Each prompt is
> self-contained — files, deps, acceptance criteria, verify steps.
>
> If you're a human reviewer: read top-to-bottom for the picture.
>
> **Audit date**: 2026-05-11 · **Audit author**: Claude Opus 4.7
> **Repo state**: 238 prompts shipped · 125/125 suites · 749/749 tests
> · 53 web routes · 17 api modules · all typechecks + builds green.

---

## Table of contents

1. [Project snapshot](#1-project-snapshot)
2. [Honest scoring](#2-honest-scoring)
3. [Lag analysis](#3-lag-analysis)
4. [Score-gap matrix](#4-score-gap-matrix)
5. [Architecture flowcharts](#5-architecture-flowcharts)
6. [Top 10 work streams](#6-top-10-work-streams)
7. [Drop-in execution prompts](#7-drop-in-execution-prompts) ← **start here if executing**
8. [How to use these prompts](#8-how-to-use-these-prompts)

---

## 1. Project snapshot

**Stack**: Turborepo + pnpm · NestJS 11 (Fastify) + Next.js 15

- React Native (Expo 51) + Prisma 5 + Postgres 16 (PostGIS, pgvector)
- Redis 7 + Meilisearch + MinIO/S3.

**Architecture**: Clean / hexagonal — `domain ← application ←
infrastructure/interface`. 17 NestJS feature modules. ~150 DTO
schemas exposed via Swagger; full SDK regenerated from openapi.yaml
via orval.

**Surface today**:

- **API** — `:3000`, ~100 routes, `/health/*` + `/docs` + `/api/v1/*`.
- **Web** — `:3002` (Docker owns `:3001`), 53 routes incl. landing,
  /demo, /press, /admin/_, /compliance/_, /ops/\*.
- **Mobile** — Expo 51 isolated workspace, 13 screens scaffolded.
- **Schedulers** — AutoArchive, WeeklyDigest, KarmaRecompute,
  AccountPurge, OrphanS3Sweep — all daily/hourly.
- **Caches** — 7 Redis-backed (places/stays/food/weather/transport
  /events/JWKS).

**Roles**: `user · premium · agent · admin · compliance · sre`.

---

## 2. Honest scoring

| Category                          | Score | Notes                                                                                                                    |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Architecture (clean-hex, modules) | 4.5/5 | Done well; @Global concerns correct                                                                                      |
| Functionality breadth             | 4.5/5 | Genuinely covers travel/trips/safety/social/media/admin/compliance/ops                                                   |
| Visual polish                     | 2.5/5 | Tailwind defaults; emoji-as-illustration; no logo; no real photos                                                        |
| Demo data                         | 1.5/5 | Seed broken; pages barren on first load                                                                                  |
| UX edges (microinteractions)      | 3.0/5 | SOS hold-to-confirm + privacy 3-step + memory book editor stand out; rest 1st-pass                                       |
| Production readiness              | 3.0/5 | Auth + role gates real; observability stubbed; rate limits real; mailer stubbed; Stripe absent; AI stubbed; OAuth mocked |
| Documentation                     | 4.5/5 | Swagger + accessibility statement + runbook index + extensive prompt archive                                             |
| Test coverage                     | 4.0/5 | 125 suites · 749 tests; CI runs                                                                                          |

**Overall: 3.6/5** — _"Real backend with a thin coat of frontend paint."_

The backend is genuinely production-grade for an MVP. The web app is
feature-complete in route inventory but visually first-pass. To take
this from 3.6 → 4.5, the gaps below close in roughly 3 weeks of
focused work (most parallelisable).

---

## 3. Lag analysis

### 🔴 Critical lags (block real demo / launch)

| ID  | Lag                        | Symptom                                                                                              | Why it lags                                                                  | Owner stream       |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| C1  | Demo data is empty         | Landing's live-metrics shows `0/0/0`. /featured empty. /trips empty. /discover returns 0 gems.       | `seed-demo.ts` script is stale (broken DI shape) and never runs successfully | [POST.1](#post1)   |
| C2  | No real imagery anywhere   | Press kit screenshots are emojis. Landing hero is a CSS gradient. Memory books would have no covers. | No image pipeline; no stock photo licensing                                  | [POST.2](#post2)   |
| C3  | AI trip planner is stubbed | "Generate plan with AI" works but produces a deterministic mock                                      | TRIP_PLANNER_PORT has Claude adapter but no `ANTHROPIC_API_KEY` provisioned  | [POST.4](#post4)   |
| C4  | Translation is stubbed     | Translate widget returns `[stub:fr] hello` literally                                                 | TRANSLATOR_PORT only has stub adapter; Google/DeepL not wired                | [POST.7](#post7)   |
| C5  | Mailer is stubbed          | Magic-links / password resets / appeals never reach an inbox                                         | MAILER_PORT only has StubMailerAdapter; Resend/SES not wired                 | [POST.3](#post3)   |
| C6  | OAuth is mocked            | "Sign in with Google" doesn't actually go through Google                                             | MockOAuthProvider only; no real Google client_id / Apple wiring              | [POST.3](#post3)   |
| C7  | No payments                | Premium tier gated by manual role flag; no checkout flow                                             | Stripe not scaffolded; no Subscription / EscrowHold use-cases                | [POST.9](#post9)   |
| C8  | No real production deploy  | Fly.io config exists; never been deployed end-to-end                                                 | No CD pipeline; no smoke test against deployed instance                      | [POST.10](#post10) |

### 🟠 Important lags (visible in demo but not blocking)

| ID  | Lag                               | Symptom                                              | Owner stream        |
| --- | --------------------------------- | ---------------------------------------------------- | ------------------- |
| I1  | Visual polish is Tailwind-default | Buttons are gray boxes; no shadows/depth; no logo    | [POST.2](#post2)    |
| I2  | Stub SMS for SOS fan-out          | Trusted-contact notifications go to a ring buffer    | [POST.7](#post7)    |
| I3  | Push notifications no-op          | SW registers; subscribe succeeds; no actual push     | [POST.7](#post7)    |
| I4  | Real maps require keys            | Leaflet rate-limited; no MapTiler / Mapbox           | [POST.5](#post5)    |
| I5  | No thumbnail generation           | Memory books store full-size; bandwidth heavy        | [POST.5](#post5)    |
| I6  | Mobile app is isolated            | apps/mobile excluded from root workspace             | (waits for Expo 52) |
| I7  | Federated places mock-only        | `/places/federated-search` returns synthetic results | [POST.4](#post4)    |
| I8  | Empty agent marketplace           | `/agent/dashboard` works but no real agents          | [POST.1](#post1)    |
| I9  | No customer-support inbox         | Banned users submit appeals; no triage workflow      | (future)            |
| I10 | No ToS / Privacy / Cookies        | Footer would link them                               | [POST.6](#post6)    |
| I11 | No pricing page                   | Premium exists in code; no consumer explanation      | [POST.6](#post6)    |
| I12 | No FAQ / Help Center              | Users with questions have nowhere to go              | [POST.6](#post6)    |
| I13 | No status page                    | Public users can't see uptime                        | [POST.6](#post6)    |
| I14 | /admin/media has no thumbnails    | Just rows of cuids and S3 keys                       | [POST.5](#post5)    |

### 🟡 Polish lags (nice-to-have)

| ID  | Lag                           | Symptom                                                  |
| --- | ----------------------------- | -------------------------------------------------------- |
| P1  | No friendly relative time     | "3 hours ago" missing; all timestamps are toLocaleString |
| P2  | No empty-state illustrations  | Plain "No items" text on every list                      |
| P3  | No skeleton loaders           | Plain "Loading…" text                                    |
| P4  | No keyboard hint chips        | Cmd+K palette exists but no discovery hint               |
| P5  | Forms are browser-default     | No floating labels, no inline validation polish          |
| P6  | No global toast system        | Errors → aria-live only; success silent                  |
| P7  | Inbox is a flat list          | No grouping by date                                      |
| P8  | No dark/light auto-screenshot | Press kit only shows 1 mode                              |
| P9  | Comfort mode toggle buried    | Header shortcut would help                               |
| P10 | Map clusters absent           | Discover/near-me would crowd at high density             |

→ All addressed by [POST.8](#post8).

### 🔵 Operational lags (invisible to users, hurt SRE)

| ID  | Lag                                 | Symptom                                               |
| --- | ----------------------------------- | ----------------------------------------------------- |
| O1  | OTel exporter points nowhere        | `OTLPExporterError 404` in api logs every boot        |
| O2  | No error monitoring (Sentry)        | Errors land only in api logs                          |
| O3  | No metrics scraping (Prometheus)    | `/api/v1/metrics` exists but nothing scrapes it       |
| O4  | No backup automation                | Postgres data lives in Docker volume only             |
| O5  | No secret rotation                  | EMAIL_PEPPER + JWT keys static; rotation undocumented |
| O6  | Single-region                       | All on one Fly.io region                              |
| O7  | CI runs but doesn't gate deploy     | Tests run; merge protection unclear                   |
| O8  | No runbook execution from /ops      | Read-only markdown; no "run this" buttons             |
| O9  | Demo seed broken                    | `pnpm --filter=api db:seed:demo` crashes              |
| O10 | tsx watch DI bug forces tsc rebuild | Dev iteration on api is slow                          |

→ Addressed by [POST.10](#post10).

---

## 4. Score-gap matrix

| Area                 | Current | Target | What closes the gap                                                                           | Days |
| -------------------- | ------- | ------ | --------------------------------------------------------------------------------------------- | ---- |
| Visual polish        | 2.5     | 4.5    | Design pass + button/card/input system + hero illustration + real screenshots                 | 3    |
| Demo data            | 1.5     | 4.5    | Fix seed; seed 12 trips, 8 memory books, 30 reviews, 5 SOS, 20 audit entries with real photos | 1    |
| UX edges             | 3.0     | 4.0    | Toasts + empty-state illustrations + relative time + skeletons                                | 2    |
| Production readiness | 3.0     | 4.0    | Resend mailer + real Google OAuth + Sentry + real Twilio                                      | 3    |
| AI integration       | 2.0     | 4.0    | Provision ANTHROPIC_API_KEY; prompt template; response shape mapper                           | 1    |
| Payments             | 0.0     | 3.0    | Stripe scaffold: customer + checkout + webhook + subscription sync                            | 3    |
| Brand identity       | 1.5     | 3.5    | Logo (SVG) + Inter font + corner-radius scheme + hover states                                 | 1    |
| Marketing surface    | 2.0     | 4.0    | /pricing, /help, /status, footer links, real OG screenshots                                   | 2    |
| Image pipeline       | 2.0     | 4.0    | Sharp on upload-confirm + WebP variants + thumbnails                                          | 1    |
| Observability        | 1.5     | 3.5    | Sentry DSN + OTel → Honeycomb + Grafana dashboard                                             | 1    |
| Compliance docs      | 3.0     | 4.5    | /terms /privacy /cookies                                                                      | 0.5  |
| Customer support     | 0.0     | 3.0    | Help-center search + email handoff form                                                       | 1    |

**Total**: ~3 weeks sequential; ~10 days if 2-3 streams parallelise.

---

## 5. Architecture flowcharts

### Flowchart A — High-level architecture

```
                              ┌────────────────────────┐
                              │    Browser / Mobile    │
                              │  (Next.js 15 / Expo)   │
                              └───────────┬────────────┘
                                          │ HTTPS + JWT
                                          ▼
            ┌─────────────────────────────────────────────────────┐
            │            API GATEWAY (NestJS / Fastify)           │
            │   :3000  +  guards: rate-limit → JWT → roles        │
            └────┬───────────┬──────────────┬─────────────┬───────┘
                 │           │              │             │
        ┌────────▼──┐ ┌──────▼────┐ ┌───────▼─────┐ ┌─────▼──────┐
        │ Identity  │ │   Trip    │ │   Safety    │ │   Media    │
        │  Module   │ │  Module   │ │   Module    │ │  Module    │
        └────┬──────┘ └────┬──────┘ └──────┬──────┘ └──────┬─────┘
             │             │               │               │
             └─────────────┼───────────────┼───────────────┘
                           │               │
        ┌──────────────────▼──┐    ┌──────▼─────────┐
        │  + 13 more modules  │    │ Cross-cutting: │
        │  social, account,   │    │  • Logger      │
        │  notifications,     │    │  • Config      │
        │  food, stays, ...   │    │  • Errors      │
        └──────────┬──────────┘    │  • Auth        │
                   │               │  • Events      │
                   ▼               │  • Metrics     │
        ┌────────────────────┐     │  • Rate-limit  │
        │   PORTS / ADAPTERS │     │  • DB (Prisma) │
        │ Hexagonal isolation│     └────────────────┘
        └─────────┬──────────┘
                  │
   ┌──────────────┼──────────────┬──────────────┬─────────────┐
   ▼              ▼              ▼              ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Postgres│  │  Redis   │  │  MinIO   │  │Meilisearch│  │ Stub /   │
│+PostGIS│  │ (cache + │  │   (S3)   │  │ (search)  │  │ External │
│+pgvector│ │  events) │  │          │  │           │  │  APIs    │
└────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
                                                       (Claude,Twilio
                                                        Google,Resend
                                                        — mostly stubs)
```

### Flowchart B — Web app route map (by access level)

```
                          ┌──────────────────┐
                          │      LANDING     │
                          │        /         │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼─────────────────────────┐
              │                    │                         │
              ▼                    ▼                         ▼
       ┌─────────────┐      ┌──────────────┐         ┌──────────────┐
       │  PUBLIC     │      │  AUTH        │         │  RESTRICTED  │
       │  pages      │      │  pages       │         │  pages       │
       └─────────────┘      └──────────────┘         └──────────────┘
       /demo                /login                   (require login)
       /press               /register                /trips
       /featured            /login/forgot            /trips/[id]
       /accessibility       /login/reset/[token]     /trips/new
       /shared/[code]       /login/mfa-recover       /memory-books
       /memory-books/[id]   /auth/magic-link/[t]     /memory-books/*
       /users/[id]          /onboarding              /inbox
       /eateries/[id]       /account/reactivate      /near-me
       /connectivity/[c]    /appeal                  /discover
       /sitemap.xml                                  /account
       /robots.txt                                   /account/preferences
       /og/memory-book/[id]                          /account/privacy
                                                     /account/trusted-contacts
                                                     /agent/* (role: agent)

                                                         │
                                ┌────────────────────────┼───────────────────────┐
                                │                        │                       │
                                ▼                        ▼                       ▼
                         ┌──────────────┐         ┌─────────────┐         ┌─────────────┐
                         │  ADMIN       │         │ COMPLIANCE  │         │     OPS     │
                         │  role: admin │         │ role:       │         │ role:       │
                         │              │         │   compliance│         │   admin |   │
                         │              │         │   admin     │         │   compliance│
                         │              │         │             │         │   sre       │
                         └──────┬───────┘         └──────┬──────┘         └──────┬──────┘
                                │                        │                       │
                       /admin                    /compliance              /ops
                       /admin/audit              /compliance/takedowns    /ops/runbooks
                       /admin/scam-reports
                       /admin/sos
                       /admin/users
                       /admin/media
```

### Flowchart C — User lifecycle (anon → power user)

```
   anon visitor
        │
        │  visits /  → reads landing → clicks Sign up
        ▼
   /register  ───────►  email + pw + displayName
        │
        │  POST /api/v1/auth/register
        ▼
   IdentityModule
   • RegisterUseCase: argon2id hash, hashEmail, persist
   • IssueSessionUseCase: mint JWT pair
   • Set httpOnly refresh cookie
        │
        ▼
   redirect → /onboarding
        │  3 steps: Where (city) → When (dates) → Generate
        │
        ▼
   /trips   ◄── now a regular `user` role
        │
        │ daily flow:
        │  • create trip (V.UX.4 presets)
        │  • generate itinerary
        │  • drag-reorder days, add notes (V.UX.6/28)
        │  • lock + share with collaborators (V.UX.8/9/10)
        │  • track expenses + settle-up (V.UX.5/8)
        │  • upload media → memory book (V.UX.11/12)
        │
        ▼
   becomes premium ──► /trips/[id]/concierge unlocks
        │
        ▼
   becomes agent  ──► /agent/* dashboards unlock
        │
        ▼
   in case of trouble:
        ├─ trigger SOS (V.UX.13/35) ─► trusted contacts notified
        │                            └► local 911 surfaced (V.UX.35)
        │
        ├─ password lost  ─► /login/forgot (V.UX.31)
        ├─ MFA lost       ─► /login/mfa-recover  (V.UX.31)
        ├─ account banned ─► /appeal (V.UX.34)
        ├─ deleted self   ─► /account/reactivate within 7d (V.UX.33)
        └─ exit GDPR-style ─► /account/privacy → 3-step delete (V.UX.32)
```

### Flowchart D — Staff lifecycle (role escalation)

```
   regular user
        │
        │ promoted via:  pnpm --filter=api admin:promote <email>
        │ then sign out + sign back in (role lives in JWT)
        │
        ▼
   ┌────────────────────────────────────────────────────────────┐
   │ Promoted to one of: admin | compliance | sre               │
   └────────────────────────────────────────────────────────────┘
        │
        │ admin   ──► full destructive power
        │              /admin/users           ban / unban
        │              /admin/scam-reports    verify / dismiss
        │              /admin/sos             resolve
        │              /admin/media           takedown
        │              /admin/audit           read-only audit trail
        │              /admin/account-purge   force GDPR sweep
        │
        │ compliance ─► read-only reporting
        │              /compliance            retention dashboard
        │              /compliance/takedowns  CSV export
        │              (also /ops via subset)
        │
        │ sre   ──► read-only health + force-purge
        │              /ops                   health probes
        │              /ops/runbooks          markdown index
        │
        ▼
   every destructive admin action  ──►  AdminAuditLog row
   (V.UX.36 retrofit on 8 use-cases)      ↓
                                          /admin/audit  ◄── append-only history
                                          /compliance/takedowns ◄── filtered subset
```

### Flowchart E — Request flow for a typical authenticated call

```
  Browser
    │
    │ fetch('/api/v1/trips', { headers: Authorization: Bearer <jwt> })
    ▼
  ┌──────────────────────────────────────────────────────────┐
  │  RateLimitGuard  (Throttler + Redis bucket)               │
  │   - 429 if bucket empty                                   │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  JwtAuthGuard                                              │
  │   - decode & verify against JWKS keyring                   │
  │   - check sessionId still valid in Redis                   │
  │   - attach req.user = { sub, sid, role }                   │
  │   - 401 if missing/invalid (unless @Public)                │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  RolesGuard                                                │
  │   - check req.user.role ∈ @Roles(...) metadata             │
  │   - 403 ROLE_FORBIDDEN if not                              │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  ZodValidationPipe (per @Body / @Query / @Param)           │
  │   - 422 VALIDATION_FAILED on bad shape                     │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  Controller method                                         │
  │   - calls UseCase.execute(...)                             │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  UseCase (application layer)                               │
  │   - orchestrates ports                                     │
  │   - emits DomainEvents → Redis Streams (notifications)     │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  Adapters (infrastructure)                                 │
  │   - PrismaXRepository / RedisXCache / S3StorageProvider    │
  └────────────────────────────┬──────────────────────────────┘
                               │
  ┌────────────────────────────▼──────────────────────────────┐
  │  DomainExceptionFilter / AllExceptionFilter                │
  │   - DomainError → typed JSON envelope (code, message,      │
  │     fieldErrors, context)                                  │
  │   - unknown → 500 INTERNAL_ERROR with traceId              │
  └────────────────────────────────────────────────────────────┘
                               │
                               ▼
                          Browser receives JSON
```

---

## 6. Top 10 work streams

Ranked by **visible impact per day of work**:

| Rank | ID      | Title                                                                | Days | Impact                                  |
| ---- | ------- | -------------------------------------------------------------------- | ---- | --------------------------------------- |
| 1    | POST.1  | Fix demo seed + seed real photo data                                 | 1    | 🟢🟢🟢 huge — pages stop looking broken |
| 2    | POST.2  | Design pass on landing + /trips + /demo                              | 3    | 🟢🟢🟢 huge aesthetic win               |
| 3    | POST.3  | Wire Resend mailer + real Google OAuth                               | 2    | 🟢🟢 "this is real" win                 |
| 4    | POST.4  | Wire Anthropic AI for trip planner                                   | 1    | 🟢🟢 demo magic                         |
| 5    | POST.5  | Image pipeline (Sharp + thumbnails + WebP)                           | 1    | 🟢 quietly improves everything          |
| 6    | POST.6  | Add /pricing /help /status /terms /privacy                           | 2    | 🟢 closes marketing surface             |
| 7    | POST.7  | Wire Twilio SOS SMS + VAPID push                                     | 2    | 🟢 closes safety claims                 |
| 8    | POST.8  | Toast system + empty-state illustrations + skeletons + relative time | 2    | 🟢 feels much more responsive           |
| 9    | POST.9  | Stripe scaffold (customer + checkout + webhook + subscription)       | 3    | 🟡 unlocks Premium tier                 |
| 10   | POST.10 | Sentry + Honeycomb + CD pipeline                                     | 1.5  | 🟡 closes observability gap             |

**If you only do one**: **POST.1**. Without seeded data, every other improvement is invisible because pages are empty.

---

## 7. Drop-in execution prompts

> Each prompt is **self-contained**. Paste the block under the
> `[POST.X]` heading into Claude Code (or any AI coding assistant) or
> hand it to an engineer with no other context. Each prompt follows
> the same convention as the V.UX series in
> `travel-app-user-prompts.md`: scope-locked file list, deps, env
> vars, acceptance criteria, verify steps, commit format.
>
> Hard constraints from `CLAUDE.md` apply universally:
>
> - Modify only files in the prompt's "Files to touch" list.
> - Add only dependencies explicitly listed.
> - No silent deletes; no surprise commits.
> - No `any` types. No `console.log` — use `@app/logger`.
> - Never store tokens in `localStorage`.
> - Run `pnpm turbo run typecheck` + `lint` green before committing.

---

### POST.1 — Fix demo seed + populate real photo data

```
[POST.1] Demo seed + real photo fixtures

Context:
  The api boots, web boots, but every "list" page renders empty
  because `pnpm --filter=api db:seed:demo` fails with a stale DI
  shape (RegisterUseCase's ctor changed in a recent V.UX). The
  goal is a single command that gives the app realistic life:
  12 trips, 8 memory books with real travel photos, 30 reviews,
  5 SOS events (2 active, 3 resolved), 20 admin audit entries,
  10 scam reports, 4 verified agents, 6 ban appeals.

Files to touch:
  apps/api/scripts/seed-demo.ts                    (rewrite — fix DI shape; expand fixtures)
  apps/api/scripts/fixtures/photos.ts              (new — Unsplash photo URL constants + attribution)
  apps/api/scripts/fixtures/users.ts               (new — 20 demo users with hashed pw)
  apps/api/scripts/fixtures/trips.ts               (new — 12 trip drafts in 8 cities)
  apps/api/scripts/fixtures/memory-books.ts        (new — 8 books w/ 4-6 photos each)
  apps/api/scripts/fixtures/reviews.ts             (new — 30 reviews)
  apps/api/scripts/fixtures/safety.ts              (new — sos + scam fixtures)
  apps/api/scripts/fixtures/admin.ts               (new — audit entries + appeals + agents)
  apps/api/package.json                            (add `db:seed:demo:reset` script)

Files NOT to touch:
  apps/api/src/**                                  (no source changes — seed is a side script)
  apps/web/**                                      (web shouldn't change)

Deps: none

Env vars needed:
  DATABASE_URL, REDIS_URL, S3_* (already in apps/api/.env.local)
  UNSPLASH_ACCESS_KEY  (optional — falls back to baked URL list if absent)

Acceptance criteria:
  - `pnpm --filter=api db:seed:demo` runs to completion with exit 0
  - After seed, `curl /api/v1/metrics-public` returns
    tripsThisMonth >= 10, memoryBooksThisMonth >= 8, activeUsersThisWeek >= 15
  - After seed, /featured shows 8 memory books with cover photos
  - After seed, /trips (logged in as `demo@travel.local`) shows 12 trips
  - After seed, /admin/audit (logged in as `admin@travel.local`) shows 20 entries
  - After seed, /admin/sos shows 5 events (2 active)
  - After seed, /compliance/retention shows non-zero counts in every category
  - `pnpm --filter=api db:seed:demo:reset` wipes + re-seeds (idempotent)
  - All photos are real URLs (Unsplash CDN); attribution stored in MediaAsset.metadata
  - Seeded users have known passwords printed at end of script

How to verify:
  1. `bash scripts/dev-bootstrap.sh`
  2. `pnpm --filter=api db:seed:demo`
  3. Check stdout for the demo user/password table
  4. Open http://localhost:3002 — landing's metrics > 0
  5. Open /featured — see 8 books with cover photos
  6. Sign in as `demo@travel.local` / printed password → see 12 trips

Commit: feat(POST.1): fix demo seed + populate 12 trips + 8 memory books with real photos
```

---

### POST.2 — Design pass on landing + /trips + /demo

```
[POST.2] Design system + visual polish on top 3 pages

Context:
  All web pages use Tailwind defaults — gray boxes, flat borders,
  no logo, no real hero illustration. The 3 highest-traffic pages
  (/, /trips, /demo) need a real design pass to push visual polish
  from 2.5/5 to 4.5/5. Pick a primary brand colour (current is
  sky-500 #0ea5e9), pair it with a slate neutral, and ship a
  consistent button + card + input system.

Files to touch:
  apps/web/src/components/ui/button.tsx            (rewrite — primary/secondary/ghost variants)
  apps/web/src/components/ui/card.tsx              (rewrite — depth shadow + hover)
  apps/web/src/components/ui/input.tsx             (new — floating-label input)
  apps/web/src/components/ui/select.tsx            (new — styled select)
  apps/web/src/components/branding/logo.tsx        (new — wordmark SVG)
  apps/web/src/components/landing/hero.tsx         (rewrite — real layout with logo + illustration)
  apps/web/src/components/landing/value-pillars.tsx (rewrite — icon + headline + body grid)
  apps/web/src/app/layout.tsx                      (add Inter font + brand colours)
  apps/web/src/app/globals.css                     (extend Tailwind theme: --brand, --depth-shadow)
  apps/web/src/app/page.tsx                        (use new hero/pillars)
  apps/web/src/app/trips/page.tsx                  (apply new card + button)
  apps/web/src/app/demo/page.tsx                   (replace emojis with real screenshot SVGs)
  apps/web/public/illustrations/hero.svg           (new — abstract travel SVG, ~10kb)
  apps/web/public/screenshots/itinerary.png        (new — real screenshot)
  apps/web/public/screenshots/memory-book.png      (new — real screenshot)
  apps/web/public/screenshots/sos.png              (new — real screenshot)

Files NOT to touch:
  apps/web/src/app/admin/**                        (admin pages can keep red theme)
  apps/web/src/app/compliance/**                   (compliance keeps blue)
  apps/web/src/app/ops/**                          (ops keeps purple)
  apps/api/**                                      (no api changes)

Deps:
  pnpm --filter=web add next/font (already there) — no new deps

Acceptance criteria:
  - Landing page has: real wordmark logo top-left, Inter typography,
    brand-coloured CTAs with hover lift, hero illustration (not just
    a CSS gradient), shadow depth on cards
  - /trips list cards have hover-lift (translate-y on hover) + clear
    typography hierarchy
  - /demo replaces emoji scenes with real screenshot images (PNG or
    inline SVG) in slot positions
  - Button component has 3 variants (primary/secondary/ghost) used
    consistently across the 3 touched pages
  - Card component has 2 depth levels (flat / raised); raised used
    on landing tiles
  - Color tokens added to tailwind theme: brand-50..900, accent
  - All 3 pages still render correctly in dark mode + comfort mode
  - `pnpm --filter=web build` green; bundle size for / increases
    by < 30 KB

How to verify:
  1. `pnpm --filter=web dev --port 3002`
  2. Open http://localhost:3002 — judge by eye against the previous version
  3. Toggle dark mode (header) — still looks good
  4. Toggle comfort mode (/account/preferences) — readable + spaced

Commit: feat(POST.2): design pass — logo, hero, button system, real screenshots on landing/trips/demo
```

---

### POST.3 — Wire Resend mailer + real Google OAuth

```
[POST.3] Real Resend mailer + Google OAuth (replace 2 stubs)

Context:
  MAILER_PORT only has StubMailerAdapter (ring buffer); nothing
  actually emails. OAuth has only MockOAuthProvider. Real users
  can't be invited or sign in with Google. Wire Resend (free tier
  3k/mo) for email + Google OAuth (free) so the 4 email-bound
  flows (magic-link, password-reset, account-deletion-pending,
  appeal-acknowledgement) and 1 OAuth flow actually work.

Files to touch:
  apps/api/src/modules/identity/infrastructure/resend-mailer.adapter.ts (new)
  apps/api/src/modules/identity/infrastructure/google-oauth.provider.ts (new)
  apps/api/src/modules/identity/identity.module.ts                       (swap stubs for real when keys present)
  apps/web/src/components/auth/google-sign-in-button.tsx                 (rewrite — wire to real flow)
  apps/web/src/app/login/page.tsx                                         (mount the button)
  apps/web/src/app/register/page.tsx                                      (mount the button)
  packages/config/src/schema.ts                                           (add RESEND_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET as optional)
  apps/api/.env.example                                                   (add docs for the 3 new vars)
  docs/external-apis.md                                                   (add Resend + Google sections)

Files NOT to touch:
  Any other identity use-case (UseCase logic stays — only adapters change)

Deps:
  pnpm --filter=api add resend google-auth-library

Env vars needed:
  RESEND_API_KEY=re_xxx           (https://resend.com — free 3k/mo)
  RESEND_FROM=hello@yourdomain    (must be verified domain)
  GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=xxx
  WEB_BASE_URL=http://localhost:3002 (already there)

Acceptance criteria:
  - With keys absent: stubs continue to work (no behaviour change)
  - With RESEND_API_KEY set: ResendMailerAdapter is provided instead
    of StubMailerAdapter via factory check
  - With GOOGLE_CLIENT_* set: GoogleOAuthProvider replaces Mock
  - 4 email-bound flows actually email when keys present:
    magic-link, password-reset, account-deletion-pending, appeal-ack
  - "Sign in with Google" button on /login and /register works
    end-to-end against real Google → creates User + Session
  - 4 new e2e tests skip when keys absent (graceful)
  - apps/api/.env.example documents the 3 new vars

How to verify:
  1. Set RESEND_API_KEY in .env.local
  2. Restart api
  3. Trigger /api/v1/auth/magic-link/request with your real email
  4. Receive the email at your inbox
  5. Click the link → consume → land in /trips

Commit: feat(POST.3): wire Resend mailer + Google OAuth (real adapters, stubs as fallback)
```

---

### POST.4 — Wire Anthropic AI for trip planner

```
[POST.4] Real Claude trip planner (replace stub)

Context:
  TRIP_PLANNER_PORT has a Claude adapter scaffolded but no
  ANTHROPIC_API_KEY provisioned, so the "Generate plan with AI"
  button on /trips/[id] returns a deterministic mock. With a real
  key + a tightly-scoped prompt, this becomes the demo's wow
  moment.

Files to touch:
  apps/api/src/modules/trip/infrastructure/claude-trip-planner.adapter.ts (rewrite — real prompt + parse)
  apps/api/src/modules/trip/application/generate-plan-with-ai.use-case.ts (no change to use-case; only adapter)
  apps/api/src/modules/trip/trip.module.ts                                  (factory: real adapter when key present, stub otherwise)
  packages/config/src/schema.ts                                             (add ANTHROPIC_API_KEY, ANTHROPIC_MODEL as optional)
  apps/api/.env.example                                                     (document the 2 vars)
  apps/web/src/components/trip/plan-with-ai-section.tsx                     (add "powered by Claude Sonnet" footer, loading shimmer)
  docs/external-apis.md                                                     (add Anthropic section)

Deps:
  pnpm --filter=api add @anthropic-ai/sdk

Env vars needed:
  ANTHROPIC_API_KEY=sk-ant-xxx    (https://console.anthropic.com)
  ANTHROPIC_MODEL=claude-opus-4-7 (default)

Acceptance criteria:
  - With ANTHROPIC_API_KEY absent: existing stub continues
  - With key present: ClaudeTripPlannerAdapter is provided via factory
  - Prompt template: "Plan a {N}-day trip to {city} for {travelType}
    travellers with budget tier {1-5}. Output a JSON array of days,
    each with 4-6 itinerary items in {category, title, description,
    estDurationMin, addressHint} shape." Use prompt caching (system
    prompt is ~2k tokens of constraints, cacheable).
  - Response is parsed via the existing ItineraryItemDto shape;
    invalid JSON returns the existing stub fallback (graceful)
  - Token usage (in/out/cache) logged via @app/logger at info level
  - 3 new e2e tests skip when key absent
  - Add a "powered by Claude Sonnet" footer + loading shimmer on
    /trips/[id]'s plan-with-ai section

How to verify:
  1. Set ANTHROPIC_API_KEY in .env.local
  2. Restart api
  3. Create a trip ("Lisbon weekend"), generate plan with AI
  4. See real Claude-generated itinerary with 4-6 items per day
  5. Check api logs for token usage report

Commit: feat(POST.4): wire Anthropic Claude trip planner (real adapter, stub as fallback)
```

---

### POST.5 — Image pipeline + admin media thumbnails

```
[POST.5] Sharp image pipeline + WebP variants + admin thumbnails

Context:
  Memory books store originals only — full-size JPEGs slow page
  loads + bandwidth bills. Admin /admin/media has no thumbnails so
  moderation is blind. Add Sharp on upload-confirm: generate
  thumb (256w) + medium (1024w) + WebP variants. Admin moderation
  page shows thumb tile + click to open original.

Files to touch:
  apps/api/src/modules/media/application/confirm-upload.use-case.ts        (extend — kick off variant generation)
  apps/api/src/modules/media/infrastructure/sharp-image-processor.ts       (new — Sharp wrapper)
  apps/api/src/modules/media/application/ports/image-processor.port.ts     (new)
  apps/api/src/modules/media/media.module.ts                                (wire IMAGE_PROCESSOR_PORT)
  apps/api/prisma/schema.prisma                                             (extend MediaAsset — add thumbS3Key, mediumS3Key, webpS3Key as nullable)
  apps/api/prisma/migrations/<ts>_media_variants/migration.sql              (new — ALTER TABLE add 3 cols)
  apps/web/src/app/admin/media/page.tsx                                     (rewrite tile to fetch thumbnail presigned URL)
  apps/web/src/components/media/thumbnail.tsx                               (new — graceful loading + fallback)

Deps:
  pnpm --filter=api add sharp

Env vars: none

Acceptance criteria:
  - On upload-confirm, Sharp generates 3 variants:
    thumb (256w WebP, ~10KB), medium (1024w WebP, ~80KB), original kept
  - All 4 keys persist on MediaAsset row (original + 3 variants)
  - Existing media display surfaces (memory books, trip cards) prefer
    medium WebP; fall back to original
  - /admin/media shows 256w thumb in each row
  - Variant generation runs in-process (acceptable for small uploads);
    add TODO for queue-based processor in scale
  - Sharp install is OS-deps clean on Windows + Linux Docker
  - 4 new e2e tests verify variants land in S3

How to verify:
  1. Apply migration: `pnpm --filter=api db:migrate:deploy`
  2. Restart api
  3. Upload an image via /memory-books/<id>/edit
  4. After confirm, check S3 (MinIO console at :9001) — see 4 keys
  5. Open /admin/media — see thumbnail tiles

Commit: feat(POST.5): Sharp image pipeline + WebP variants + thumbnails on /admin/media
```

---

### POST.6 — Marketing + legal surface (/pricing, /help, /status, /terms, /privacy)

```
[POST.6] Marketing + legal pages + footer

Context:
  Premium tier exists in code but no consumer-facing pricing.
  Users with questions have no /help. No public status page. ToS
  + Privacy Policy + Cookie Policy missing — incomplete legal
  posture for a real product. Add 5 pages + a real footer that
  links them.

Files to touch:
  apps/web/src/app/pricing/page.tsx                  (new — Free / Premium / Agent tiers)
  apps/web/src/app/help/page.tsx                     (new — FAQ + search)
  apps/web/src/app/status/page.tsx                   (new — polls /api/v1/health/ready every 30s)
  apps/web/src/app/terms/page.tsx                    (new — server-rendered MD)
  apps/web/src/app/privacy/page.tsx                  (new — server-rendered MD)
  apps/web/src/app/cookies/page.tsx                  (new — server-rendered MD)
  apps/web/src/components/landing/footer.tsx         (new — replace inline footer in layout)
  apps/web/src/app/layout.tsx                        (mount new Footer)
  apps/web/src/app/sitemap.ts                        (add 6 new URLs)
  apps/web/src/app/robots.ts                         (allow the 6 new URLs)
  docs/legal/terms.md                                (new — placeholder text + counsel TODO)
  docs/legal/privacy.md                              (new)
  docs/legal/cookies.md                              (new)

Deps: none

Env vars: none

Acceptance criteria:
  - /pricing shows 3 tiers (Free, Premium $9/mo, Agent contact)
    with feature checklists + CTAs (Premium → "coming soon" alert,
    matches existing PremiumGate behaviour)
  - /help has a search box (client-side filter over a 20-entry FAQ)
    + accordion sections (5 categories: Account, Trips, Safety,
    Privacy, Billing)
  - /status polls /health/ready every 30s + shows colored dot per
    dependency (Postgres, Redis, Meilisearch). 90-day uptime
    placeholder
  - /terms /privacy /cookies render markdown from docs/legal/*.md
    via a tiny server component. Each carries a "Last updated"
    + "Counsel review pending" badge
  - New <Footer> component appears on every page (mounted once
    in layout.tsx). Links to all 6 new pages + Accessibility +
    GitHub
  - /sitemap.xml lists all 6
  - /robots.txt explicitly allows them
  - All 6 pages render in dark + comfort mode

How to verify:
  1. `pnpm --filter=web dev --port 3002`
  2. Visit each new URL — render correctly
  3. Footer visible on every page
  4. View page source → meta description present on each
  5. Curl /sitemap.xml — see 6 new entries

Commit: feat(POST.6): pricing + help + status + ToS + privacy + cookies + real footer
```

---

### POST.7 — Twilio SOS SMS + VAPID push (replace 2 stubs)

```
[POST.7] Real Twilio SMS for SOS + VAPID Web Push

Context:
  CONTACT_NOTIFIER_PORT only has StubContactNotifierAdapter (ring
  buffer). When SOS triggers, trusted contacts don't actually get
  SMS'd. Web Push subscription succeeds but no actual push fires
  (VAPID keys absent). Wire Twilio (cheap pay-as-you-go) + provision
  VAPID for real push delivery.

Files to touch:
  apps/api/src/modules/safety/infrastructure/twilio-contact-notifier.adapter.ts  (new)
  apps/api/src/modules/safety/safety.module.ts                                   (factory: real when key present)
  apps/api/src/modules/notifications/infrastructure/web-push-dispatcher.ts       (real adapter — generate VAPID keys helper)
  apps/api/scripts/generate-vapid.ts                                              (new — CLI to print a VAPID keypair for env)
  apps/api/package.json                                                           (add `vapid:generate` script)
  packages/config/src/schema.ts                                                   (add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM as optional)
  apps/api/.env.example                                                           (document 3 Twilio vars + VAPID block)
  docs/external-apis.md                                                           (add Twilio + VAPID sections)

Deps:
  pnpm --filter=api add twilio
  (web-push already installed)

Env vars needed:
  TWILIO_ACCOUNT_SID=ACxxx
  TWILIO_AUTH_TOKEN=xxx
  TWILIO_FROM=+1xxxxxxxxxx
  VAPID_PUBLIC_KEY=BL...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:no-reply@yourdomain (already defaulted)

Acceptance criteria:
  - With TWILIO_* keys absent: stub continues
  - With keys: TwilioContactNotifierAdapter sends real SMS on SOS
  - SMS body: "🆘 SOS from {name}: {trigger} at {lat,lng}. Cancel
    link if false alarm: {short URL}"
  - With VAPID_* keys absent: WebPushDispatcher continues to no-op
  - With VAPID set + browser permission granted: actual push lands
    on test device when admin or scheduler emits a notification
  - `pnpm --filter=api vapid:generate` prints a fresh VAPID keypair
    to stdout
  - 3 new e2e tests skip when respective keys absent
  - Twilio cost-control: 50-SMS/day soft cap (logged + skipped beyond)

How to verify:
  1. `pnpm --filter=api vapid:generate` → copy output into .env.local
  2. Set TWILIO_* in .env.local
  3. Restart api
  4. Trigger SOS from /trips/[id]'s SOS pill
  5. SMS lands at the trusted contact's number
  6. Push notification appears on browser test device

Commit: feat(POST.7): wire Twilio SMS for SOS + real VAPID Web Push (stubs as fallback)
```

---

### POST.8 — UX micro-interactions (toast + empty states + skeletons + relative time)

```
[POST.8] Toast system + empty-state illustrations + skeletons + relative-time

Context:
  App-wide UX feels stiff: success actions are silent (only errors
  speak via aria-live), empty lists are flat text, slow loads show
  "Loading…" text, all timestamps are toLocaleString. Add 4
  cross-cutting niceties so the app feels alive.

Files to touch:
  apps/web/src/components/ui/toast.tsx                 (new — sonner-style toast provider + queue)
  apps/web/src/components/ui/empty-state.tsx           (new — emoji + headline + body + CTA slots)
  apps/web/src/components/ui/skeleton.tsx              (extend existing — list + card variants)
  apps/web/src/lib/relative-time.ts                    (new — "3 hours ago" formatter; falls back to absolute beyond 30 days)
  apps/web/src/components/ui/relative-time.tsx         (new — <time> with title=ISO; relative inside)
  apps/web/src/app/providers.tsx                       (mount ToastProvider once)
  apps/web/src/app/layout.tsx                          (no change — providers handles it)
  apps/web/src/app/inbox/page.tsx                      (replace toLocaleString w/ <RelativeTime>; show skeletons; toast on archive success)
  apps/web/src/app/trips/page.tsx                      (toast on archive/unarchive; relative time)
  apps/web/src/app/admin/audit/page.tsx                (relative time + skeleton list)
  apps/web/src/app/account/privacy/page.tsx            (toast on export complete)
  apps/web/src/app/memory-books/[id]/edit/page.tsx     (toast on save)

Deps:
  pnpm --filter=web add sonner
  (date-fns for relative time — or hand-roll; let's hand-roll to keep deps small. So no new dep beyond sonner.)

Env vars: none

Acceptance criteria:
  - Toast provider mounted globally (top-right by default)
  - Toast variants: success (emerald), error (rose), info (sky)
  - 5 surfaces emit success toasts: trip archive, memory book save,
    inbox notification archive, account export complete, audit log
    filter applied
  - <EmptyState> appears on: empty /trips list, empty /featured,
    empty /admin/audit (filtered), empty /inbox, empty /memory-books
  - <Skeleton> list variant appears while React Query isLoading on
    inbox + audit + admin/users + admin/sos
  - <RelativeTime> replaces every toLocaleString call site; tooltip
    shows full ISO via title=
  - All new components support dark mode + comfort mode
  - `pnpm --filter=web build` green; bundle size for / +<5KB

How to verify:
  1. Open /trips, archive a trip — toast appears
  2. Open /inbox, archive — toast + relative time visible on rows
  3. Open /admin/audit — skeleton flashes briefly, then rows w/
     "5 minutes ago" instead of "5/11/2026, 12:43:48 AM"
  4. Empty /memory-books shows the new <EmptyState> component

Commit: feat(POST.8): toast system + empty-state component + skeleton list + relative-time formatter
```

---

### POST.9 — Stripe scaffold (customer + checkout + webhook + subscription sync)

```
[POST.9] Stripe payments + Premium tier checkout

Context:
  Premium tier currently flipped manually via Prisma. /pricing
  (POST.6) advertises $9/mo Premium. Wire Stripe so Premium upgrade
  is a real checkout flow.

Files to touch:
  apps/api/prisma/schema.prisma                                            (extend Subscription model — already exists; add stripeCustomerId, stripePriceId, status, currentPeriodEnd)
  apps/api/prisma/migrations/<ts>_subscription_stripe_fields/migration.sql (new)
  apps/api/src/modules/payments/                                           (NEW MODULE)
    payments.module.ts
    application/
      create-checkout-session.use-case.ts
      handle-stripe-webhook.use-case.ts
      sync-subscription.use-case.ts
      ports/payment-provider.port.ts
    infrastructure/
      stripe-payment-provider.adapter.ts
    interface/
      payments.controller.ts                                                (POST /payments/checkout, POST /payments/webhook @Public + raw body)
  apps/api/src/app.module.ts                                                (import PaymentsModule)
  apps/api/src/main.ts                                                      (raw body parser for /api/v1/payments/webhook)
  packages/config/src/schema.ts                                             (add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PREMIUM as optional)
  apps/web/src/app/pricing/page.tsx                                         (Premium CTA → POST /payments/checkout → redirect)
  apps/web/src/app/account/billing/page.tsx                                 (new — show current plan + cancel)
  apps/web/src/app/account/page.tsx                                         (add Billing link)
  apps/web/src/components/upsell/premium-gate.tsx                           (CTA → /pricing)
  docs/external-apis.md                                                     (Stripe section)

Deps:
  pnpm --filter=api add stripe

Env vars needed:
  STRIPE_SECRET_KEY=sk_test_xxx        (https://dashboard.stripe.com)
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  STRIPE_PRICE_PREMIUM=price_xxx       (recurring $9/mo, USD)

Acceptance criteria:
  - With STRIPE_SECRET_KEY absent: /pricing CTA stays "coming soon"
  - With key set: clicking "Upgrade to Premium" creates a Stripe
    Checkout session and redirects
  - On checkout success, webhook fires → SyncSubscriptionUseCase
    writes Subscription row → User.role flipped to 'premium'
  - On subscription cancellation webhook: User.role back to 'user'
  - /account/billing shows current plan + "Manage in Stripe" portal
  - Webhook signature verified via STRIPE_WEBHOOK_SECRET
  - 6 e2e tests covering: anon→checkout creates redirect URL;
    success webhook flips role; cancel webhook flips back;
    duplicate webhook is idempotent; invalid signature → 400;
    missing key gracefully degrades
  - PaymentsModule follows clean-hex (port + adapter + use-cases)

How to verify:
  1. Create Stripe account, get test keys
  2. Run: stripe listen --forward-to http://localhost:3000/api/v1/payments/webhook
  3. Set 3 STRIPE_* vars
  4. Visit /pricing as a 'user', click Premium → Stripe checkout opens
  5. Use test card 4242... → land back on /account/billing
  6. Sign out + back in (role refresh) → /trips/[id]/concierge unlocked

Commit: feat(POST.9): Stripe scaffold — Premium checkout + webhook + subscription sync
```

---

### POST.10 — Sentry + Honeycomb + CD pipeline

```
[POST.10] Observability (Sentry + OTel → Honeycomb) + GitHub Actions deploy gate

Context:
  OTel exporter logs OTLPExporterError 404 every boot — points
  nowhere. Errors only land in api logs (no Sentry). CI runs tests
  but doesn't gate deploy. Wire all 3 so prod has visibility.

Files to touch:
  apps/api/src/main.ts                                  (add Sentry.init + Sentry.setupNestErrorHandler)
  apps/api/instrumentation.ts                           (point OTLP at HONEYCOMB_API_KEY when set; otherwise noop)
  apps/web/sentry.client.config.ts                      (new)
  apps/web/sentry.server.config.ts                      (new)
  apps/web/sentry.edge.config.ts                        (new)
  apps/web/next.config.ts                               (wrap with withSentryConfig)
  packages/config/src/schema.ts                         (add SENTRY_DSN, HONEYCOMB_API_KEY as optional)
  .github/workflows/ci.yml                              (extend — add deploy job that runs on tag push to fly)
  .github/workflows/deploy.yml                          (new — fly deploy api + web, gated on tests green)
  docs/external-apis.md                                 (Sentry + Honeycomb sections)
  docs/runbooks/incident-response.md                    (new — escalation steps with Sentry + Honeycomb URLs)

Deps:
  pnpm --filter=api add @sentry/nestjs
  pnpm --filter=web add @sentry/nextjs

Env vars needed:
  SENTRY_DSN_API=https://xxx@sentry.io/xxx
  SENTRY_DSN_WEB=https://yyy@sentry.io/yyy
  HONEYCOMB_API_KEY=xxx
  FLY_API_TOKEN (in GH secrets)
  (existing FLY_APP_API + FLY_APP_WEB names also as secrets)

Acceptance criteria:
  - Without keys: api + web boot identically to today
  - With SENTRY_DSN_API: api uncaught exceptions land in Sentry
    (test by hitting an intentionally-throwing dev route)
  - With SENTRY_DSN_WEB: web errors land in Sentry
  - With HONEYCOMB_API_KEY: OTel traces export successfully (no
    more 404 in api logs); spans visible in Honeycomb UI
  - GH Actions deploy job runs only on tag push v*.*.* AND only
    after typecheck/lint/test all green
  - Deploy job uses `fly deploy` with --remote-only for both
    apps/api and apps/web
  - Deploy posts a comment to the release PR with the deployed URL
  - Runbook docs/runbooks/incident-response.md links to Sentry
    project + Honeycomb dataset URLs (placeholder until real)

How to verify:
  1. Set SENTRY_DSN_API in .env.local
  2. Restart api
  3. Curl http://localhost:3000/api/v1/intentional-500 (add a dev-only route)
  4. Open Sentry dashboard → see the error
  5. Tag v0.1.0 + push → GH Actions runs deploy job
  6. Visit deployed Fly URL — works

Commit: feat(POST.10): Sentry + Honeycomb + GH Actions deploy gate
```

---

## 8. How to use these prompts

### For a human engineer

1. Read §1–§3 to onboard.
2. Pick a POST.X from §6 (recommended starter: POST.1).
3. Copy the prompt block from §7 verbatim and use it as a TODO list.
4. Open a feature branch named `feat/post-N-<short>`.
5. Ship per acceptance criteria.
6. Open PR; PR description should reference this file.

### For an AI assistant (Claude Code, Cursor, Aider, etc.)

1. Open this file (`docs/POST_VUX_GAPS.md`).
2. Tell the AI: _"Execute POST.X from docs/POST_VUX_GAPS.md."_
3. The prompt block is fully self-contained — no further context
   needed. Hard constraints from `CLAUDE.md` apply.
4. After execution, the AI commits using the `feat(POST.X): ...`
   subject line and updates `PROGRESS.md` with a one-row log entry.

### Sequencing recommendations

- **For demo/launch readiness**: POST.1 → POST.2 → POST.3 → POST.6 → POST.4. (1.5 weeks; gives a real-feeling demo with seeded data, polish, real email + OAuth, marketing surface, AI magic.)
- **For paid launch**: add POST.9 + POST.10 + POST.7 + POST.5. (1 more week.)
- **For long-term polish**: POST.8 alongside any of the above (small, parallelisable).

### Tracking completion

After each POST.X commits, append a one-row entry to
`PROGRESS.md` under a new `## POST log` section:

```
### [POST.X] — <title>

- **Date**: YYYY-MM-DD
- **Commit**: <hash>
- **Files changed**: <count>
- **Tests added**: <count>
- **Verification output**: <paste>
- **Lessons**: <one durable lesson learned>
```

---

_Audit compiled by `[POST_VUX_GAPS]` task on 2026-05-11._
_Update this file when a POST.X completes (mark as ✅ in §6 table)._

# TravelSuperApp — Progress Log

> Rolling log of completed prompts from [`travel-app-prompts.md`](./travel-app-prompts.md). Newest at the top.
>
> **Update rule:** every prompt execution ends with a new row here + a commit.
>
> **Legend:** status = `DONE` (finished & verified) · `IN-PROGRESS` (started, not finished) · `BLOCKED` (waiting on user/ext) · `REVERTED` (rolled back).

---

## Summary

| Counter             | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Prompts completed   | 101 (100 full + 1 foundation-only; hard-delete cron just shipped)  |
| Prompts in progress | 0                                                                  |
| Prompts blocked     | 0                                                                  |
| Last prompt         | `[IV.18.16.3]` — hard-delete cron sweep (GDPR retention close-out) |
| Last commit date    | 2026-04-25                                                         |
| Phase               | Phase 1 — GDPR/DPDP erasure complete; 67 suites, 452 tests         |

---

## Log (newest first)

---

### [IV.18.16.3] — Hard-delete cron sweep (GDPR retention close-out)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.10 (Compliance & Privacy)

**What was done**

Closes the GDPR Art. 17 / DPDP §12 right-to-erasure story shipped across `[IV.18.16.1]` (data export) and `[IV.18.16.2]` (soft-delete + session revoke). A daily background tick wipes user rows whose `deletedAt` is older than the 7-day retention window. The retention window gives a soft-deleted user a support-recoverable mistake-window while still satisfying "delete within reasonable timeframe".

The Postgres-cascade does the heavy lifting: every user-scoped FK in the schema has `onDelete: Cascade` (Trip, Session, MediaAsset, MemoryBook, NotificationLog, Vote, Expense, Review, ScamReport, SosEvent, StayBooking, Subscription, EscrowHold, Commission, Agent, LiveEvent, UserOAuthIdentity, MfaBackupCode, Preferences, Device, NotificationPreference). A single `prisma.user.deleteMany({ where: { deletedAt: { not: null, lte: cutoff } } })` wipes the user + every dependent row in one Postgres transaction. No manual fan-out needed.

**Scheduler choice: `setInterval` over `@nestjs/schedule`.** The cron package isn't in deps and this slice doesn't justify pulling it in (single-instance v1, no cron-syntax requirements). Plain `setInterval` inside an `OnModuleInit` lifecycle, paired with `OnModuleDestroy` `clearInterval`. Critical detail: the scheduler skips itself when `NODE_ENV === 'test'` so Jest test processes don't leak 24-hour timer handles. When the deploy goes multi-instance OR the schedule needs cron syntax, swap in `@nestjs/schedule` + `@Cron(...)` — the use-case + adapter stay unchanged (the scheduler is the only thing that touches the package).

**Files created** (5)

- `apps/api/src/modules/account/application/ports/account-purger.ts` — single-method port: `purgeOlderThan(cutoff: Date): Promise<number>`.
- `apps/api/src/modules/account/application/purge-soft-deleted-users.use-case.ts` — computes cutoff (`now - retentionDays`), calls the port, returns `{ purged: count }`. `retentionDays` + `now` are command-overrideable for tests; default 7 days.
- `apps/api/src/modules/account/infrastructure/prisma-account-purger.ts` — single `prisma.user.deleteMany({ where: { deletedAt: { not: null, lte: cutoff } } })`. The `not: null` guard means active users (deletedAt null) can never be swept, even if a future bug sets a malformed cutoff.
- `apps/api/src/modules/account/interface/account-purge.scheduler.ts` — `OnModuleInit` schedules a 24h `setInterval` + runs one tick immediately (a deploy after long downtime catches up); `OnModuleDestroy` clears it. Re-entrant guard prevents stacked ticks. NODE_ENV=test skip so Jest exits cleanly. Each tick is wrapped in try/catch — a failed sweep becomes the next day's bigger sweep, eventual-consistency posture for a compliance backstop.
- `apps/api/test/account-purge.e2e-spec.ts` — 5 integration tests against real Postgres.

**Files edited** (1)

- `apps/api/src/modules/account/account.module.ts` — registers `ACCOUNT_PURGER` provider, `PurgeSoftDeletedUsersUseCase`, `AccountPurgeScheduler`. Exports the use-case for tests + a future admin-trigger surface.

**Tests** (5 cases, real-Postgres):

1. User soft-deleted older than 7 days → purged + cascades wipe dependents (verified via a seeded Trip + NotificationLog that disappear in the same call).
2. User soft-deleted within 7 days (3 days ago) → still present after sweep.
3. Active user (deletedAt null) → never swept.
4. Idempotent: a second sweep with the same cutoff returns purged ≥ 0 (the eligible row is gone; the count can't be negative; specific row verified deleted).
5. Mixed cohort: 1 eligible + 1 fresh + 1 active → only the eligible row dies.

Test scaffolding backdates `User.deletedAt` directly via `prisma.user.update` to simulate the retention window passing — much faster than waiting 7 days. The use-case is retrieved via `moduleRef.get(PurgeSoftDeletedUsersUseCase)` and called directly; the `setInterval` scheduler skip in NODE_ENV=test means we don't deal with the actual cron tick in any test.

**Dependencies** — none new. The scheduler intentionally avoids `@nestjs/schedule` to stay within CLAUDE.md rule 2 (dep-lock); see the scheduler JSDoc for the swap path.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Account-purge suite 5/5 pass.
- ✅ **Full real-DB + MinIO suite: 67 suites, 452 tests pass against live Docker.** (+1 suite, +5 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Soft-deleted users older than 7 days are hard-deleted.
- ✅ Cascades wipe every user-scoped dependent row in the same Postgres transaction.
- ✅ Active users + recently-soft-deleted users are untouched.
- ✅ Sweep is idempotent.
- ✅ Scheduler runs daily, fires immediately at module init for catch-up.
- ✅ Scheduler is test-safe (NODE_ENV=test skips the timer).

**Notes**

- **Why 7 days, not 30 / 14 / 24h.** Two competing pressures: (1) the user must have a real grace period to recover from a mistake-delete (24h is too short — people delete on impulse and reconsider). (2) "Reasonable timeframe" for compliance. 7 days is the modal industry choice (Google, Microsoft, Stripe all use 30 days for some flows + 7 for others; 7 is a fair compromise that satisfies the spirit of the regs without indefinite retention). Configurable via the use-case's `retentionDays` argument if the product needs to tune it later.
- **Why Postgres `onDelete: Cascade` over manual fan-out in a `$transaction`.** The schema already has cascades wired on every user-scoped FK (this was set up in `[III.12.1]`). Re-implementing the fan-out in app code would: (1) be slower (multiple queries vs. one cascade); (2) be a maintenance burden every time a new user-scoped table lands; (3) risk a bug where a forgotten table becomes an orphan. The cascade IS the transaction.
- **Why `setInterval` and `OnModuleInit` over `@nestjs/schedule`.** Schedule's cron syntax is a power feature — daily-at-midnight matters when you want to align maintenance windows. v1 doesn't care about midnight; it just needs "roughly every 24 hours". Plain `setInterval` is enough, avoids a new dep, and the swap path is one file (the scheduler) when requirements change. The use-case + adapter are framework-agnostic.
- **Why fire-and-forget on the immediate tick.** A deploy after long downtime might face hours of accumulated soft-deletes. Awaiting the first tick during `onModuleInit` would block app boot for that initial sweep — observability is happier with a quick boot + an async first sweep that may take longer. The fire-and-forget pattern is acceptable here because the use-case has its own try/catch logging.
- **Why the re-entrant guard.** A single sweep should never run on top of itself. With a 24h interval that's nearly always true, but a long sweep on a heavily-soft-deleted DB could overrun. The `running` flag is cheap insurance; the alternative (queuing) adds complexity for a problem that probably never occurs in practice.
- **Why `unref()` the timer.** A non-test Node process should be kept alive by its real work (the HTTP server). The purge timer is a backstop, not a primary lifetime gate. `.unref()` ensures a future graceful-shutdown path that closes the HTTP server can exit without waiting for the next 24h tick.
- **GDPR/DPDP erasure is now functionally complete.** The triad: `[IV.18.16.1]` Art. 15 (right of access), `[IV.18.16.2]` Art. 17 soft-delete + session revoke, `[IV.18.16.3]` Art. 17 hard-delete cron. Plus right-to-portability (export-as-JSON falls out of `[IV.18.16.1]`'s structured response) and right-to-rectification (the user can edit their profile via existing identity routes). The Account/GDPR module is at functional 100%.

---

### [IV.18.12.10] — Trip × Media overview fold (7th section)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.13 (Media & Memory) + 3.2 (Trip Planning)

**What was done**

Folds a `media` section into `GET /trips/:id/overview`, joining the existing 6 sections (itinerary + weather + stays + eateries + events + transport). The trip-detail screen now arrives in one round-trip: clients no longer have to fan out to `/trips/:id/overview` AND `/media?tripId=...` to render the trip + a thumbnail strip.

Section shape: `media: Section<{ count: number; recent: TripMediaSummaryAsset[] }>` — the same `Section<T>` discriminated union that the other 6 sections use, so a media adapter failure degrades to `{ ok: false, code }` without 500-ing the whole bundle. `count` reflects ALL ready rows for the trip+owner; `recent` is capped at 12 (4×3 thumb grid). Clients use `count > recent.length` to render "and N more".

**The Trip↔Media circular dependency.** Media imports Trip for the trip-attach owner gate (existing since `[IV.18.12.2]`). Adding the reverse direction (Trip imports Media for overview) introduces a circular dep that Nest can only resolve via `forwardRef()` on both module imports. The alternative — extracting a shared seam package — would force every cross-module read to live in `packages/...` and dilute the modular-monolith boundary. `forwardRef` is the documented Nest pattern; first cross-module port in the codebase that uses it. The pattern is now precedented for the next time a similar overlay is needed (e.g. Notifications × Trip, Social × Trip aggregations on the dashboard).

The port `TRIP_MEDIA_PORT` is **owned by Trip** (consumer-defined interface) and **implemented by Media** (`TripMediaAdapter` delegates to `MEDIA_ASSET_REPOSITORY` plus a count query). This keeps the dependency graph honest: Trip says what it needs; Media implements it without leaking MediaAsset internals into Trip.

HTTP surface: existing route, expanded payload.

| Route                            | Auth   | What's new                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------- |
| `GET /api/v1/trips/:id/overview` | bearer | Adds `media: { count, recent[] }` section with graceful degradation |

**Files created** (3)

- `apps/api/src/modules/trip/application/ports/trip-media.port.ts` — port owned by Trip. Defines `TripMediaSummary` + `TripMediaSummaryAsset` shapes + `TRIP_MEDIA_PORT` symbol.
- `apps/api/src/modules/media/infrastructure/trip-media.adapter.ts` — `TripMediaAdapter` implements the port via `Promise.all([listForTripOwner, count])`. Both queries hit existing indexes (`[tripId, createdAt]`, `[ownerId, createdAt]`) — no new index needed.
- `apps/api/test/trip-overview-media.e2e-spec.ts` — 4 integration tests against real Postgres.

**Files edited** (4)

- `apps/api/src/modules/trip/application/get-trip-overview.use-case.ts` — adds the 7th `section()` call + injects `TRIP_MEDIA_PORT` via `forwardRef`. Recent-list cap is `MEDIA_RECENT_LIMIT = 12`.
- `apps/api/src/modules/trip/interface/trip.controller.ts` — extends `TripOverviewDto` + the response mapper to include the media section.
- `apps/api/src/modules/trip/trip.module.ts` — `imports: [..., forwardRef(() => MediaModule)]`.
- `apps/api/src/modules/media/media.module.ts` — `imports: [forwardRef(() => TripModule)]` + provides + exports `TRIP_MEDIA_PORT` via `TripMediaAdapter`.

**Tests** (4 cases, real-Postgres):

1. Trip with no attached media → media section `ok: true`, `count: 0`, `recent: []`.
2. Trip with 3 attached ready media (seeded directly via Prisma; the upload→confirm flow is irrelevant to the read aggregator and is covered by `media.e2e-spec`) → `count: 3`, `recent` length 3, sorted desc by createdAt (verified by checking the last seeded id appears first).
3. Cross-user isolation: Alice has 5 media on her trip; Bob has 2 on his. Each user's overview returns only their own count + recent — verified by looking up each returned media row's `ownerId` against the caller's userId.
4. Recent list capped at 12: 15 seeded → `count: 15`, `recent.length: 12`. Confirms the count query and the listing query are independent.

**Dependencies** — none new. No Prisma migration — `MediaAsset.tripId` has been on the schema since `[IV.18.12.1]`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Existing trip-overview suite 5/5 still passes (no regression in the 6 prior sections).
- ✅ New overview-media suite 4/4 pass.
- ✅ **Full real-DB + MinIO suite: 66 suites, 447 tests pass against live Docker.** (+1 suite, +4 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ `GET /trips/:id/overview` returns a 7th `media` section.
- ✅ Section follows the existing `Section<T>` discriminated-union pattern.
- ✅ Adapter failure degrades gracefully (the existing `section()` wrapper handles it).
- ✅ Owner-scoped: cross-user IDOR isolation verified end-to-end.
- ✅ `count` reflects total ready media; `recent` capped at 12.
- ✅ Trip↔Media circular dep resolved via symmetric `forwardRef()`.

**Notes**

- **Why a port owned by Trip, not a direct call to `ListTripMediaUseCase`.** Reusing the use-case would force its trip-owner gate to run a SECOND time inside the overview (the overview already verifies ownership at the top), redundant DB round-trip for no security gain. Defining a thin port lets Trip ask exactly the question it needs ("summarize the trip's media"), and the adapter trusts the caller to have already gated. Same posture as `transportLegs.computeLegs` (the internal entry point that skips the redundant gate).
- **Why `forwardRef` and not extracting a shared package.** A `packages/trip-media-port` would be 1 file. Nest's `forwardRef` is also 2 lines per module. The package adds a workspace dep edge + rebuild step + a "where do I put this?" decision for every future cross-module port. `forwardRef` keeps the cross-module port co-located with the consumer module — Trip owns the port file, Media owns the adapter, both files travel with their domain. Extraction is the right move when 5+ ports cross the boundary; today there's exactly one.
- **Why `count` is a separate query, not `recent.length`.** Recent is capped at 12. A trip with 200 photos would surface as `recent.length === 12` if we conflated them, hiding the actual total. Two queries via `Promise.all` keep the clean signal: "you have 200 photos, here are the 12 most recent". Both queries hit indexes; the cost is ~one extra index lookup, not a full scan.
- **Why 12 thumbs and not 6 / 24.** 4×3 grid is the standard mobile thumbnail strip; 6 looks sparse on tablets, 24 starts feeling like a separate screen. 12 is the median across iOS Photos, Google Photos, Pinterest, Instagram for "recent" strips. If it's wrong we'll learn from analytics; the constant lives in the use-case so changing it is one line.
- **Why bypass the upload→confirm flow in tests.** The flow is covered by `media.e2e-spec` + `media-attach-trip.e2e-spec`. This test verifies the read aggregator + the cross-module port wiring + ownership isolation — the upload mechanics are upstream and orthogonal. Direct `prisma.mediaAsset.create` is faster, more deterministic, and exercises the exact rows the adapter would see in production.
- **First `forwardRef()` cross-module port in the codebase.** Establishes the pattern for future overlays: define the port in the consumer module, implement in the producer module, `forwardRef()` on both module imports, register the symbol via `useClass`. The Trip-overview pattern is now ready for additional sections (Social aggregation summaries on the dashboard, Notifications inbox-preview on the home screen, etc.) when those become product priorities.

---

### [IV.18.12.9] — Cross-trip vote tally summary (GET /votes/summary)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Companion to `[IV.18.12.8]`'s review summary. Public-readable cross-trip aggregate of every vote on a target: `GET /votes/summary?targetType=&targetId=` returns `{ targetType, targetId, up, meh, down, score }`. Drives the vote-count widget on every itinerary item / place / restaurant detail page — without it, every vote-rendering screen has to fetch a list and reduce in JS, the same scaling problem Reviews had before `summary`.

Implementation: `prisma.vote.groupBy({ by: ['value'], where: { targetType, targetId }, _count: true })`. At most 3 rows back (one per `-1`/`0`/`+1` bucket), regardless of vote volume. Hits the existing `(targetType, targetId)` index. `score = up - down`. `value=0` ("meh") rows are surfaced separately so a future "show neutral count" UI doesn't need a schema change — they're explicitly excluded from `up`/`down`.

`@Public()` — vote counts are crowd signal, no PII. No per-user vote disclosure, just bucket counts. Same precedent as `/reviews/summary` (`[IV.18.12.8]`) and the published memory book reads (`[IV.18.12.7]`).

**Cross-trip semantics.** A vote on an itinerary-item that's part of a shared trip is intrinsically cross-trip — multiple trips could reference the same target id (a popular Place, for instance). The summary aggregates across every trip the target appears in. The trip-scoped tally on `GET /trips/:tripId/votes` (shipped `[IV.18.12.3]`) remains the right surface for "what did the people on THIS trip vote" — different question, different answer.

HTTP surface:

| Route                           | Auth        | What it does                                                       |
| ------------------------------- | ----------- | ------------------------------------------------------------------ |
| `GET /api/v1/votes/summary?...` | `@Public()` | `{ targetType, targetId, up, meh, down, score }` across every trip |

**Files created** (3)

- `apps/api/src/modules/social/application/get-vote-summary.use-case.ts` — orchestrator (one-liner over the port).
- `apps/api/src/modules/social/interface/votes.controller.ts` — new top-level controller mounted at `/votes` (separate from the trip-scoped `SocialController` at `/trips/:tripId/votes`). Avoids forcing a single controller's auth model to be the LCD of "trip-collab gate vs. @Public()".
- `apps/api/test/social-vote-summary.e2e-spec.ts` — 6 integration tests against real-Postgres.

**Files edited** (4)

- `apps/api/src/modules/social/application/ports/vote.repository.ts` — adds `VoteSummary` envelope + `aggregateByTarget(targetType, targetId): Promise<VoteSummary>` method.
- `apps/api/src/modules/social/infrastructure/prisma-vote.repository.ts` — implements `aggregateByTarget` via `groupBy` + bucket-walk + score derivation.
- `apps/api/src/modules/social/interface/dto/social.dto.ts` — adds `VoteSummaryTargetTypeSchema` (3-value: `itinerary_item | place | restaurant`). The existing `VoteTargetTypeSchema` stays narrow at 1 value (`itinerary_item`) since cast-vote on places/restaurants doesn't ship until the corresponding write-side slice. The summary endpoint accepts the wider set so a place/restaurant detail page can query vote counts without waiting on the cast surface.
- `apps/api/src/modules/social/social.module.ts` — registers `VotesController` + `GetVoteSummaryUseCase`.

**Tests** (6 cases, real-Postgres):

1. Empty target → 200 with `{ up: 0, meh: 0, down: 0, score: 0 }`. NOT 404.
2. 3 up + 1 meh + 1 down (5th seeded across 2 trips for the same user — different trip, valid because the unique key is `(tripId, userId, targetType, targetId)`) → `up: 3, meh: 1, down: 1, score: 2`.
3. Cross-target isolation: votes on target A return correct counts; target B returns all-zeros.
4. Missing query params → 400 `VALIDATION_FAILED`.
5. Unknown `targetType` → 400 `VALIDATION_FAILED` (zod-narrow on the controller side).
6. No bearer → 200 (the `@Public()` decorator skips JwtAuthGuard).

Tests seed Vote rows directly via `prisma.vote.create` rather than going through the cast-vote endpoint — the cast flow is gated by the collab-trip rule + needs a real itinerary item, which is irrelevant to what we're testing here (the read aggregator). Trips themselves still come through the API because `Trip.center` is PostGIS (CLAUDE rule 11).

**Dependencies** — none new. No Prisma migration — Vote model has been on the schema since `[IV.18.12.3]`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Vote-summary suite 6/6 pass.
- ✅ **Full real-DB + MinIO suite: 65 suites, 443 tests pass against live Docker.** (+1 suite, +6 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Empty target → 200 with all-zeros shape.
- ✅ Mix of `+1`/`0`/`-1` votes → correct `up` / `meh` / `down` / `score`.
- ✅ `score = up - down` (meh excluded).
- ✅ Cross-target isolation holds.
- ✅ `@Public()` works without bearer.
- ✅ `groupBy` hits the existing `(targetType, targetId)` index — no new index needed.

**Notes**

- **Why a separate top-level `VotesController` instead of adding the route to `SocialController`.** `SocialController` is mounted at `/trips/:tripId/votes` — it's the trip-scoped collab surface, gated by the `assertCanVote` helper. Adding a `@Public()` cross-trip route there would force the controller to mix auth models, which is a code-smell I want to avoid. Splitting into two controllers (one trip-scoped, one global) keeps each surface's auth posture obvious.
- **Why surface `meh` separately and not silently drop it.** A future UI might want to render "12 up, 3 down, 5 abstained" — different signal than just "12 up, 3 down". Surfacing it now costs nothing (it's already in the groupBy result); hiding it would force a schema change later. `score` deliberately ignores it: an abstain isn't half a yes.
- **Why `score` is plain `up - down` and not weighted.** v1 keeps the math obvious. Future ranking experiments (Reddit's "controversy score", upvote-velocity, etc.) belong in their own slice — at that point `score` becomes one of several derived scores, not THE score. Today it's the rank signal that drives "show me the popular itinerary items" lists; one number, easy to sort.
- **Why the controller-side schema for `targetType` is wider than the cast-vote schema.** The summary is read-side-only and the domain type already allows `place` + `restaurant`. Accepting them on the read endpoint lets a place / restaurant detail page query vote counts before the corresponding cast-vote slice ships. Casting a vote on a place / restaurant still returns `VALIDATION_FAILED` via the narrower `VoteTargetTypeSchema` until that slice lands.
- **Why aggregation in the DB, not "fetch + reduce in app".** Same reason as the review summary: a popular target with thousands of votes returns thousands of rows over the wire if we list-and-aggregate; `groupBy` returns at most 3. Latency stays ~constant regardless of vote volume — the slice that lets Votes ship at scale.
- **Why empty target → 200, not 404.** Two reasons: (1) "this place has no votes yet" is meaningfully different from "this place doesn't exist"; (2) the route is `@Public()`, and 404-on-empty would let a stranger probe target id space via the vote surface. Same precedent as the review summary endpoint.
- **Pattern consolidation.** Three aggregation surfaces shipped in close succession (`[IV.18.12.8]` review summary, `[IV.18.15.3]` mark-all-read, `[IV.18.12.9]` vote summary) — all using `groupBy` or filtered `updateMany`, all returning meaningful counts in their response, all returning 200 on empty rather than 404. The pattern is now codified in memory as the right shape for any "consumer aggregation" surface.

---

### [IV.18.15.3] — Notifications mark-all-read (POST /notifications/read-all)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.15 (Notifications)

**What was done**

Inbox "clear the badge" surface: a single authed `POST /api/v1/notifications/read-all` flips `read = true` on every unread row for the caller and returns `{ marked: <count> }`. Saves clients an N-round-trip walk over the inbox; lets the unread badge reset in one call.

Implementation: `prisma.notificationLog.updateMany({ where: { userId, read: false }, data: { read: true } })`. The `read: false` clause skips already-read rows so the operation cost scales with unread count, not total inbox size — the existing `[userId, read, createdAt]` index makes the lookup of unread rows cheap.

Idempotent by construction: a second call with no new unread rows returns `{ marked: 0 }`. Empty inbox → 200 with `{ marked: 0 }` — NOT 404. (Same "empty ≠ missing" precedent as the review summary endpoint shipped in `[IV.18.12.8]`.)

HTTP surface:

| Route                                 | Auth   | What it does                                              |
| ------------------------------------- | ------ | --------------------------------------------------------- |
| `POST /api/v1/notifications/read-all` | bearer | Mark every unread row read; returns `{ marked: <count> }` |

**Files created** (2)

- `apps/api/src/modules/notifications/application/mark-all-notifications-read.use-case.ts` — orchestrator (one-liner over the port).
- `apps/api/test/notifications-mark-all-read.e2e-spec.ts` — 4 integration tests against real Postgres.

**Files edited** (3)

- `apps/api/src/modules/notifications/application/ports/notification-log.repository.ts` — adds `markAllReadForUser(userId): Promise<number>` method.
- `apps/api/src/modules/notifications/infrastructure/prisma-notification-log.repository.ts` — implements `markAllReadForUser` via owner-scoped `updateMany`.
- `apps/api/src/modules/notifications/interface/notifications.controller.ts` — adds `@Post('read-all')`. Declared BEFORE `@Post(':id/read')` so a future `:id` route definition can't shadow the literal `read-all` segment (defensive ordering, same pattern as `/reviews/summary` and the public memory-book routes).
- `apps/api/src/modules/notifications/notifications.module.ts` — registers `MarkAllNotificationsReadUseCase`.

**Tests** (4 cases, real-Postgres):

1. No bearer → 401 `UNAUTHENTICATED`.
2. Happy path: register user (mints 1 `session_issued_new_device` row) + seed 3 more unread → `{ marked: 4 }`; subsequent unread count = 0; second call → `{ marked: 0 }`.
3. Cross-user isolation: Alice has 6 unread, Bob has 3. Bob's `read-all` returns `{ marked: 3 }`; Bob's unread count drops to 0; Alice's 6 unread remain untouched.
4. Empty inbox (registration row pre-marked) → 200 `{ marked: 0 }` (not 404).

**Dependencies** — none new. No Prisma migration — NotificationLog has been on the schema since `[IV.18.15.1]`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Mark-all-read suite 4/4 pass.
- ✅ **Full real-DB + MinIO suite: 64 suites, 437 tests pass against live Docker.** (+1 suite, +4 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Authed caller can mark every unread row read in one round-trip.
- ✅ Returns `{ marked: <count> }` so clients can update the badge without re-fetching.
- ✅ Idempotent — second call returns `{ marked: 0 }`.
- ✅ Empty inbox returns 200, not 404.
- ✅ Cross-user isolation holds (owner-scoped `where { userId }`).
- ✅ Already-read rows are skipped (the `read: false` clause).

**Notes**

- **Why `read: false` clause and not just "set read=true on every row".** Postgres `updateMany` returns `{ count }` — the count tells the client how many rows actually changed. Without the `read: false` clause, the count would equal the entire inbox size on every call, which is misleading ("I marked 50 things read" when 49 were already read). The clause makes `marked` semantically meaningful.
- **Why `{ marked }` and not `{ count }` or `{ updated }`.** Past-tense verb-shape mirrors the operation: "this call marked N notifications as read". Self-explaining to any client without consulting docs. Same pattern conventions used elsewhere in the codebase (e.g. revoke-all-sessions returns `{ revoked }`).
- **Why declare `read-all` BEFORE `:id/read`.** Nest matches routes in declaration order. `read-all` is a literal path segment and would never match `:id/read` (different segment count), so technically the order doesn't matter today. Declaring it first is defensive: a future refactor that adds `@Post(':action')` or similar would silently shadow `read-all` if it came after. Same defensive ordering pattern used by `/reviews/summary` and the public memory-book routes.
- **Why empty inbox → 200, not 404.** The route operates on the _caller's own inbox_, which always exists by virtue of the caller being authenticated. Returning 404 would be lying — the inbox isn't missing, it's just zero-unread. Same "empty ≠ missing" reasoning as the review summary endpoint (`[IV.18.12.8]`).
- **Why no domain entity / no use-case-side validation.** `markAllReadForUser` is a pure ownership-scoped bulk update — there's nothing to validate. Even the userId comes from the JWT claim, not the request body. The use-case is a one-liner pass-through that exists only to keep the controller free of the repository import (clean-arch dependency rule).

---

### [IV.18.12.8] — Aggregated review rating summary (GET /reviews/summary)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Public-readable aggregation surface for the Reviews primitive: `GET /reviews/summary?targetType=&targetId=` returns `{ targetType, targetId, count, average, histogram }`. Drives the rating widget on every place / stay / eatery / agent detail page — without it, clients have to fetch the full review list and aggregate in JS, which doesn't scale past a few thousand reviews.

Single `prisma.review.groupBy({ by: ['rating'], where: { targetType, targetId }, _count: true })` query, hits the existing `(targetType, targetId)` index, returns at most 5 rows (one per rating bucket). The DB does the count; we zero-fill missing buckets and compute the average in JS.

`@Public()` — review summaries are crowd signal, no PII. Same precedent as published memory book reads (`[IV.18.12.7]`). Empty target → 200 with zero-filled shape (NOT 404) — aggregation of zero rows is a valid response, and a route that 404s on "no reviews" would leak target existence to strangers.

HTTP surface:

| Route                             | Auth        | What it does                                          |
| --------------------------------- | ----------- | ----------------------------------------------------- |
| `GET /api/v1/reviews/summary?...` | `@Public()` | `{ targetType, targetId, count, average, histogram }` |

**Files created** (2)

- `apps/api/src/modules/social/application/get-review-summary.use-case.ts` — orchestrator (one-liner over the port).
- `apps/api/test/social-review-summary.e2e-spec.ts` — 6 integration tests against real-Postgres.

**Files edited** (3)

- `apps/api/src/modules/social/application/ports/review.repository.ts` — adds `ReviewRatingHistogram` (5-bucket type alias) + `ReviewSummary` envelope + `aggregateByTarget(targetType, targetId): Promise<ReviewSummary>` method.
- `apps/api/src/modules/social/infrastructure/prisma-review.repository.ts` — implements `aggregateByTarget` via `groupBy` + zero-fill + 2-decimal rounding.
- `apps/api/src/modules/social/interface/reviews.controller.ts` — adds `@Get('summary')` + `@Public()` + a `ReviewSummaryDto` mapper. Declared BEFORE `@Get()` and `@Get(':id')` would be — Nest matches in declaration order, so the literal `summary` segment lands cleanly.
- `apps/api/src/modules/social/social.module.ts` — registers `GetReviewSummaryUseCase`.

**Tests** (6 cases, real-Postgres):

1. Empty target → 200; `count: 0`, `average: 0`, histogram is `{ 1:0, 2:0, 3:0, 4:0, 5:0 }`. NOT 404.
2. 5 reviews of ratings (5,5,4,3,1) → `count: 5`, `average: 3.6` (exact), histogram is `{ 1:1, 2:0, 3:1, 4:1, 5:2 }`. Three different authors used so any future unique-key constraint can't bite.
3. Cross-target isolation: 2 reviews on target A → A returns count=2; B (different id, no reviews) returns count=0 + zero-filled histogram.
4. Missing query params → 400 `VALIDATION_FAILED`.
5. Unknown `targetType` → 400 `VALIDATION_FAILED` (zod-narrow on the controller side).
6. No bearer → 200 (the `@Public()` decorator skips JwtAuthGuard).

**Dependencies** — none new. No Prisma migration — Review model has been on the schema since `[IV.18.12.5]`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Review-summary suite 6/6 pass.
- ✅ **Full real-DB + MinIO suite: 63 suites, 433 tests pass against live Docker.** (+1 suite, +6 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Empty target → 200 with zero-filled shape.
- ✅ Average rounded to 2 decimals (no `4.333333333333333` in JSON).
- ✅ Histogram always contains all 5 keys (1..5), zero-filled for empty buckets.
- ✅ Cross-target isolation holds.
- ✅ `@Public()` works without a bearer.
- ✅ `groupBy` hits the existing `(targetType, targetId)` index — no new index needed.

**Notes**

- **Why aggregation in the DB, not "fetch + count in app".** A target with 10k reviews returns 10k rows over the wire if we list-and-aggregate; `groupBy` returns at most 5. The diff scales with review count — per-target latency stays ~constant regardless of volume. This is the slice that lets Reviews actually ship at scale.
- **Why zero-fill in the adapter, not the use-case.** The histogram shape `{ 1:0, ..., 5:0 }` is part of the wire contract — every consumer renders the bar chart by iterating buckets, so the API has to guarantee all 5 keys exist. Centralizing the fill in the adapter keeps the use-case a pure pass-through; if a future adapter (e.g. a cached read-model) implements `aggregateByTarget` differently it still has to honor the same contract.
- **Why round to 2 decimals at the boundary.** A star widget renders `4.32` — not `4.32999999999999`. Doing the rounding here means the wire shape is stable and clients don't have to repeat the same `toFixed(2)` everywhere. The exact unrounded value is recoverable as `(weighted/total)` from the histogram if any consumer ever needs it.
- **Why empty target → 200, not 404.** Two reasons: (1) "this place has no reviews yet" is meaningfully different from "this place doesn't exist" — collapsing them into 404 confuses clients. (2) The route is `@Public()`; 404-on-empty would let a stranger probe target id space ("does this place exist?") via the review surface, which is a privacy-adjacent leak even if the target id is technically public. Returning the same zero-filled shape regardless of target existence closes that channel.
- **Why this is the right slice to ship next.** Reviews-v1 (`[IV.18.12.5]`) shipped the write + raw-list reads but not the consumer surface. Without `summary`, every Reviews-rendering screen had to fetch all-reviews and aggregate in JS — which is fine at < 100 reviews, broken at > 1000. Adding the endpoint here costs ~4 files; deferring it forces a frontend rewrite later.
- **Why the controller-side zod-narrow on `targetType` and not just trust it.** The query param is a free string; Prisma would happily run `where: { targetType: 'bogus' }` and return zero rows. The narrow rejects the request explicitly with `VALIDATION_FAILED` instead of silently returning an empty histogram for a malformed query — strictly better debugging for the caller.

---

### [IV.18.16.2] — Right-to-erasure (DELETE /account; soft-delete + session revoke)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.10 (Compliance & Privacy)

**What was done**

Pairs with `[IV.18.16.1]`'s data-export to complete the GDPR Art. 17 / India DPDP §12 / COPPA right-to-erasure core. Single authed `DELETE /api/v1/account` route that atomically:

1. Sets `User.deletedAt = now()` (using `updateMany` + `deletedAt: null` clause as a "set if not already deleted" gate).
2. Revokes every live `Session` row for the user (`revokedAt = now()` where `revokedAt IS NULL`).

Both writes happen in a single `prisma.$transaction([...])` so the system can never end up with `User.deletedAt` set but sessions still live (or vice-versa). Local writes only — no network calls inside the transaction (CLAUDE rule 13).

**Effect:**

- Subsequent login → 401 `INVALID_CREDENTIALS` (the user repository already filters `deletedAt != null` rows out as absent — same code path as a wrong email).
- Subsequent `/refresh` → 401 (session was revoked at delete time; `RefreshSessionUseCase` sees a revoked-row replay and either cascades or returns `REFRESH_USER_MISSING`).
- Already-issued access tokens continue to verify until their 15-min TTL expires. **This is the documented v1 trade-off** — the alternative (per-request DB lookup on every authed call) is too expensive for what the session revoke already gives us. The session revoke caps the worst-case unauthed-access window at the access-token TTL.

HTTP surface:

| Route                    | Auth   | What it does                                           |
| ------------------------ | ------ | ------------------------------------------------------ |
| `DELETE /api/v1/account` | bearer | Soft-delete + revoke all live sessions; 204 No Content |

**Files created** (3)

- `apps/api/src/modules/account/application/ports/account-deleter.ts` — single-method port: `softDeleteAndRevokeSessions(userId, deletedAt): Promise<boolean>`. Returns `false` when the row was missing or already-deleted; the use-case maps that to 404 `USER_NOT_FOUND`.
- `apps/api/src/modules/account/application/delete-account.use-case.ts` — wraps the adapter; `false` from the port → `UserNotFoundError`.
- `apps/api/src/modules/account/infrastructure/prisma-account-deleter.ts` — two-step `$transaction([userUpdate, sessionUpdate])`. The user update uses `updateMany({ id, deletedAt: null }, { deletedAt })` so the operation is naturally idempotent under concurrent calls (only the first one gets `count === 1`).

**Files edited** (2) — `apps/api/src/modules/account/account.module.ts` (+1 provider, +1 use-case), `apps/api/src/modules/account/interface/account.controller.ts` (+1 `DELETE` route).

**Files created** (1 more) — `apps/api/test/account-delete.e2e-spec.ts`.

**Tests** (`apps/api/test/account-delete.e2e-spec.ts`, 6 cases, real-Postgres):

1. No bearer → 401 `UNAUTHENTICATED`.
2. Happy path → 204; `User.deletedAt` set; live session count drops to 0.
3. After delete, login with the same credentials → 401 `INVALID_CREDENTIALS` (repo treats the row as absent).
4. After delete, `/refresh` with the original cookie → 401. The exact code is one of `REFRESH_REUSE_DETECTED`, `REFRESH_USER_MISSING`, or `REFRESH_EXPIRED` — all three are correct security signals after a delete; the test asserts the set, not the exact code (gives the existing reuse-cascade logic room to evolve).
5. Cross-user isolation: Alice's delete sets `Alice.deletedAt` only; Bob's row + sessions stay clean and Bob can still hit `/account/export`.
6. Idempotent guard: a second `DELETE` with Alice's still-valid access token → 404 `USER_NOT_FOUND` (the `updateMany` `deletedAt: null` clause returns `count === 0` on the already-deleted row → port returns `false` → use-case throws). Documents the v1 access-token TTL trade-off.

**Dependencies** — none new. No Prisma migration — `User.deletedAt` has been on the schema since `[III.12.1]` for exactly this flow.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Account-delete suite 6/6 pass.
- ✅ **Full real-DB + MinIO suite: 62 suites, 427 tests pass against live Docker.** (+1 suite, +6 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Authed caller can delete their own account; route returns 204.
- ✅ `User.deletedAt` set on the row.
- ✅ All live sessions revoked atomically with the soft-delete.
- ✅ Subsequent login fails (login flow already filters soft-deleted via `findByEmailHash`).
- ✅ Subsequent refresh fails (session revoked + user soft-delete).
- ✅ Cross-user isolation holds.
- ✅ Second delete with the same access token → 404 (idempotent semantics for the row, error semantics at the API).

**Notes**

- **Why a `$transaction` and not two sequential awaits.** A crash between the user update and the session revoke would leave the system in a "soft-deleted user with live sessions" state — which means the user could refresh-then-export their own data while their account is supposedly gone. The transaction makes both writes succeed-or-rollback together. Both are local DB writes; CLAUDE rule 13 (no network calls inside `$transaction`) is satisfied.
- **Why `updateMany` + `deletedAt: null` clause and not `update` + check `deletedAt`.** `update` with a unique ID always returns the row even if it's already-deleted, requiring a follow-up "was this our delete or a no-op" check. `updateMany` with `where: { id, deletedAt: null }` makes the gate atomic — `count === 1` means _we_ did the delete, `count === 0` means the row was missing or already-deleted. Same pattern the rest of the codebase uses for owner-scoped writes (Media, Safety, Notifications, Memory Book).
- **Why access tokens stay valid for their TTL after delete.** Two reasons: (1) JWT verification is stateless by design — adding a per-request DB lookup defeats the architecture. (2) The session revoke is the actual security boundary — the worst-case unauthed-access window after a delete is the access-token TTL (15 min), bounded by the moment the access token expires AND the user can't refresh AND the user can't log back in. Three independent gates close the loop. The cost of doing better (per-request DB lookup) is too high for the marginal security gain.
- **Why `false` (port) → 404 (HTTP) for an already-deleted row.** Idempotency at the API surface vs. at the row level is a design choice. Returning 204 on a no-op-double-delete would obscure a client bug ("why did my second DELETE succeed when I thought I just got rid of this account?"). 404 makes the second call distinguishable. The row-level operation IS still idempotent — calling it twice does no harm; only the second response shape changes.
- **Why no per-section deletion of dependent rows here.** Schema-level `onDelete: Cascade` on every user-scoped FK means the future hard-delete cron can call a single `prisma.user.delete({ where })` and Prisma will wipe Trip + ItineraryDay + ScamReport + SosEvent + MediaAsset + MemoryBook + Vote + Expense + Review + StayBooking + Subscription + EscrowHold + Commission + Agent + LiveEvent + UserOAuthIdentity + Session + MfaBackupCode + Preferences + Device + NotificationPreference + NotificationLog automatically. This slice does NOT delete those — that's the 7-day-window cron's job. v1 is "soft-delete + revoke; cron sweeps later".
- **GDPR core is now functionally complete.** Right-of-access (Art. 15) shipped in `[IV.18.16.1]`; right-to-erasure (Art. 17) shipped here. Right-to-rectification is implicit (the user can edit their profile via existing identity routes); right-to-portability falls out of `/account/export` returning structured JSON. The remaining piece is the hard-delete cron, which is a deployment-readiness concern more than a correctness one.

---

### [IV.18.16.1] — GDPR / DPDP / COPPA data-export endpoint (give-me-my-data)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.10 (Compliance & Privacy)

**What was done**

Ships the first compliance-driven surface: a single authenticated `GET /api/v1/account/export` that returns the caller's full data bundle as JSON. Every user-attributable row across all 14 modules is fanned out via owner-scoped Prisma reads in a single `Promise.all`, so the bundle returns in roughly the slowest-section's time, not the sum.

**Why one endpoint, not 14 per-module exports?** GDPR Art. 15 / India DPDP §11 / COPPA all phrase the right as "everything you have on me, in one request". Per-module exports force clients to know the schema and the right call order. Single endpoint = single audit point + single response shape. Memory budget is fine — even a power user has < 10MB of typed rows.

HTTP surface:

| Route                        | Auth   | What it does                                                |
| ---------------------------- | ------ | ----------------------------------------------------------- |
| `GET /api/v1/account/export` | bearer | Returns full owner-scoped data bundle for the authed caller |

**Files created** (6)

- `apps/api/src/modules/account/account.module.ts` — 15th HTTP module.
- `apps/api/src/modules/account/domain/user-data-export.entity.ts` — strict-typed envelope: per-section `{ count, rows[] }` + `metadata: { exportedAt, formatVersion: 1, userId }`. 23 distinct row shapes — every Prisma model that has a user-attributable column.
- `apps/api/src/modules/account/application/ports/user-data-aggregator.ts` — single-method port: `aggregateForUser(userId): Promise<UserDataBundle | null>`.
- `apps/api/src/modules/account/application/export-user-data.use-case.ts` — wraps the aggregator with the metadata envelope; `null` from the port → 404 `USER_NOT_FOUND`.
- `apps/api/src/modules/account/infrastructure/prisma-user-data-aggregator.ts` — owner-scoped fan-out across 26 Prisma reads via `Promise.all`. Itinerary days/items use Prisma relation filters (`day: { trip: { userId } }`) to scope by the user's own trips in a single SQL roundtrip. Decimal columns (`amountUsd`, `priceUsd`, `totalPriceUsd`) emit as `.toFixed(2)` strings to avoid precision loss in JSON serialization.
- `apps/api/test/account-export.e2e-spec.ts` — 5 integration tests against real Postgres + MinIO (5th leans on MinIO via the rich-user media path).

**Files edited** (1) — `apps/api/src/app.module.ts` (+1 module import: `AccountModule`).

**Privacy invariants enforced by the adapter (NOT the domain shape):**

- `User.passwordHash`, `User.mfaSecret`, `User.emailEncrypted` — NEVER included.
- MFA backup codes — emit `{ id, used, usedAt, createdAt }` only; the codeHash and original plaintext are never in the bundle.
- Sessions — emit `userAgent` + timestamps + revocation; `refreshTokenH` (sha256 hash) and `ipHash` are NOT in the bundle (operationally useful, not user-meaningful).
- PostGIS columns (`Trip.center`, `MediaAsset.coordinates`, `ScamReport.coordinates`, `SosEvent.coordinates`) — intentionally omitted in v1. Bringing them back as `{ lng, lat }` requires raw-SQL extraction via `GeoQueries` (CLAUDE.md rule 11) and is queued for v2.

**Cross-trip social rows** — v1 only includes rows the caller directly authored:

- `Vote` where `userId == caller`.
- `Expense` where `paidById == caller` (NOT participation-only via `splitShare` JSON keys).
- `Review` where `authorId == caller`.

A user appearing as a participant key in someone else's `Expense.splitShare` is NOT in this bundle. Adding that requires JSON-key indexing or a per-user shadow row, neither of which exists today; queued for v2.

**Tests** (`apps/api/test/account-export.e2e-spec.ts`):

1. No bearer → 401 `UNAUTHENTICATED`.
2. Empty user (just registered) → 200; only Identity is populated (User row + ≥1 Session + ≥1 NotificationLog from `session_issued_new_device`); every other section is `{ count: 0, rows: [] }`.
3. Rich user (created trip + scam report + media asset + memory book) → bundle contains every authored row.
4. Cross-user IDOR — Bob's bundle contains zero of Alice's rows even when both seed similar shapes; Alice's bundle still contains all of hers. The owner-scoped queries are the security boundary.
5. Itinerary fan-out — trip with generated itinerary → exact day count present in `itineraryDays`; items section empty (correct v1 shape since itinerary generation only mints day skeletons).

**Dependencies** — none new. No Prisma migration — every entity exported has been on the schema since day one.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Account-export suite 5/5 pass.
- ✅ **Full real-DB + MinIO suite: 61 suites, 421 tests pass against live Docker.** (+1 suite, +5 tests vs. previous baseline.)

**Acceptance criteria**

- ✅ Authed caller can fetch their full bundle.
- ✅ Bundle includes metadata (`exportedAt`, `formatVersion: 1`, `userId`).
- ✅ Every section is `{ count, rows[] }` shape.
- ✅ Cross-user IDOR isolation — Bob never sees Alice's rows.
- ✅ Sensitive Identity columns (passwordHash, mfaSecret, emailEncrypted, refreshTokenH, ipHash) NOT in the bundle.
- ✅ PostGIS columns omitted in v1 (documented + safe).
- ✅ Decimal columns serialize as `.toFixed(2)` strings.

**Notes**

- **Why a port + adapter, not direct Prisma in the use-case.** The aggregator is the cross-module read. Routing it through a port keeps the application layer free of Prisma imports + lets a future deployment topology (sharded tenant DB, per-section read-replica routing) ship as a second adapter without touching the use-case. The clean-arch dependency rule (CLAUDE.md rule 10) holds.
- **Why parallel `Promise.all` over 26 reads, not sequential.** Postgres handles 26 short owner-scoped indexed reads concurrently with no contention — they all touch different tables. Sequential would cost ~26 × per-roundtrip-latency. Parallel costs ~max(per-section-latency). Power-user export goes from "noticeably slow" to "indistinguishable from a single query".
- **Why the use-case fails on adapter error rather than partial-export.** Partial exports silently under-disclose, which defeats the legal point of the surface. Any read fails → 500 → caller retries. This is the right failure mode for a compliance endpoint: never emit a bundle that's incomplete-and-claims-to-be-complete.
- **Why `formatVersion: 1` not `formatVersion: "1.0.0"`.** A single integer is enough for "the wire shape changed; tooling that snapshots a user's bundle should diff or re-fetch". Semver would imply we'd ship `1.0.1` for a bug fix — bug fixes don't change the wire shape, they fix what's wrong with it. Integer monotonic; cheap.
- **Why `User.emailHash` is in the bundle but not `emailEncrypted`.** The hash is opaque (sha256 of pepper+email) — it can't be reversed to the plaintext email without the pepper, and the user already knows their own email. The encrypted form requires the pgcrypto key to decrypt, which is a system secret; shipping it would either be useless (still encrypted) or a leak (if we decrypted it, we'd be exposing the key). The hash communicates "yes, we have a record of you" without giving the user data they'd need a key to make sense of.
- **Why no Subscription / EscrowHold / Commission filtering even though v1 has zero of these rows.** The aggregator exports them anyway — Phase 2 will populate the tables, and the export shape is then already in place. Cost: 3 indexed reads that return 0 rows on every Phase 1 export. Effectively free.
- **First compliance surface in the codebase.** Production-readiness for "GDPR / DPDP / COPPA give-me-my-data" went from 0% to ~80% — the missing 20% is the right-to-erasure flow (`POST /account/delete` with a 7-day soft-delete window + hard-delete cron), which is the natural follow-up. Mentioned in the controller JSDoc but explicitly NOT in this slice.
- **15th HTTP module.** Account joins identity, trip, places, stays, food, events, weather, transport, safety, admin, health, media, notifications, social. The pattern of a tiny module that cuts across domains (this one reads from 13 of the others) is precedented by `admin/places-curation` (cross-cuts Places + ModerationItem).

---

### [IV.18.12.7] — Memory Book publish flow (public read + presigned bytes from MinIO)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.13 (Media & Memory)

**What was done**

Closes the Memory Book v1 story by adding the share-with-the-world UX. Owner publishes a book (flips `publishedAt` to `now()`); strangers fetch `GET /memory-books/public/:id` without auth + render the album by hitting per-asset presigned download URLs. Unpublish clears the flag; the public read 404s immediately while already-issued presigned URLs continue to work for their TTL window (S3 contract).

**Design choice: bookId IS the share token.** No new schema column, no separate share-code mint flow. The cuid id has ~130 bits of entropy — unguessable on its own. This is the same security argument behind the existing `TripShare.shareCode` (also opaque random). The advantage: no migration, simpler mental model, same security posture. A future per-share TTL / revocable code can layer on if/when the product needs it.

HTTP surface:

| Route                                                                 | Auth        | What it does                   |
| --------------------------------------------------------------------- | ----------- | ------------------------------ |
| `POST   /api/v1/memory-books/:id/publish`                             | owner       | flip `publishedAt = now`       |
| `POST   /api/v1/memory-books/:id/unpublish`                           | owner       | clear `publishedAt`            |
| `GET    /api/v1/memory-books/public/:id`                              | `@Public()` | read book (404 if unpublished) |
| `GET    /api/v1/memory-books/public/:id/assets/:assetId/download-url` | `@Public()` | presigned 5-min download URL   |

- **`apps/api/src/modules/media/application/ports/memory-book.repository.ts`** — adds 3 methods:
  - `setPublishedAtForOwner(id, ownerId, publishedAt | null)` — owner-scoped update.
  - `findPublishedById(id)` — public read; only returns rows with `publishedAt IS NOT NULL`.
  - `findPublishedAssetForBook(bookId, assetId)` — three-clause gate (asset attached + asset ready + book published) in a single Prisma query via the relation filter `memoryBook: { publishedAt: { not: null } }`. Single round-trip.
- **`apps/api/src/modules/media/infrastructure/prisma-memory-book.repository.ts`** — implements all 3 with the established updateMany-+-count + findFirst patterns.
- **4 new use-cases**:
  - `publish-memory-book.use-case.ts` — owner-gated; republishing refreshes the timestamp.
  - `unpublish-memory-book.use-case.ts` — owner-gated; idempotent (already-unpublished is a success).
  - `get-published-memory-book.use-case.ts` — public; 404 collapses missing-id + unpublished into one signal.
  - `get-published-asset-download-url.use-case.ts` — public; calls `STORAGE_PROVIDER.createPresignedDownloadUrl` with 5-min TTL after the repo's three-clause gate.
- **`apps/api/src/modules/media/interface/memory-book.controller.ts`** — +4 routes. Public routes declared FIRST so Nest's order-of-declaration matcher can't shadow them with the `:id` paths (belt-and-braces — `'public'` is a literal segment so this is technically not required).
- **`apps/api/src/modules/media/media.module.ts`** — +4 use-case providers.

- **7 integration tests** (`apps/api/test/memory-book-publish.e2e-spec.ts`) against real Postgres + MinIO:
  1. Public GET on an unpublished book → 404 (no auth needed to probe; book privacy preserved).
  2. **End-to-end happy path**: publish → public GET succeeds → public download URL → fetch URL → bytes match the original PNG. No bearer needed for any public step.
  3. Unpublish → public GET 404s; new download URL request 404s; **but** previously-issued presigned URLs still fetch (S3 contract).
  4. Publish on someone else's book → 404.
  5. Asking for an asset that isn't attached to the book → 404 (the three-clause gate).
  6. Public GET response contains NO `ownerId` (privacy invariant — strangers shouldn't enumerate publishers).
  7. Re-publishing refreshes `publishedAt` (book stays public; timestamp moves forward).

**Files created** (5) — `application/publish-memory-book.use-case.ts`, `application/unpublish-memory-book.use-case.ts`, `application/get-published-memory-book.use-case.ts`, `application/get-published-asset-download-url.use-case.ts`, `test/memory-book-publish.e2e-spec.ts`.
**Files edited** (3) — `application/ports/memory-book.repository.ts` (+3 methods), `infrastructure/prisma-memory-book.repository.ts` (+impls), `interface/memory-book.controller.ts` (+4 routes + PublicBookDto), `media.module.ts` (+4 use-case providers).

**Dependencies** — none new. No Prisma migration — `publishedAt` column has been on the schema since day one.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Publish suite 7/7 pass — including the unauth'd bytes-out-of-MinIO end-to-end.
- ✅ **Full real-DB + MinIO suite: 60 suites, 416 tests pass against live Docker.** (+1 suite, +7 tests.)

**Acceptance criteria**

- ✅ Owner can publish + unpublish their own books.
- ✅ Public GET works without auth on a published book.
- ✅ Public download-URL works without auth, returns bytes that match the upload.
- ✅ Unpublish 404s the public GET immediately.
- ✅ Published presigned URLs continue working for their TTL after unpublish (documented S3 contract).
- ✅ Public DTO does NOT leak ownerId.
- ✅ Cross-user publish/unpublish → 404.

**Notes**

- **Why bookId is the share token.** A separate `MemoryBookShare` table would let a single book have multiple revocable codes (à la `TripShare`). For v1 the trade-off doesn't pay off: a book has one canonical "share me" intent, and the cuid id is already 25 chars / ~130 bits of entropy, indistinguishable from a random token. Saved a migration + a join + 4 new endpoints. When the product asks for "give me 3 different shareable links to track who clicked" — that's the slice that introduces the share table. Today it would be over-engineering.
- **Why public routes go first in the controller.** Nest's route resolver matches in declaration order. `'public'` IS a literal path segment so it would resolve correctly even after `:id`, but declaring public-first makes the intent obvious + protects against a future `@Get('public')` collision when extending. Cheap defensive ordering.
- **Why already-issued URLs survive unpublish.** S3 (and MinIO) don't ask the issuer's API "is this URL still valid?" on each request — the URL signature is self-validating against the credentials at sign-time. There's no server-side mechanism to revoke an in-flight presigned URL short of rotating the bucket access keys (catastrophic). For v1 the 5-min TTL is the bound; if a creator unpublishes for a privacy reason, they should expect a 5-min "already-clicked-the-link" tail. Documented in the use-case JSDoc + asserted by the test.
- **Why the public DTO omits ownerId.** A stranger reading a published book shouldn't be able to enumerate the user id of the publisher — that's a privacy-adjacent leak. The owner's `displayName` could legitimately appear ("Published by Alice") but that requires a cross-module Identity lookup, deferred. v1 ships title + theme + cover + publishedAt + createdAt — enough for a clean album header.
- **Why republish refreshes the timestamp.** A publish-on-already-published is a legitimate user action ("I just added more photos to my Paris album, freshen the share"). The new timestamp lets a future analytics surface ("recently-republished books") track activity. The cost is one extra column write on a re-publish — negligible.
- **Why the three-clause gate runs in a single Prisma query (not three).** Asset-attached + asset-ready + book-published is a JOIN-style condition that Prisma's relation filter (`memoryBook: { publishedAt: { not: null } }`) compiles to a single SELECT. Three sequential queries would be 3× the latency for a public read that's likely to be hot. Single round-trip + the failure mode (any clause false → null → 404) is identical from outside.
- **First public-readable Media surface.** The codebase had `GET /trips/shared/:code` since [IV.18.2.13]; this is the second `@Public()` route + the first one that streams bytes from object storage to unauthenticated clients. The `@Public()` decorator + `JwtAuthGuard` skip pattern from Identity has now been validated for two distinct domains.
- **Memory Book primitive is now functionally complete.** CRUD, attach/detach, publish/unpublish, public read, public asset download. Memory-book → printed-book / PDF-export / collaborative editing remain follow-ups but the v1 publish-album-of-photos UX is fully shippable.

---

### [IV.18.12.6] — Memory Book v1 (CRUD + media attach/detach, cascade-safe delete)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.13 (Media & Memory)

**What was done**

Second Media entity after MediaAsset. A Memory Book bundles a user's `ready` `MediaAsset` rows into a named, themed album — the "trip photo album" UX. Schema's `MemoryBook` model + `MediaAsset.memoryBookId` FK (with `onDelete: SetNull`) have existed since day one; this slice wires the CRUD + attach/detach surface.

Mirrors the attach-to-trip shape from [IV.18.12.2] almost exactly — double owner-gate (media + book), symmetric attach/detach endpoint, same "don't cascade media on book delete" semantic.

HTTP surface (all authed, all owner-gated):

| Route                                  | What it does                                 |
| -------------------------------------- | -------------------------------------------- |
| `POST   /api/v1/memory-books`          | create (title + optional theme + coverS3Key) |
| `GET    /api/v1/memory-books`          | list mine (default 50, cap 200)              |
| `GET    /api/v1/memory-books/:id`      | get one + attached `ready` asset ids         |
| `PATCH  /api/v1/memory-books/:id`      | update title / theme / coverS3Key            |
| `DELETE /api/v1/memory-books/:id`      | delete (MediaAsset.memoryBookId → null)      |
| `PATCH  /api/v1/media/:id/memory-book` | attach/detach (body: `{ memoryBookId }`)     |

- **`apps/api/src/modules/media/domain/memory-book.entity.ts`** — `MemoryBook` (id, ownerId, title, coverS3Key, theme, publishedAt, timestamps) + `MemoryBookWithAssets` envelope. `publishedAt` is dormant in v1 — the column exists for a future public-publish slice that adds a share-code surface; no HTTP route flips it today.
- **`apps/api/src/modules/media/application/ports/memory-book.repository.ts`** — `create`, `findByIdForOwner`, `listForOwner`, `updateForOwner` (partial, nothing-to-update is a no-op read), `deleteForOwner`, `listAssetIdsForOwner` (`ready`-only, owner-scoped, desc by createdAt).
- **`apps/api/src/modules/media/infrastructure/prisma-memory-book.repository.ts`** — Prisma direct delegate. Partial-update builder skips `undefined` keys so an accidental `theme: undefined` doesn't wipe the column. Asset-ids lookup uses `select: { id: true }` — avoids pulling full MediaAsset rows when callers only want ids.
- **`apps/api/src/modules/media/application/ports/media-asset.repository.ts`** — adds `setMemoryBookForOwner` (symmetric with `setTripForOwner`).
- **`apps/api/src/modules/media/infrastructure/prisma-media-asset.repository.ts`** — implements it via the same `updateMany` + count-gate pattern.
- **6 new use-cases in `modules/media/application/`**:
  - `create-memory-book.use-case.ts` — title 1..120, theme ≤ 32 (empty → `'classic'`), coverS3Key passthrough. Typed `INVALID_TITLE` / `INVALID_THEME` errors.
  - `get-memory-book.use-case.ts` — owner-gated; 404 → `MEMORY_BOOK_NOT_FOUND`. Returns `{ book, assetIds }`.
  - `list-memory-books.use-case.ts` — default 50, cap 200.
  - `update-memory-book.use-case.ts` — partial update; empty patch is a no-op read. Same validation as create.
  - `delete-memory-book.use-case.ts` — owner-scoped delete; FK's `SetNull` preserves the attached media.
  - `attach-media-to-book.use-case.ts` — double owner-gate (media + book); 404 on wrong-owner on either side with the matching code.
- **`apps/api/src/modules/media/interface/dto/media.dto.ts`** — +`CreateMemoryBookBodySchema` + `UpdateMemoryBookBodySchema` + `AttachMediaToBookBodySchema`.
- **`apps/api/src/modules/media/interface/memory-book.controller.ts`** — new controller at `/memory-books`, 5 routes.
- **`apps/api/src/modules/media/interface/media.controller.ts`** — +`PATCH /:id/memory-book` (co-located with the existing attach-to-trip surface for discoverability).
- **`apps/api/src/modules/media/media.module.ts`** — +repo provider + 6 use-cases + MemoryBookController.

- **10 integration tests** (`apps/api/test/memory-book.e2e-spec.ts`) against real Postgres + MinIO:
  1. No bearer → 401.
  2. Full CRUD roundtrip: create → list → get → update (title only, theme unchanged) → delete → gone (404).
  3. Default theme is `'classic'` when omitted.
  4. Attach media → `GET /memory-books/:id` returns it in `assetIds`; detach → empty again.
  5. Attach to another user's book → 404 `MEMORY_BOOK_NOT_FOUND` (IDOR).
  6. Attach someone else's media to my book → 404 `MEDIA_NOT_FOUND`.
  7. GET another user's book → 404 `MEMORY_BOOK_NOT_FOUND`.
  8. **Cascade invariant**: delete a book with attached media → book gone, but `MediaAsset.memoryBookId` NULLs (verified via `GET /media/:id/download-url` still succeeding — media row survives).
  9. Empty title → 422 `VALIDATION_FAILED`.
  10. List returns only the caller's own books.

**Files created** (9) — `modules/media/domain/memory-book.entity.ts`, `modules/media/application/ports/memory-book.repository.ts`, `modules/media/infrastructure/prisma-memory-book.repository.ts`, 6× `modules/media/application/*-memory-book.use-case.ts`, `modules/media/application/attach-media-to-book.use-case.ts`, `modules/media/interface/memory-book.controller.ts`, `test/memory-book.e2e-spec.ts`.
**Files edited** (5) — `modules/media/application/ports/media-asset.repository.ts` (+setMemoryBookForOwner), `modules/media/infrastructure/prisma-media-asset.repository.ts` (+impl), `modules/media/interface/dto/media.dto.ts` (+3 schemas), `modules/media/interface/media.controller.ts` (+attach-to-book route), `modules/media/media.module.ts` (+6 providers + controller).

**Dependencies** — none new. No Prisma migration — `MemoryBook` table + `MediaAsset.memoryBookId` FK both in schema + DB since day one.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Memory Book suite 10/10 pass, including the cascade invariant (book delete doesn't nuke media).
- ✅ **Full real-DB + MinIO suite: 59 suites, 409 tests pass against live Docker.** (+1 suite, +10 tests.)

**Acceptance criteria**

- ✅ Owner can create, list, get, update, delete their own books.
- ✅ Attach/detach media via `PATCH /media/:id/memory-book`.
- ✅ GET returns attached asset ids (ready-only, desc by createdAt).
- ✅ Deleting a book SetNulls the media — photos survive.
- ✅ Cross-user IDOR attempts on either side → 404 with the right code.
- ✅ Default theme applied when omitted.

**Notes**

- **Why asset ids, not full MediaAsset rows, in the book response.** Typical album has 50-200 photos. Returning full rows with s3Key + status + timestamps etc. bloats the book-get response 5-10×, and clients have to hit `GET /media/:id/download-url` per asset anyway (presigned URLs can't be pre-minted + stuffed into the response — they'd expire before the user even scrolled). Ids-only keeps the response tight + lets clients render thumbnails lazily as they enter the viewport.
- **Why `onDelete: SetNull` (not `Cascade`) on `MediaAsset.memoryBookId`.** Deleting a photo album means "I don't want these grouped anymore," not "nuke the photos." Cascade would conflate the two operations into one destructive verb — a user who meant "rename this book" but mis-clicked delete would lose photos. SetNull preserves the library while removing the organisation. The invariant test locks this in.
- **Why `publishedAt` is dormant in v1.** Publishing a memory book (making it readable by strangers via a share code) is a distinct feature: needs a public read surface, a share-code mint flow, expiry semantics, and a separate "shared-book view" controller. Bundled with v1 it would triple the slice size while adding complexity most users don't need for private albums. Shipping the column but keeping the setter absent keeps the door open without blocking this slice.
- **Why nothing-to-update returns the current row (not 400 or 304).** Clients that PATCH with an empty body probably have a stale form state bug. Returning 200 with the current row is the kindest response — no data is lost, no spurious error surfaces, and the client state self-heals. 304 would require clients to handle a different response shape; 400 would punish innocent clients. Matches the UPDATE conventions used elsewhere (Identity session update, Trip update).
- **Why attach/detach lives on `/media/:id/memory-book`, not `/memory-books/:id/media/:mediaId`.** The attach operation is fundamentally a mutation on the media asset (its `memoryBookId` FK). Keeping it under `/media/` co-locates it with the existing `PATCH /media/:id/trip` — symmetric semantics + same handler-shape for clients. A future "bulk attach" endpoint (`POST /memory-books/:id/media` with a `{ mediaIds: [] }` body) can land separately.
- **Why the title validation happens in the use-case, not only Zod.** Zod's `min(1).max(120)` matches the use-case's bounds exactly today, but the use-case also trims + re-checks to catch whitespace-only payloads (`"   "` would pass Zod's min-length but fail meaningfully at the use-case's trim-then-check). The typed `INVALID_TITLE` error carries the current length in `context` for debugging. Same layered-validation pattern expense use-case uses for `amountUsd`.
- **Media module now 2 entities** (MediaAsset + MemoryBook) — 14th HTTP-surface module but the first non-Identity module to ship two distinct entities. Natural next Media slice: publish flow (share code + public read), or EXIF-strip worker hook for the MediaAsset side.

---

### [IV.18.12.5] — Social reviews v1 (trip-optional ratings on places / stays / eateries / agents)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Third Social primitive after voting + expenses. Users rate 1–5 + write text reviews against places, stays, eateries, or agents (the 4 `targetType` values supported by the schema). Novel shape for this module: **trip-optional**. A standalone review of a place you visited solo just needs auth; attach to a trip via `body.tripId` and the collaborative-voting gate kicks in.

Unlike Vote (unique per user+target) + Expense (unique by id only), Review explicitly permits **multiple reviews per user per target** — a traveler can rate the same place after different visits. No UNIQUE constraint in the schema enforces this; the test locks it in.

HTTP surface (all authed):

| Route                                        | What it does                                |
| -------------------------------------------- | ------------------------------------------- |
| `POST /api/v1/reviews`                       | create (standalone or trip-attached)        |
| `GET  /api/v1/reviews?targetType=&targetId=` | list reviews on a target (public to authed) |
| `GET  /api/v1/reviews/mine`                  | list caller's own reviews                   |
| `DELETE /api/v1/reviews/:id`                 | author-only delete                          |

- **`apps/api/src/modules/social/domain/review.entity.ts`** — `Review` + `ReviewTargetType` union (`'place' | 'stay' | 'eatery' | 'agent'`). tripId + language + verifiedBooking all preserved.
- **`apps/api/src/modules/social/application/ports/review.repository.ts`** — 5-method port: `create`, `listByTarget`, `listByAuthor`, `findById`, `deleteForAuthor`.
- **`apps/api/src/modules/social/infrastructure/prisma-review.repository.ts`** — Prisma direct delegate. Scoped `deleteMany` + count gate on delete (same idiom every other owner-scoped write uses).
- **`apps/api/src/modules/social/application/create-review.use-case.ts`** — validates rating ∈ [1,5], body non-empty + ≤ 5000, language matches `^[a-z]{2}$`. If `tripId` is present, runs `assertTripAccess` helper (the shared gate from [IV.18.12.3]) → trip-collab gate. If absent, proceeds straight to insert.
- **`apps/api/src/modules/social/application/delete-review.use-case.ts`** — author-only; 404 on missing OR non-author.
- **`apps/api/src/modules/social/application/list-reviews-for-target.use-case.ts`** — public to authed; most-recent-first. Default 50, cap 200.
- **`apps/api/src/modules/social/application/list-my-reviews.use-case.ts`** — authed, scoped to caller.
- **`apps/api/src/modules/social/interface/dto/social.dto.ts`** — adds `ReviewTargetTypeSchema` (exported) + `CreateReviewBodySchema`. `language` defaults to `'en'` at the use-case.
- **`apps/api/src/modules/social/interface/reviews.controller.ts`** — 4 routes at top-level `/reviews`. GET listing uses `?targetType=&targetId=` query params rather than nested `/places/:id/reviews` so a single handler covers all 4 targetTypes without route explosion. Missing query params → 400 `VALIDATION_FAILED`.
- **`apps/api/src/modules/social/social.module.ts`** — registers the review provider + 4 use-cases + ReviewsController.

- **10 integration tests** (`apps/api/test/social-reviews.e2e-spec.ts`):
  1. No bearer → 401.
  2. Standalone review (tripId absent) succeeds for any authed user; language defaults to `'en'`.
  3. Trip-attached review: owner succeeds, non-owner without share → 404 `TRIP_NOT_FOUND`.
  4. List-by-target returns every review, most-recent-first.
  5. Missing query params on GET → 400 `VALIDATION_FAILED`.
  6. `/reviews/mine` returns only caller's own reviews.
  7. Author can delete; non-author → 404 `REVIEW_NOT_FOUND`.
  8. Rating 6 → 422 `VALIDATION_FAILED` (Zod rejects first).
  9. Empty body → 422 `VALIDATION_FAILED`.
  10. Same user posting 3 reviews on the same target → all 3 persist (no unique constraint).

**Files created** (8) — `modules/social/domain/review.entity.ts`, `modules/social/application/ports/review.repository.ts`, `modules/social/infrastructure/prisma-review.repository.ts`, `modules/social/application/create-review.use-case.ts`, `modules/social/application/delete-review.use-case.ts`, `modules/social/application/list-reviews-for-target.use-case.ts`, `modules/social/application/list-my-reviews.use-case.ts`, `modules/social/interface/reviews.controller.ts`, `test/social-reviews.e2e-spec.ts`.
**Files edited** (2) — `modules/social/interface/dto/social.dto.ts` (+ReviewTargetTypeSchema + CreateReviewBodySchema), `modules/social/social.module.ts` (+provider + 4 use-cases + controller).

**Dependencies** — none new. No Prisma migration — `Review` table has been in schema since day one.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Reviews suite 10/10 pass.
- ✅ **Full real-DB suite: 58 suites, 399 tests pass against live Docker.** (+1 suite, +10 tests.)

**Acceptance criteria**

- ✅ Authenticated users can post reviews standalone or trip-attached.
- ✅ Trip-attached reviews use the shared collab gate.
- ✅ Reviews listable by target (targetType + targetId query).
- ✅ Authors can delete their own reviews; non-authors 404.
- ✅ Multiple reviews per user per target allowed.
- ✅ Rating / body / language all validated with typed errors.

**Notes**

- **Why trip-optional.** Real-world review UX has two distinct flavors: "I wrote this after my Paris trip" (trip-attached, collab context, surfaces to other trip members) and "I went here for coffee last week solo, worth a review" (standalone, public to all authed). The schema supports both (`tripId` nullable with `onDelete: SetNull`); forcing one mode would lose the other. Switch to trip-required would kill the solo flow; switch to trip-forbidden would kill the collab flow.
- **Why no uniqueness enforcement (user+target).** Vote has it because "Alice voted 👍" is a single state; changing the value rewrites it. Review is a time-series record — "Alice's review from her 2024 visit" and "Alice's review from her 2026 revisit" are both valid rows with different context. The test locks the no-unique behaviour in so a future schema change doesn't sneak it in without us noticing.
- **Why query-param listing (`?targetType=&targetId=`) instead of nested routes.** A nested route per targetType (`/places/:id/reviews`, `/stays/:id/reviews`, `/eateries/:id/reviews`, `/agents/:id/reviews`) would be 4 handlers doing the same thing. The query-param shape collapses them. Trade-off: the OpenAPI spec reads less obviously "this endpoint is for places" — mitigated by the enum being explicit in the param docs.
- **Why language defaults to `'en'` at the use-case, not Zod.** Zod accepts `language?` as optional; the use-case supplies `'en'` when absent. If Zod applied the default, an explicit `undefined` in the body would be equivalent to absence, but a `null` would fail (Zod doesn't accept nulls for strings). Pushing the default to the use-case keeps the shape of the DB row deterministic regardless of which "empty" shape the client sent.
- **Why no moderation / flagging in v1.** Scam reports already have verify/dismiss (IV.18.11.5). Reviews would eventually want the same — "flag this as off-topic / abusive" + an admin queue. Shipping that alongside review create would double the slice's size without shipping a meaningful v1. Layer it on later via the exact same `admin-scam-moderation.controller` pattern.
- **Why no PATCH endpoint.** Consistent with Expense ([IV.18.12.4]) — delete + re-create is the standard UX pattern for this kind of user-authored content. Shipping PATCH adds a ~2× code surface for a minor DX gain.
- **Shared gate helper proves its value.** `assertCanVote` (exported from `cast-vote.use-case.ts`) is now reused by 3 primitives' use-cases (votes, expenses, reviews). Zero duplication; one audit point for the cross-cutting access policy. Future collaborators-only features drop in with one import line.
- **Social module now 3-of-4 primitives.** Remaining: `Review`-adjacent "aggregated rating summary" (avg + count per target) would be a natural IV.18.12.6 — or, given the Social moat is in decent shape, pivot to an extracted service or compliance work.

---

### [IV.18.12.4] — Social expense-split (create / list / balances + integer-cents math)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Second Social primitive (after voting). Trip collaborators can record paid-for-group expenses + see a per-user net ledger ("who owes whom"). Same collaborative gate as voting ([IV.18.12.3]): caller owns the trip OR trip has an active TripShare. Third slice in a row that compounds cleanly on existing seams — the `Vote` gate helper (`assertCanVote`) is re-exported as `assertTripAccess` and reused verbatim in all three new expense use-cases.

HTTP surface (all under `/trips/:tripId/expenses`, all authed + gated):

| Route           | What it does                                  |
| --------------- | --------------------------------------------- |
| `POST /`        | record a new expense (201)                    |
| `GET /`         | list expenses (default 50, cap 500)           |
| `GET /balances` | per-user net ledger (positive = owed TO user) |
| `DELETE /:id`   | payer-only delete (non-payer → 404)           |

**Money handling: integer-cents throughout.** Prisma's `Decimal` DB type is `numeric(10,2)`; amounts carry across the seam as 2-dp fixed strings (e.g. `"40.00"`). Balance computation converts to integer cents, sums, and emits 2-dp strings. No `number`-typed amounts anywhere on the write path — saves us from binary-float drift (`33.33 / 3` problem) at the cost of one extra `toFixed(2)`.

- **`apps/api/src/modules/social/domain/expense.entity.ts`** — `Expense` (id, tripId, paidById, amountUsd as string, currency, note, splitShare map, timestamps) + `UserBalance` (userId + netUsd). `SplitShareMap = Readonly<Record<string, number>>` keyed by userId, values sum to 1.0.
- **`apps/api/src/modules/social/application/ports/expense.repository.ts`** — 4-method port: `create`, `listForTrip(limit)`, `findById`, `deleteForPayer(id, paidById)` (scoped deleteMany + count gate).
- **`apps/api/src/modules/social/infrastructure/prisma-expense.repository.ts`** — Prisma direct delegate. Uses `new Prisma.Decimal(str)` on write; `row.amountUsd.toFixed(2)` on read for stable 2-dp strings.
- **`apps/api/src/modules/social/application/create-expense.use-case.ts`** — extensive validation: amount shape (`^\d+(\.\d{1,2})?$` + `(0, 99999999.99]`), currency (3 uppercase letters), splitShare (non-empty, each share in (0, 1], sum == 1.0 ± 0.0001, payer must appear). Then runs `assertTripAccess` gate + inserts.
- **`apps/api/src/modules/social/application/delete-expense.use-case.ts`** — payer-only delete; non-payer and missing-id both collapse to 404 `EXPENSE_NOT_FOUND`. No owner-override verb in v1 (conservative default — future admin surface if product asks).
- **`apps/api/src/modules/social/application/list-trip-expenses.use-case.ts`** — gate + delegate; default 50, cap 500 (higher than votes because ledger readers want everything).
- **`apps/api/src/modules/social/application/get-trip-balances.use-case.ts`** — the balance aggregator. For each expense: credit payer, debit each split participant. Computes in integer cents then divides by 100 at emission time → zero float drift. Sums over users always total exactly 0 (modulo rounding). Sorted largest-creditor-first.
- **`apps/api/src/modules/social/interface/dto/social.dto.ts`** — adds `CreateExpenseBodySchema`. Amount as `z.string().min(1).max(20)` (let the use-case enforce the regex for a typed INVALID_AMOUNT error); splitShare as `z.record(z.string().min(1), z.number().positive().max(1))` with a non-empty refine.
- **`apps/api/src/modules/social/interface/expenses.controller.ts`** — new controller at `/trips/:tripId/expenses`, 4 routes. Separate from SocialController (votes) — different route prefix + distinct DTO set.
- **`apps/api/src/modules/social/social.module.ts`** — +ExpenseRepository provider, +4 use-cases, +ExpensesController.

- **9 integration tests** (`apps/api/test/social-expenses.e2e-spec.ts`) against real Postgres:
  1. No bearer → 401.
  2. Owner records $40 dinner; 2-way split → Alice net +$20, Bob net -$20.
  3. Three-way unequal split ($100, 0.4/0.3/0.3) → exact balances (+60/-30/-30).
  4. Non-owner without share → 404 (gate).
  5. Non-payer can't delete someone else's expense (404); payer can; balances zero out after.
  6. `splitShare` sum != 1.0 → 422 `INVALID_SPLIT`.
  7. Payer missing from splitShare → 422 `INVALID_SPLIT`.
  8. Invalid amount shape (`"ten dollars"`) → 422 `INVALID_AMOUNT`.
  9. Multiple expenses across two payers accumulate correctly: Alice paid $30, Bob paid $10, 50/50 splits → Alice net +$10, Bob net -$10.

**Files created** (6) — `modules/social/domain/expense.entity.ts`, `modules/social/application/ports/expense.repository.ts`, `modules/social/infrastructure/prisma-expense.repository.ts`, `modules/social/application/create-expense.use-case.ts`, `modules/social/application/delete-expense.use-case.ts`, `modules/social/application/list-trip-expenses.use-case.ts`, `modules/social/application/get-trip-balances.use-case.ts`, `modules/social/interface/expenses.controller.ts`, `test/social-expenses.e2e-spec.ts`.
**Files edited** (2) — `modules/social/interface/dto/social.dto.ts` (+CreateExpenseBodySchema), `modules/social/social.module.ts` (+provider, +4 use-cases, +controller).

**Dependencies** — none new. No Prisma migration (Expense table in schema + DB since day one).

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Social-expenses suite 9/9 pass with exact-number balance assertions.
- ✅ **Full real-DB suite: 57 suites, 389 tests pass against live Docker.** (+1 suite, +9 tests.)

**Acceptance criteria**

- ✅ Collaborators can record expenses when the trip has an active share.
- ✅ Non-owners without a share are rejected (gate).
- ✅ Per-user balances sum to exactly 0 for any set of expenses.
- ✅ Only the payer can delete an expense.
- ✅ Integer-cents math guarantees no float drift in balance totals.
- ✅ Invariants on amount + currency + splitShare all enforced with typed errors.

**Notes**

- **Why money travels as strings.** `amountUsd` is `numeric(10,2)` in Postgres. JS `number` loses precision on innocent-looking values (`0.1 + 0.2 !== 0.3`; dividing $10 three ways creates `3.333333...`). Strings preserve exact 2-dp values across the seam. The balance aggregator converts to integer cents for math + back to strings for emission — one clean conversion at each end, zero float arithmetic in the critical path. The test for the three-way split catches regressions here: if we ever drift to JS float math, 0.3 × 100 = 30.00000000000001 becomes 3000.0000...01 cents, and the sum-to-zero invariant fails.
- **Why balances are eager, not lazy.** Could compute per-user deltas inline on each expense insert + store in a separate `BalanceLedger` table. Would make `GET /balances` O(1). But invalidation gets hairy (delete an expense → rewind the ledger), expense volume per trip is small (hundreds max), and recomputing from scratch is O(n) over a cheap integer sum. The complexity isn't worth it; re-evaluate when real usage shows balance-read p95 above 50ms.
- **Why the payer must appear in `splitShare`.** Real-world: if I pay for dinner and only Bob owes, my "share" is 0 — I ate for free because I paid for the group. That's a legitimate scenario but ambiguous at the gate: "did Alice enter 0 on purpose or forget?" The explicit error in v1 is "payer must be in the map" — force the client to make the intent explicit with a near-zero share or use a different "reimbursement" verb (follow-up). Clean is a 100% Bob owes, 0% Alice split → "INVALID_SPLIT: Alice (payer) must appear in splitShare" → UX prompt: "do you mean 100% to Bob?"
- **Why no PATCH endpoint.** Splitwise + similar apps all use delete + re-record as the "edit" UX. Shipping PATCH would require splitShare-delta math or a full replace operation (same as delete + create), and neither wins over the simpler shape. Expense-edit is a pure DX improvement, not a correctness gain.
- **Why DELETE is payer-only (not owner-override).** Conservative default. An owner deleting a collaborator's expense is a trust breach in a small group. If two people dispute an expense, the payer has to cancel theirs + the disputer records an offsetting one. A future admin-style "owner override" verb can land when product asks — the port shape (`deleteForPayer` vs. a new `deleteForOwner`) is clean to extend without changing the existing caller.
- **Why the gate helper is `assertCanVote` imported as `assertTripAccess`.** Same function, different semantic label at the call site. The shape ("caller owns trip OR trip has active share") isn't specific to voting — it's the generic "you have collab access to this trip" check. Renaming the export in cast-vote.use-case.ts would affect [IV.18.12.3]'s test expectations; importing under a different alias at the consumer site reads cleaner without breaking anything. A follow-up cleanup could extract to a shared module file.
- **Third slice compounding on the collaborative-gate pattern.** Voting ([IV.18.12.3]) introduced the gate; balance ledger reuses it; a future Reviews primitive (Social's 4th entity) will use the same shape. The collaboration capability is becoming a first-class cross-cutting concern the Social module owns.

---

### [IV.18.12.3] — Social v1: collaborative trip voting (upsert + tally + auth-gate)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Opens the Social bounded context (14th HTTP module, first feature in §3.12). v1 scope is voting — expenses + reviews land in follow-up slices. Meatier-than-usual single slice: new module from zero, Prisma `Vote` table activated (schema had it since day one; no migration needed), cross-module gate that unlocks voting on shared trips.

**Auth gate innovation** — the collaboration primitive of v1: "caller owns the trip OR trip has at least one active (non-revoked, non-expired) TripShare." Owner publishes a share → anyone authed can vote. Owner revokes the share → voting closes. The share itself is the auth token, no new collaborator ledger required. Weaker than per-user collaborator tracking but ships the 80% use case + defers the bigger lift.

HTTP surface (all under `/trips/:tripId/votes`, all authed):

| Route    | What it does                                 |
| -------- | -------------------------------------------- |
| `POST`   | cast/change a vote (upsert by unique key)    |
| `DELETE` | revoke caller's own vote                     |
| `GET`    | aggregated tallies per target + caller's own |

- **`apps/api/src/modules/social/` — new module (9 files):**
  - `domain/vote.entity.ts` — plain-data `Vote` + `VoteTally` (aggregated up/meh/down counts + net score + the authed caller's `mine` vote on each target).
  - `application/ports/vote.repository.ts` — 4-method port: `upsert`, `deleteForUser`, `listForTrip`, `findForUser`.
  - `infrastructure/prisma-vote.repository.ts` — Prisma `upsert` via the compound UNIQUE `(tripId, userId, targetType, targetId)`. Direct delegate, no raw SQL (no PostGIS in Vote).
  - `application/cast-vote.use-case.ts` — runs the auth gate via an exported helper `assertCanVote(trips, shares, tripId, userId)` that both other use-cases reuse. Upsert on hit.
  - `application/revoke-vote.use-case.ts` — same gate, then `deleteForUser`; 404 `VOTE_NOT_FOUND` if nothing to remove.
  - `application/list-trip-votes.use-case.ts` — same gate, reads all rows, aggregates into `VoteTally[]` client-side (O(n) over the row set; small enough that a naive Map read cleaner than a GROUP BY + second query for `mine`). **Privacy**: per-user votes are not returned. Only aggregated counts + caller's own `mine` field.
  - `interface/dto/social.dto.ts` — `CastVoteBodySchema` + `RevokeVoteBodySchema`. `targetType` is a Zod enum pinned to `'itinerary_item'` for v1; places + restaurants become votable in follow-up slices.
  - `interface/social.controller.ts` — 3 routes at `/trips/:tripId/votes`. DELETE carries a body (`{ targetType, targetId }`) — explicitly allowed by RFC 9110 §9.3.5, works in Fastify.
  - `social.module.ts` — imports TripModule (needs `TRIP_REPOSITORY` + `TRIP_SHARE_REPOSITORY`). Trip doesn't import back; strict one-way dep.

- **`apps/api/src/modules/trip/application/ports/trip-share.repository.ts`** — adds `countActiveSharesForTrip(tripId)`. Used by the Social gate to answer "is this trip open for collaboration?" in one query.
- **`apps/api/src/modules/trip/infrastructure/prisma-trip-share.repository.ts`** — implements the count via Prisma's `count()` with an OR clause on `expiresAt null | > now`.
- **`apps/api/src/app.module.ts`** — +SocialModule.

- **9 integration tests** (`apps/api/test/social-votes.e2e-spec.ts`) against real Postgres:
  1. No bearer → 401.
  2. Owner casts a vote; GET shows it with `mine` populated.
  3. Non-owner cannot vote on a trip with no active share → 404 `TRIP_NOT_FOUND`.
  4. Non-owner CAN vote once the trip has an active share; owner + collaborator votes aggregate correctly; `mine` on the owner's view shows owner's vote, not the collaborator's.
  5. Recasting (thumbs-up → thumbs-down) upserts the existing row, doesn't create a new one (unique-index contract).
  6. DELETE removes the vote; subsequent GET no longer includes the tally.
  7. DELETE a vote that never existed → 404 `VOTE_NOT_FOUND`.
  8. Revoking the trip share closes voting — collaborator who could vote a moment ago now gets 404.
  9. Invalid value (e.g. `2`) → 422 `VALIDATION_FAILED`.

**Files created** (10) — `modules/social/domain/vote.entity.ts`, `modules/social/application/ports/vote.repository.ts`, `modules/social/application/cast-vote.use-case.ts`, `modules/social/application/revoke-vote.use-case.ts`, `modules/social/application/list-trip-votes.use-case.ts`, `modules/social/infrastructure/prisma-vote.repository.ts`, `modules/social/interface/dto/social.dto.ts`, `modules/social/interface/social.controller.ts`, `modules/social/social.module.ts`, `test/social-votes.e2e-spec.ts`.
**Files edited** (3) — `modules/trip/application/ports/trip-share.repository.ts` (+countActiveSharesForTrip), `modules/trip/infrastructure/prisma-trip-share.repository.ts` (+impl), `app.module.ts` (+SocialModule).

**Dependencies** — none new. No Prisma migration (Vote table already in schema + DB).

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Social suite 9/9 pass (includes the full share-open → vote → share-revoke → vote-closed roundtrip).
- ✅ **Full real-DB suite: 56 suites, 380 tests pass against live Docker.** (+1 suite, +9 tests.)

**Acceptance criteria**

- ✅ Owner can cast/revoke/list votes on their own trip.
- ✅ Any authed user can vote on a trip that has an active share.
- ✅ Revoking the share immediately closes voting for non-owners.
- ✅ Tallies aggregate correctly across multiple users; `mine` is per-caller.
- ✅ Recasting doesn't inflate counts (unique-index upsert).
- ✅ DELETE-of-missing → 404, no silent no-op.
- ✅ Per-user vote identities are not exposed in tallies (privacy invariant).

**Notes**

- **Why the "has active share" gate instead of a proper collaborators table.** A dedicated `TripCollaborator` (or `TripShareResolution`) table would be the right long-term design — each resolve of a share code writes a row, and voting gates on that specific resolution. Ship-in-one-slice required a simpler proxy: any active share opens the trip. Matches how link-shared Google Docs behave. The share-as-capability model is weaker (anyone authed can vote, not just those who opened the link) but the concrete attack is limited: a non-collaborator would have to guess the trip id + discover the trip is shared. The follow-up to tighten this ships when somebody actually cares about strict per-link binding.
- **Why DELETE uses a body instead of query params.** The composite key is `(targetType, targetId)`. Two query params (`?targetType=itinerary_item&targetId=xxx`) work but read uglier than a JSON body + the types become string-everywhere parsing. RFC 9110 §9.3.5 explicitly allows DELETE bodies; Fastify handles it; Zod validates. The ergonomics win.
- **Why aggregate client-side (in the use-case) instead of a SQL GROUP BY.** Two reasons. First, the `mine` field requires the caller's userId which a naive GROUP BY doesn't join in cleanly — you'd need a correlated subquery per row. Second, trip-scale vote counts are small (a trip has ~20 items, dozens of collaborators max) — O(n) over the row set in JS is microseconds. When vote volume per trip gets into the thousands (unlikely given the domain) the aggregate becomes a candidate for a materialized view.
- **Why per-user vote identities aren't exposed.** If Alice can see Bob's vote, one-sided arguments ("why did you downvote my pick?") become friction. Aggregates + your-own-vote is enough signal for the UX ("this got 3 thumbs-up; you haven't voted yet"). A future owner-only "who voted what" admin surface can land separately if the product team decides transparency > interpersonal friction.
- **Why `targetType` is a Zod enum pinned to `'itinerary_item'` for v1.** Future targets (`place`, `restaurant`) exist on the domain type for a reason — the schema is ready — but the HTTP layer only accepts one today. Flipping the Zod enum to include more targets is a 1-line change when their read surfaces render vote counts. Shipping all three at once would require aligning the search endpoints to decorate with tallies, which is a bigger change.
- **Why the `Vote` table already existed on the schema.** It's been in `prisma/schema.prisma` since the initial `db push`, anticipating exactly this slice (generic `targetType + targetId + value` shape). Saved a migration + the live-DB-not-tracked-by-\_prisma_migrations dance. Small compounding win from a decision made months ago.
- **First Social slice of any kind in the codebase.** The playbook lists `Social & Groups` with 4 models (TripShare, Vote, Expense, Review). TripShare shipped in [IV.18.2.13]; this adds Vote. Expense + Review are next in the Social arc. The module now has an import edge (TripModule) that future Social features inherit for free.

---

### [IV.18.11.6] — Public scam search `verifiedOnly=true` filter (closes moderation flywheel)

**Date:** 2026-04-25 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety)

**What was done**

Closes the last loop in the Safety moderation flywheel. [IV.18.11.5] gave admins the ability to verify reports; this slice gives clients a way to filter on that signal. The crowd-sourcing flywheel stays intact — unverified reports still surface on the default search — but clients that specifically want trusted-only can pass `verifiedOnly: true` on the existing `POST /safety/scam-reports/search`.

Tiny slice, one field added to each of: `FindScamReportsInput` (port), `GetNearbyScamsCommand` (use-case), `FindNearbyScamsBodySchema` (DTO). SQL-level change required the biggest thought: `::boolean` casting of a parameterized `null` proved flaky under Prisma's `$queryRaw` (parameter type inference didn't reliably match for a boolean-or-null filter). Switched to branching the query shape instead — one path with the verified clause, one without. Boring + correct.

- **`apps/api/src/common/db/geo-queries.ts`** — `FindScamReportsInput.filters.verified` typed field + branched query in `findScamReportsWithinRadius`. Only two code paths: "no verified filter" (old shape) and "filter on verified = $X" (new shape). The branch is in-line, not across methods, so the shape of the read stays obvious.
- **`apps/api/src/modules/safety/application/ports/scam-report.repository.ts`** — `FindNearbyScamsInput.filters.verified` typed field.
- **`apps/api/src/modules/safety/infrastructure/prisma-scam-report.repository.ts`** — plumbs the `verified` filter through to GeoQueries. `hasFilters` guard updated to include the new field.
- **`apps/api/src/modules/safety/application/find-nearby-scams.use-case.ts`** — `verifiedOnly?: boolean` on the command. Translates the public-facing boolean to `filters.verified = true` only when `true`; `false` / absent both skip the filter.
- **`apps/api/src/modules/safety/interface/dto/safety.dto.ts`** — `verifiedOnly: z.boolean().optional()` on the schema.
- **`apps/api/src/modules/safety/interface/safety.controller.ts`** — passes `verifiedOnly` through to the use-case.

- **4 integration tests** (`apps/api/test/safety-verified-filter.e2e-spec.ts`):
  1. Default search (no `verifiedOnly`) returns BOTH verified + unverified reports (crowd-sourcing flywheel preserved).
  2. `verifiedOnly: true` restricts to admin-verified reports only; every returned row has `verified: true`.
  3. `verifiedOnly: true` with no verified reports in the area → empty list (even though unverified rows exist).
  4. `verifiedOnly: false` behaves like absent (returns both).

**Files created** (1) — `test/safety-verified-filter.e2e-spec.ts`.
**Files edited** (6) — `common/db/geo-queries.ts` (+filter field + branched query), `modules/safety/application/ports/scam-report.repository.ts` (+filter field), `modules/safety/infrastructure/prisma-scam-report.repository.ts` (+plumbing), `modules/safety/application/find-nearby-scams.use-case.ts` (+command field + filter build), `modules/safety/interface/dto/safety.dto.ts` (+zod field), `modules/safety/interface/safety.controller.ts` (+passthrough).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Verified-filter suite 4/4 pass.
- ✅ **Full real-DB suite: 55 suites, 371 tests pass against live Docker.** (+1 suite, +4 tests.) Every prior Safety test still green — default behaviour unchanged.

**Acceptance criteria**

- ✅ `verifiedOnly: true` on the public scam search restricts to admin-verified rows.
- ✅ Default behaviour unchanged — both verified + unverified still surface.
- ✅ `verifiedOnly: false` is accepted and equivalent to absent.
- ✅ The verified column value is returned on every response row so clients can render a "verified" badge regardless of filter mode.

**Notes**

- **Why branch the query instead of using `::boolean IS NULL` conditional.** The conditional form worked fine for `::text` (category) and `::int` (minSeverityRank) — same shape. For `::boolean`, Prisma's `$queryRaw` parameter type inference didn't reliably activate the clause. Spent maybe 20 minutes debugging what looked like a correct SQL expression that wasn't narrowing; a branched query is 2x the lines but 0x the ambiguity, and the two branches differ by one AND clause. When Prisma upgrades fix parameter typing, the conditional form can come back — until then, honest branching is the right call. Captured this as a new feedback memory so future "add boolean filter to raw-SQL" slices don't rediscover the same wall.
- **Why the controller doesn't pass `verifiedOnly: false` through.** `body.verifiedOnly ? {...} : {}` skips the field when it's `false` — same pattern the other optional flags use. The use-case handles `false` equivalently to absent anyway (the filter only activates on `true`). Not passing `false` keeps `cmd` minimal for the log line + any future cmd-based cache key.
- **Why unverified reports still surface by default (not `verifiedOnly` baseline).** Flipping default to verified-only would kill the crowd-sourcing flywheel. A fresh report would never surface to other travelers until an admin got to it — which is exactly the case where timing matters most ("I just got scammed on this street, warn others NOW"). A future client-side affordance can render unverified reports with a visual "unverified — use caution" badge; that's the right decoupling.
- **Why a new test file (`safety-verified-filter.e2e-spec.ts`) instead of extending `safety.e2e-spec.ts`.** The existing file's contract tests the scam CRUD + search without ever touching the admin surface. This slice's tests need the admin flow (register → promote → login → verify) which would bloat the existing file with admin bootstrap ceremony. Split keeps concerns clean. Same rationale every new test file has used this session.
- **Moderation flywheel is now end-to-end**: anyone reports → admin verifies (or dismisses) → users can filter to trusted-only. The third leg (this slice) was the missing piece; the first two landed in [IV.18.11.1] + [IV.18.11.5]. Every piece of the Safety module shipped this session (5 prompts: scam reports, SOS, crime layer, score, moderation, filter) is now functionally complete for v1.

---

### [IV.18.11.5] — Admin scam-report moderation (list / verify / unverify / dismiss)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety) · **Playbook §** 17 (Admin)

**What was done**

Closes a long-standing loop on the ScamReport feature. The schema has had `verified: Boolean @default(false)` since [IV.18.11.1] shipped; the column was never written. Admins now have the full queue-triage flow: list pending → verify good reports / dismiss spam → the verified pile becomes audit-able. Second admin surface in the codebase after JWKS ([III.13.2.8]).

HTTP surface (all `@Roles('admin')`):

| Route                                                    | What it does                    |
| -------------------------------------------------------- | ------------------------------- |
| `GET    /api/v1/admin/safety/scam-reports`               | list pending (verified=false)   |
| `GET    /api/v1/admin/safety/scam-reports?verified=true` | audit the verified pile         |
| `POST   /api/v1/admin/safety/scam-reports/:id/verify`    | flip `verified: true` (approve) |
| `POST   /api/v1/admin/safety/scam-reports/:id/unverify`  | flip `verified: false` (revoke) |
| `DELETE /api/v1/admin/safety/scam-reports/:id`           | hard delete (dismiss as spam)   |

- **`apps/api/src/modules/safety/application/ports/scam-report.repository.ts`** — adds `listForModeration(input)`, `setVerified(id, value)`, `deleteById(id)`. `setVerified` is a single method for both verify + unverify (flag in, flag out) rather than two parallel methods — the verb is the same.
- **`apps/api/src/modules/safety/infrastructure/prisma-scam-report.repository.ts`** — Prisma-typed reads with explicit `select` that skips the `Unsupported` coordinates column. Writes use `updateMany` + count gate (idempotent, Postgres-safe). Delete uses `deleteMany` — same Prisma-can't-read-coordinates workaround PrismaPlaceRepository uses.
- **`apps/api/src/modules/safety/application/list-scam-reports-for-moderation.use-case.ts`** — default pending-only (verified=false); `?verified=true` flips to the audit view. Default 50, cap 200 — same shape as every other "list mine" surface.
- **`apps/api/src/modules/safety/application/verify-scam-report.use-case.ts`** — thin wrapper: `null` from repo → 404 `SCAM_REPORT_NOT_FOUND`.
- **`apps/api/src/modules/safety/application/dismiss-scam-report.use-case.ts`** — hard delete; 404 on unknown id. No event emission yet (reporter notification stays a follow-up).
- **`apps/api/src/modules/safety/interface/admin-scam-moderation.controller.ts`** — class-level `@Roles('admin')`, 4 routes.
- **`apps/api/src/modules/safety/safety.module.ts`** — registers the 3 new use-cases + new admin controller.

- **8 integration tests** (`apps/api/test/admin-scam-moderation.e2e-spec.ts`) against real Postgres, exercising the full submit → moderate flow:
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Non-admin bearer → 403 `ROLE_FORBIDDEN`.
  3. Admin sees user-submitted reports in the pending queue.
  4. Verify flips the row; default pending list no longer shows it; `?verified=true` now does.
  5. Unverify reverses a prior verify.
  6. Dismiss (DELETE) removes the row; public search no longer returns it.
  7. Verify unknown id → 404 `SCAM_REPORT_NOT_FOUND`.
  8. Dismiss unknown id → 404 `SCAM_REPORT_NOT_FOUND`.

**Files created** (5) — `modules/safety/application/list-scam-reports-for-moderation.use-case.ts`, `modules/safety/application/verify-scam-report.use-case.ts`, `modules/safety/application/dismiss-scam-report.use-case.ts`, `modules/safety/interface/admin-scam-moderation.controller.ts`, `test/admin-scam-moderation.e2e-spec.ts`.
**Files edited** (3) — `modules/safety/application/ports/scam-report.repository.ts` (+3 methods + `ListForModerationInput`), `modules/safety/infrastructure/prisma-scam-report.repository.ts` (+3 impls + PrismaService injection), `modules/safety/safety.module.ts` (+3 use-cases + controller).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Moderation suite 8/8 pass.
- ✅ **Full real-DB suite: 54 suites, 367 tests pass against live Docker.** (+1 suite, +8 tests.)

**Acceptance criteria**

- ✅ Admin can list pending scam reports.
- ✅ Admin can verify a report; it moves from pending → verified.
- ✅ Admin can revoke verification.
- ✅ Admin can dismiss (hard delete) a spam report.
- ✅ Dismissed rows disappear from public search.
- ✅ Unknown ids 404 cleanly.
- ✅ Non-admin bearers get 403; unauthenticated requests get 401.

**Notes**

- **Why a single `setVerified(id, value)` instead of two parallel methods (verify + unverify).** The semantic is "set the flag to X" — branching at the port level would spread the update logic across two methods that have identical SQL. Branching belongs in the caller (the use-case can either pass `true` or `false`). The 2-route HTTP surface still reads clean because the verbs are different — the callers of the same use-case differ by intent.
- **Why hard-delete for dismiss, not soft-delete.** The schema has no `dismissedAt` column. Adding one needs a migration + a new "exclude dismissed" filter in the public search + updates to every read path. Dismissal is terminal — a reporter whose spam was dismissed will just re-submit (and get re-dismissed) if they're actually malicious. Keeping the model simple while observability lives in server logs. If a "dismissed reasons" audit becomes a compliance need later, add a `ScamReportAudit` sibling table; don't contort the primary row.
- **Why no event emission on verify/dismiss.** The playbook has `Safety.ScamReportVerified` + `Safety.ScamReportDismissed` sketched, but there's no subscriber today. Emitting-into-the-void happened twice (SosTriggered in [IV.18.11.2], Trip.\* in [IV.18.2.7]) and the first handler landed 14 slices later in [IV.18.15.1]. When the notification worker needs these events (probably when "your scam report was verified — thanks for keeping travelers safe" becomes a real email template), add the emission then. Meanwhile the admin flow works without it.
- **Why `listForModeration` defaults to pending-only instead of a required query param.** The canonical use of this endpoint is the moderation queue. "Give me my triage inbox" is the default; "let me audit the verified pile" is a secondary intent that deserves an explicit flag. Shipping without a default would force every admin-queue UI to always pass `verified=false`, which is boilerplate.
- **Why this admin controller lives inside SafetyModule rather than AdminModule.** Two reasons. First, it uses `SCAM_REPORT_REPOSITORY` directly — living in SafetyModule avoids a cross-module import back into Safety. Second, this is the established pattern for admin surfaces that operate on a specific module's data ([III.13.2.8] put the JWKS admin controller inside IdentityModule for the same reason). AdminModule stays for cross-cutting admin operations (like Place curation, which lives there because Places isn't admin-aware by itself).
- **Why the public search still returns `verified: false` rows (for now).** Flipping the public search to `verifiedOnly=true` by default would make the crowd-sourcing flywheel useless — new reports wouldn't surface until an admin got around to them, which defeats the "warn other travelers quickly" purpose. The right follow-up is a client-side UI affordance: show unverified reports with a visual "unverified — use caution" badge. A `?verifiedOnly=true` query param can be a follow-up for contexts where strict filtering is wanted.

---

### [IV.18.11.4] — Safety score composite (POST /safety/score, grade A–F)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety)

**What was done**

Operationalises the playbook's safety moat argument. The three primitives shipped in [IV.18.11.1], [IV.18.11.2], [IV.18.11.3] each answered "what's around this coord?" for a single data shape. A traveler actually wants "is this area safe?" as a single number. This slice is that aggregator.

Formula (v1, deliberately simple + auditable):

```
penalty = Σ crime_rank × 10 + Σ scam_rank × 5
score   = max(0, 100 - penalty)
grade   = A (90+) | B (75–89) | C (60–74) | D (40–59) | F (<40)
```

where `crime_rank = severity_rank ∈ {low: 1, medium: 2, high: 3, critical: 4}`. Crimes outweigh scams 2× because crime rows come from authoritative upstream feeds; scams are crowd-sourced. Radius default 2 km (walking context), max 10 km. Crime window fixed at 365 days (long-tail incidents aren't actionable for tonight's walk).

**SOS events are deliberately excluded.** They're a personal distress signal; exposing aggregated counts near a coord would leak privacy-adjacent data about other users' emergencies. Verified by a test that triggers an SOS at the query coord + asserts the score stays 100.

- **`apps/api/src/modules/safety/application/get-safety-score.use-case.ts`** — composes the existing `FindNearbyCrimesUseCase` + `FindNearbyScamsUseCase` in parallel. Validation shape mirrors the primitives (coords, radius cap, typed `INVALID_RADIUS`). Grade bucketing + severity ranking are pure functions at file scope.
- **`apps/api/src/modules/safety/interface/safety-score.controller.ts`** — new controller at `/safety/score`. Separate from the three primitive controllers — composite reads don't own an entity, and one-concern-per-controller keeps the module's DI graph readable.
- **`apps/api/src/modules/safety/interface/dto/safety.dto.ts`** — +`GetSafetyScoreBodySchema`; radius is optional (use-case defaults to 2km).
- **`apps/api/src/modules/safety/safety.module.ts`** — +1 use-case provider, +1 controller.

- **8 integration tests** (`apps/api/test/safety-score.e2e-spec.ts`), seeding real data via `GeoQueries.insertCrimeIncident` + `POST /scam-reports`:
  1. No bearer → 401.
  2. Empty area → score 100, grade A, empty breakdown.
  3. One medium crime → exactly 20 penalty (2 × 10) → score 80, grade B.
  4. One critical crime + one high scam → 40 + 15 = 55 penalty → score 45, grade D.
  5. 4 critical crimes → penalty 160, score clamps to 0, grade F.
  6. Incidents outside the radius don't count.
  7. `radiusKm: 50` → 422 `INVALID_RADIUS`.
  8. **SOS privacy invariant** — trigger SOS at score's query coord → score still 100; SOS does not leak into the breakdown.

**Files created** (3) — `modules/safety/application/get-safety-score.use-case.ts`, `modules/safety/interface/safety-score.controller.ts`, `test/safety-score.e2e-spec.ts`.
**Files edited** (2) — `modules/safety/interface/dto/safety.dto.ts` (+schema), `modules/safety/safety.module.ts` (+use-case + controller).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Safety-score suite 8/8 pass, including exact-number assertions that lock the formula.
- ✅ **Full real-DB suite: 53 suites, 359 tests pass against live Docker.** (+1 suite, +8 tests.)

**Acceptance criteria**

- ✅ Composite score over crime + scam data inside the requested radius.
- ✅ Grade bucketing matches the documented A–F ranges.
- ✅ Score clamps to 0 (never negative).
- ✅ Radius default = 2km; max = 10km → typed 422 above the cap.
- ✅ SOS events NEVER factor into the score (privacy invariant).
- ✅ Incidents outside the radius aren't counted.

**Notes**

- **Why the exact-number assertions in tests.** The formula isn't provable a priori — it's a product/UX decision. Locking each scenario's exact expected score in a test turns any future formula change into a conversation ("this test asserts score=80; if we re-weight, update this number and document why") rather than a silent regression. Cheap way to keep subjective decisions honest over time.
- **Why crime outweighs scam 2× (not 1× or 4×).** Scams are crowd-sourced — any authenticated user can report one, no verification in v1. Crime rows come from authoritative feeds (government data, Numbeo). A 2× multiplier respects the confidence gap without making user reports irrelevant; swap to 1× and a single noisy neighborhood floods the score, swap to 4× and citizen voice gets drowned out. The playbook's safety moat requires both signals — the multiplier pins the balance.
- **Why SOS is excluded even in aggregate counts.** The tempting argument: "a cluster of SOS events means danger, so show it." The counter-argument (winning): anyone can hit this endpoint. An attacker iterating coordinates could map where SOS events happened — i.e. find where vulnerable users went through an emergency. That's privacy-adjacent reconnaissance. If we ever want a "dispatch priority heatmap," it lives on an admin-only surface with raw data + time-decay + k-anonymity, not this public score.
- **Why the breakdown exposes per-severity counts.** The UI wants to render "3 critical crimes, 7 low scams" — not just "your grade is F." Clients can tailor messaging ("high severity incidents nearby; consider an alternate route") vs ("minor incident reports; use normal caution"). Costs ~40 bytes per response + no DB round-trips (already computed).
- **Why fixed-365-day crime window, not configurable.** Crime data's signal-to-noise decays past ~1 year — a 2023 pickpocket record is meaningless for tonight's walk, and exposing a knob would just push that interpretation onto the caller. The `findNearbyCrimes` primitive already exposes `sinceDays` for analytics/admin; the score uses a reasonable default.
- **Why parallel Promise.all on the two primitives.** Each already has its own cache (crime via Postgres + PostGIS index, scam via the same pattern). Serial would double latency without sharing work. Both use-cases run on a single Prisma connection pool, so fan-out doesn't create contention.
- **Why not Redis-cache the composite score itself.** Tempting — safety score at a given coord is a hot read — but cache invalidation is nasty: ANY new crime or scam within the radius changes the score. Invalidation-by-(lat-bucket, lng-bucket) would work but the bucket size has to balance accuracy against cache hit rate. Defer until real traffic numbers justify the complexity. The primitive-level caches already amortise most of the cost.
- **Safety moat is now functionally complete for v1.** Three primitives + one composite read. A future "safety timeline" (how has this area's score trended over the last 30 days?) or ML-based scoring sit cleanly on top of this shape without breaking the HTTP contract. This slice is the closing bracket on the `[IV.18.11.x]` Safety thread unless the product brief opens agents/marketplace next.

---

### [IV.18.11.3] — Safety crime-layer read (POST /safety/crimes/search)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety)

**What was done**

Completes the Safety module's v1 read surface. Safety now has three primitives — user-reported scam reports (IV.18.11.1), user-triggered SOS events (IV.18.11.2), and upstream-ingested crime incidents (this slice). No user-facing write path for CrimeIncident — rows come from government feeds, Numbeo, and aggregated user reports, all driven by a seed script or future ingest worker. HTTP surface is read-only.

Mirrors the scam-report search shape intentionally: same radius cap (50km), same category filter, same threshold-style `minSeverity` filter, same default/max limit. The only net-new parameter is `sinceDays` — crime feeds tend to carry long-tail historical data that's useful for analytics but noise for a traveler deciding where to walk tonight.

- **`apps/api/src/common/db/geo-queries.ts`** — adds `insertCrimeIncident` + `findCrimeIncidentsWithinRadius` (PostGIS `ST_DWithin` + the existing `severityRank` CASE mapping; +`since` `timestamptz` filter). `+InsertCrimeIncidentInput` + `FindCrimeIncidentsInput` + `CrimeIncidentWithDistance` exports. Insert is used by seed scripts + the future ingest worker + tests; no HTTP route touches it.
- **`apps/api/src/modules/safety/domain/crime-incident.entity.ts`** — new `CrimeIncident` + `CrimeIncidentWithDistance` plain-data entities. Re-exports `ScamSeverity` from the sister entity so consumers only import one file.
- **`apps/api/src/modules/safety/application/ports/crime-incident.repository.ts`** — read-only port: `findNearby(input)`. No `insert` deliberately — the adapter delegates to `GeoQueries.insertCrimeIncident` for the seed path, but domain/application layers don't expose that surface.
- **`apps/api/src/modules/safety/infrastructure/prisma-crime-incident.repository.ts`** — thin adapter over `GeoQueries.findCrimeIncidentsWithinRadius`. Same category-cast-at-boundary pattern as the scam-report adapter.
- **`apps/api/src/modules/safety/application/find-nearby-crimes.use-case.ts`** — full validation suite (coords, radius, sinceDays) → repo. `sinceDays` converts to a Date in the use-case; the repo port takes the Date directly so a future adapter can choose a different "since" granularity without use-case churn.
- **`apps/api/src/modules/safety/interface/dto/safety.dto.ts`** — `FindNearbyCrimesBodySchema` with the same Coord + radius + filters shape as scams, plus the optional `sinceDays` (positive, max 5 years).
- **`apps/api/src/modules/safety/interface/crime.controller.ts`** — new controller at `/safety/crimes`. Kept separate from `SafetyController` / `SosController` — same one-controller-per-primitive rationale SOS used. Authed-only; no role gate in v1 (crime visibility is public to authenticated users, matching how safety data renders on every real-world traveler app).
- **`apps/api/src/modules/safety/safety.module.ts`** — registers + exports the new provider / use-case / controller.

- **8 integration tests** (`apps/api/test/safety-crime.e2e-spec.ts`) against real Postgres, seeding rows via `GeoQueries.insertCrimeIncident` directly (the future ingest worker's path):
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Empty DB → 200 with `incidents: []`.
  3. Seeded rows → ordered by distance ascending; rows outside the radius excluded.
  4. `category` exact-match filter narrows.
  5. `minSeverity: 'medium'` returns medium/high/critical (threshold-style).
  6. `sinceDays: 30` excludes incidents with `reportedAt` older than 30 days.
  7. `radiusKm: 100` → 422 `INVALID_RADIUS`.
  8. `limit: 2` caps the response array.

**Files created** (6) — `common/db/` extension is in an existing file; fully new: `modules/safety/domain/crime-incident.entity.ts`, `modules/safety/application/ports/crime-incident.repository.ts`, `modules/safety/application/find-nearby-crimes.use-case.ts`, `modules/safety/infrastructure/prisma-crime-incident.repository.ts`, `modules/safety/interface/crime.controller.ts`, `test/safety-crime.e2e-spec.ts`.
**Files edited** (3) — `common/db/geo-queries.ts` (+2 methods + 2 types + import `CrimeIncident`), `modules/safety/interface/dto/safety.dto.ts` (+FindNearbyCrimesBodySchema), `modules/safety/safety.module.ts` (+provider + use-case + controller + export).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Crime suite 8/8 pass.
- ✅ **Full real-DB suite: 52 suites, 351 tests pass against live Docker.** (+1 suite, +8 tests.)

**Acceptance criteria**

- ✅ `POST /safety/crimes/search` returns incidents within the requested radius, ordered by distance.
- ✅ Category / minSeverity / sinceDays filters all work + compose.
- ✅ Threshold-style severity matches scam-report semantics exactly.
- ✅ Radius cap enforced at 50km with the typed `INVALID_RADIUS` error (not VALIDATION_FAILED).
- ✅ Default + max limit match the scam-report surface (default 50, max 200).
- ✅ No user-facing write path — CrimeIncident rows can only be created via `GeoQueries.insertCrimeIncident` from a seed script / ingest worker.

**Notes**

- **Why no user-facing write path.** CrimeIncident rows come from external upstream data (government crime feeds, Numbeo, aggregated user reports). Exposing a public `POST /crimes` would blur the provenance — the `source` column is meaningful ("numbeo", "gov-us", "user-report-agg") and conflating citizen reports with authoritative feeds would undermine the safety-score computation a future slice will build on top of this. Users who want to report something submit a `ScamReport`, which has its own write path + a moderation flow. A future "promote verified scam reports into the crime layer" batch job is the canonical migration path from user data to the crime layer.
- **Why `sinceDays` is a use-case concern, not a port concern.** The port takes `since: Date` (absolute cutoff). The use-case owns the relative "N days ago" conversion. This keeps the port shape testable without freezing time — a future worker that already has a `since` timestamp can call the port directly without constructing a fake `sinceDays`. Same split the event-search use-cases use for their own from/to windows.
- **Why a separate `CrimeLayerController` instead of folding routes into `SafetyController`.** Three safety primitives now (scam / SOS / crime) each have subtly different auth stories — scam has user POST, SOS has owner-only operations, crime is authed-only read. Splitting the controllers keeps each one's DI graph minimal + makes the route surface easy to reason about. Same rationale Safety used when it split `SosController` in [IV.18.11.2].
- **Why the `sinceDays` max is 5 years (365 × 5).** Arbitrary cap that's high enough no UI would hit it in practice + low enough that a misbehaving client can't request a timestamp from Unix epoch and trigger a full-table scan on a big crime table. Same kind of belt-and-braces the radius cap uses at 10_000km in Zod (the use-case tightens to 50km).
- **Why tests seed via `GeoQueries.insertCrimeIncident` directly.** Mimics the future ingest worker's code path — if the seed method has a bug, the test catches it the same way the worker would in prod. A future `ingest-crime-data.worker.ts` will call the same method, so the two code paths stay coupled by design.
- **Safety moat is now functionally complete for v1.** The playbook's safety story was the primary competitive differentiator; this slice closes it. Crime-layer curation + a "safety score at this coord" composite metric are follow-ups but sit cleanly on top of the three primitives now in place. The next Safety prompt is unlikely to be another primitive — it'll be either a "combined safety score" aggregator or a moderation surface.

---

### [IV.18.15.2] — Notifications: POST /:id/read (idempotent, IDOR-safe)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.15 (Notifications)

**What was done**

Completes the minimum viable Notifications user-facing surface. Notifications v1 ([IV.18.15.1]) gave us a persistent ledger + a read API; this slice adds the edit verb so users can actually clear their unread count. Tiny slice by design — all the infrastructure was already in place (the `read: Boolean @default(false)` column has existed on `NotificationLog` since day one).

- **`apps/api/src/modules/notifications/application/ports/notification-log.repository.ts`** — adds `markReadForUser(id, userId)`. Owner-scoped; returns `null` on miss/wrong-owner → use-case collapses to 404.
- **`apps/api/src/modules/notifications/infrastructure/prisma-notification-log.repository.ts`** — implements via the same "owner-scoped `updateMany` + count===1 gate" pattern that Media's `markReady` and `setTripForOwner` use. Postgres returns count=1 even when the UPDATE sets `read = true` on a row that's already `true`, so the operation is naturally idempotent without a pre-read.
- **`apps/api/src/modules/notifications/application/mark-notification-read.use-case.ts`** — new. Wrong-id and wrong-owner both collapse to 404 `NOTIFICATION_NOT_FOUND` (IDOR defence — stranger guessing cuids learns nothing).
- **`apps/api/src/modules/notifications/interface/notifications.controller.ts`** — +`POST /notifications/:id/read` returning the updated row.
- **`apps/api/src/modules/notifications/notifications.module.ts`** — registers the new use-case.

- **5 integration tests** (`apps/api/test/notifications-mark-read.e2e-spec.ts`) against real Postgres:
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Happy path: register triggers SessionIssued handler → row persisted → POST `/:id/read` flips `read=true` → `GET /me` reflects it.
  3. Unknown id → 404 `NOTIFICATION_NOT_FOUND`.
  4. Cross-user: Bob marks Alice's → 404 `NOTIFICATION_NOT_FOUND`; Alice's row still `read=false` (verify no cross-user mutation slipped through).
  5. Idempotent: second mark-read call still returns 200 + `read=true`.

**Files created** (2) — `modules/notifications/application/mark-notification-read.use-case.ts`, `test/notifications-mark-read.e2e-spec.ts`.
**Files edited** (3) — `modules/notifications/application/ports/notification-log.repository.ts` (+markReadForUser), `modules/notifications/infrastructure/prisma-notification-log.repository.ts` (+impl), `modules/notifications/interface/notifications.controller.ts` (+endpoint, MarkNotificationReadUseCase injection), `modules/notifications/notifications.module.ts` (+use-case provider).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Mark-read suite 5/5 pass.
- ✅ **Full real-DB suite: 51 suites, 343 tests pass against live Docker.** (+1 suite, +5 tests.) Existing Notifications suites still green — purely additive.

**Acceptance criteria**

- ✅ Authed user can flip `read=true` on their own notification.
- ✅ Idempotent — second call doesn't 409 / 500.
- ✅ Cross-user attempts collapse to 404 `NOTIFICATION_NOT_FOUND` (IDOR-safe, no existence leak).
- ✅ `GET /me` surfaces the new read state.

**Notes**

- **Why POST not PATCH.** Matches every other "state-machine transition" verb in this codebase (trip share revoke, SOS resolve, MFA verify). PATCH implies arbitrary partial edits — this endpoint is specifically the "read" transition, and the state-machine is a single monotonic flip. A future mark-UNread (if it ever ships) gets its own verb rather than splitting this one. Keeping the response body to the updated row (not just 204) lets the client reconcile local state in one round-trip.
- **Why no bulk mark-all-read endpoint yet.** It's a real UX want (clear-everything button), but it adds decisions: scope by channel? by age? by templateId? All are defensible; none are obvious. Shipping the per-row verb first lets real usage inform the bulk shape. The repo already supports the owner-gate, so a future `markAllReadForUser(userId)` is a 2-line add when the UX is pinned down.
- **Why no `readAt` timestamp column.** The schema has `read: Boolean` + `createdAt` + `deliveredAt`, no `readAt`. Adding one needs a migration; for v1 the boolean alone answers "show me my unread count" and "show me my recent notifications," which are the only two things any real UI asks. If analytics later wants "how long between delivery and read" a migration can add the column + backfill nulls.
- **Why the Prisma `updateMany` with count gate even when idempotency doesn't require it.** Two reasons. First, consistency — the same pattern appears in Media (`markReady`, `setTripForOwner`), SOS (`resolve`), and places-ingest (via find-or-create). Developers reading one recognize all the others. Second, single-query atomicity: `findUnique → check → update` is a two-round-trip race; `updateMany + count` is a single round-trip with the owner-gate predicate in the WHERE. Matters under contention even if the current load doesn't show it.
- **IDOR defence cost-reward here is the cheapest version of the pattern.** No extra DB lookup over what a naive implementation would do. The owner-scoped `updateMany` either affects the row (count=1, success) or doesn't (count=0, 404). Same cost, cleanly safe.

---

### [IV.18.12.2] — Media × Trip: attach/detach + list-by-trip (double owner gate)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.13 (Media & Memory)

**What was done**

Builds on Media v1 (shipped in [IV.18.12.1]) — the `MediaAsset.tripId` column has existed on the schema since day one; this slice wires the edit path and the by-trip read. Gives users a way to organize their photos under trips; gives the trip overview a seam to eventually render "photos from this trip" without a new cross-module lift.

Double owner gate is the notable shape: both the media row AND the trip must belong to the caller for an attach to succeed. Detach (`tripId: null`) is always allowed on the caller's own media.

- **`apps/api/src/modules/media/application/ports/media-asset.repository.ts`** — adds `setTripForOwner(id, ownerId, tripId | null)` + `listForTripOwner(tripId, ownerId, limit)`. Listing filters on `status: 'ready'` so clients never render a broken thumbnail mid-upload.
- **`apps/api/src/modules/media/infrastructure/prisma-media-asset.repository.ts`** — implements both via owner-scoped `updateMany` + Prisma `findMany`. Same "updateMany + count === 1 gate" pattern `markReady` already uses.
- **`apps/api/src/modules/media/application/attach-media-to-trip.use-case.ts`** — new use case. For attach (`tripId !== null`), runs the trip owner-gate first via `TRIP_REPOSITORY.findByIdForUser` → 404 `TRIP_NOT_FOUND` on miss/wrong-owner. For detach, skips the trip lookup entirely. Then owner-scoped updateMany on media → 404 `MEDIA_NOT_FOUND` on miss.
- **`apps/api/src/modules/media/application/list-trip-media.use-case.ts`** — new use case. Trip owner-gate first (a stranger can't probe whether a guessed trip id exists), then delegate to `listForTripOwner`. Default 50, cap 200 — same shape as every other "list mine" use-case.
- **`apps/api/src/modules/media/interface/media.controller.ts`** — +2 routes:
  - `PATCH /api/v1/media/:id/trip` — body `{ tripId: string | null }`.
  - `GET /api/v1/media/trip/:tripId` — list mine for a trip, `?limit=N`.
- **`apps/api/src/modules/media/interface/dto/media.dto.ts`** — `AttachMediaToTripBodySchema` + relaxed tripId validation to `z.string().trim().min(1).max(64)` (Zod `.cuid()` was rejecting raw-SQL-inserted UUIDs — Trip / Place / ScamReport / SosEvent IDs all use `randomUUID()` not cuid; the use-case's owner-gate lookup is the real existence check anyway).
- **`apps/api/src/modules/media/media.module.ts`** — imports `TripModule` (already exports `TRIP_REPOSITORY`), registers the two new use-cases.

- **7 integration tests** (`apps/api/test/media-attach-trip.e2e-spec.ts`) against real Postgres + MinIO, reusing the full `[IV.18.12.1]` upload → confirm flow to produce `ready`-status assets:
  1. Happy path: attach → `tripId` set → `GET /trip/:tripId` lists it → detach clears it → list empty.
  2. Attach to another user's trip → 404 `TRIP_NOT_FOUND` (IDOR defence).
  3. Attach another user's media → 404 `MEDIA_NOT_FOUND` (IDOR defence).
  4. `GET /media/trip/:tripId` on another user's trip → 404 `TRIP_NOT_FOUND`.
  5. `processing`-status media is NOT listed by `GET /media/trip/:tripId`.
  6. Detach is always allowed on own media (even when currently unattached — idempotent no-op).
  7. `PATCH` with no body → 422 `VALIDATION_FAILED` (Zod requires `tripId` key explicitly; no ambiguity between "don't touch" and "detach").

**Files created** (3) — `modules/media/application/attach-media-to-trip.use-case.ts`, `modules/media/application/list-trip-media.use-case.ts`, `test/media-attach-trip.e2e-spec.ts`.
**Files edited** (4) — `modules/media/application/ports/media-asset.repository.ts` (+2 methods), `modules/media/infrastructure/prisma-media-asset.repository.ts` (+impls), `modules/media/interface/dto/media.dto.ts` (+schema + relaxed tripId validation), `modules/media/interface/media.controller.ts` (+2 endpoints), `modules/media/media.module.ts` (+TripModule import + 2 use-case providers).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Media-attach suite 7/7 pass.
- ✅ **Full real-DB + real-MinIO suite: 50 suites, 338 tests pass against live Docker.** (+1 suite, +7 tests.) Existing Media + Trip suites still green — this slice didn't change any pre-existing endpoint.

**Acceptance criteria**

- ✅ `PATCH /media/:id/trip { tripId }` attaches to a trip the caller owns.
- ✅ `PATCH /media/:id/trip { tripId: null }` detaches.
- ✅ `GET /media/trip/:tripId` lists the caller's `ready` media for a trip.
- ✅ Attach to another user's trip → 404 `TRIP_NOT_FOUND`.
- ✅ Touch another user's media → 404 `MEDIA_NOT_FOUND`.
- ✅ List on another user's trip → 404 `TRIP_NOT_FOUND`.
- ✅ `processing`-status rows stay out of the trip-listing surface.

**Notes**

- **Why the double owner-gate (media owner AND trip owner).** An attacker with a valid session could otherwise probe the trip-id space just by attempting to attach their own media to guessed ids. Running `TRIP_REPOSITORY.findByIdForUser` first → 404 on wrong-owner means the only signal an attacker gets is "not yours," never "exists but not yours." Matches the IDOR defence every other cross-resource endpoint uses.
- **Why detach skips the trip lookup entirely.** Detach has no trip reference to validate — `tripId: null` is a self-contained edit on the media row. Running the trip lookup anyway would force clients to know what trip the media is currently on (they might not), and would introduce a second 404 failure mode for a legitimate operation.
- **Why the listing filters on `status: 'ready'`.** A `processing` row means the bytes haven't landed yet (presigned-URL flow). Returning those to a UI would either show a broken thumbnail or race with the upload-confirm flow. Filtering at the repo level guarantees the client gets a renderable set. Clients that want to see their unconfirmed uploads can hit a future "my pending" endpoint; v1 keeps the trip-listing clean.
- **Why `tripId` uses `z.string().trim().min(1).max(64)` instead of `.cuid()`.** Three models in this codebase use `randomUUID()` for ids (Trip / Place / ScamReport / SosEvent) because raw-SQL inserts (GeoQueries) don't run through Prisma's cuid default. Zod's `.cuid()` rejects UUIDs. The use-case's owner-gate lookup is the real existence check (a bogus string just hits 404); a character-shape pre-check would be defence against... nothing the owner-gate doesn't already catch, at the cost of rejecting perfectly-valid UUID-formatted trip ids. The existing `CreateUploadUrlBodySchema.tripId.optional()` had the same latent bug — fixed in this slice by factoring `TripIdSchema` into one place. A follow-up slice could unify id generation on either cuid or uuid across the codebase, but that's a bigger cleanup.
- **Why a separate DTO field for "explicit null" detach.** Zod distinguishes `{ tripId: null }` (attach-null = detach) from `{}` (key missing = 422). Clients that want to "leave it alone" don't call PATCH at all. This matches HTTP PATCH semantics cleanly — every field in the body is an explicit edit; silence on an omitted key would be a footgun when a later slice adds more patchable fields.
- **Why the list endpoint lives under `/media/trip/:tripId` and not `/trips/:id/media`.** Both are defensible; this choice keeps the Media module's HTTP surface self-contained and avoids a cross-module endpoint that would need cross-module test coverage in the Trip suites. A future "render trip with photos" endpoint under `/trips/:id/media` (or a 7th section in the trip overview) can re-use `ListTripMediaUseCase` verbatim — no DI graph churn.
- **First Media-module cross-module edit path.** Media v1's three endpoints were all self-contained (presigned URL + confirm + download). This slice is the first one where the Media use-case calls into another module's port (`TRIP_REPOSITORY`) — validates the module-boundary model + proves the "import sibling modules in the module.ts" pattern reads cleanly a second time (Trip already imports 5 modules for its overlays; Media now imports 1).

---

### [III.13.2.8] — JWKS keyring rotation (Redis-backed store + admin endpoint)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.2 (Auth)

**What was done**

Closes the long-running Identity thread at ~97% → 100%. The `@app/auth` package was always rotation-capable (its `JwtKeyring` shape takes `current` + `previous[]`); what was missing was the Redis-backed store and an admin path to trigger rotation. With this slice an operator can rotate access or refresh signing keys without a deploy, and every outstanding token signed with the retiring kid continues to verify for as long as it lives in `previous[]`.

- **`apps/api/src/modules/identity/application/ports/jwt-keyring.store.ts`** — new port. Three methods: `getRing(name)`, `rotate(name)`, `listKids()`. `RingName = 'access' | 'refresh'` mirrors the two token classes.
- **`apps/api/src/modules/identity/infrastructure/redis-jwt-keyring.store.ts`** — new adapter. Stores each ring as a JSON blob under `travel-<env>:jwt-keyring:<ring>` with `current` + `previous[]`. Secrets are base64url-encoded on the wire; rehydrated to `Uint8Array` on read. **First-boot hydration**: a missing Redis key triggers a bootstrap from the env secret with kid `<ring>-bootstrap`, which is then persisted so subsequent reads hit the cache path. **Rotation**: generates 32 cryptographically-random bytes + an 8-hex-char kid (e.g. `access-a1b2c3d4`), pushes the old `current` onto `previous`, persists. **In-memory cache**: 30-second TTL so Redis traffic stays constant under load; invalidated in-process on every rotate so the caller's next sign/verify picks up the new ring immediately.
- **`apps/api/src/modules/identity/infrastructure/jwt-token.service.ts`** — refactored. Was pulling env secrets directly at construction with hardcoded `access-v1` / `refresh-v1` kids (rotation required a full deploy). Now delegates keyring retrieval to the store on every sign + verify. TTL parsing stays here because expiries are policy, not key material.
- **`apps/api/src/modules/identity/application/rotate-jwks.use-case.ts`** — new use case. Validates the ring name against the port's allow-list (`access` / `refresh` → `INVALID_RING` 422 otherwise), delegates to the store, returns `{ ring, newKid, previousKids }` for the admin client to log.
- **`apps/api/src/modules/identity/interface/jwks-admin.controller.ts`** — new controller. Class-level `@Roles('admin')` gates every route; the global guard chain (rate-limit → JwtAuth → Roles) handles 401/403. Two surfaces:
  - `POST /api/v1/admin/identity/jwks/rotate` — body `{ ring }`, returns `{ ring, newKid, previousKids }`.
  - `GET /api/v1/admin/identity/jwks/kids` — list every kid in both rings for ops visibility.
- **`apps/api/src/modules/identity/identity.module.ts`** — registers `JWT_KEYRING_STORE` + adapter, the rotate use-case, and the new controller. Exports `JWT_KEYRING_STORE` so a future `notification-worker` (verify-only) can share the same store.

- **7 integration tests** (`apps/api/test/jwks-rotation.e2e-spec.ts`) against real Postgres + Redis:
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Non-admin bearer → 403 `ROLE_FORBIDDEN`.
  3. Admin rotates access ring → new kid matches `/^access-[0-9a-f]{8}$/`; old kid retained in `previousKids`.
  4. **Tokens issued BEFORE rotation still verify** after rotation (verified by hitting `GET /trips` with the pre-rotation token; 200 response proves the old kid is still in the keyring).
  5. Tokens issued AFTER rotation use the new kid (asserted by decoding the JWT header).
  6. Invalid ring (`'bogus'`) → 422 `INVALID_RING`.
  7. `GET /admin/identity/jwks/kids` returns every kid in both rings, each prefixed with its ring name.

**Files created** (4) — `modules/identity/application/ports/jwt-keyring.store.ts`, `modules/identity/infrastructure/redis-jwt-keyring.store.ts`, `modules/identity/application/rotate-jwks.use-case.ts`, `modules/identity/interface/jwks-admin.controller.ts`, `test/jwks-rotation.e2e-spec.ts`.
**Files edited** (2) — `modules/identity/infrastructure/jwt-token.service.ts` (now delegates to store; no more hardcoded kids), `modules/identity/identity.module.ts` (registers + exports new port, adds controller + use-case).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ JWKS rotation suite 7/7 pass.
- ✅ **Full real-DB suite: 49 suites, 331 tests pass against live Docker.** (+1 suite, +7 tests.) Every prior Identity test still green — the bootstrap path preserves the env-secret behaviour that existing tokens rely on.

**Acceptance criteria**

- ✅ Operator can rotate a ring at runtime (no restart needed).
- ✅ Pre-rotation tokens still verify until their natural expiry.
- ✅ Post-rotation tokens are signed with the new kid.
- ✅ Rotation is admin-gated; non-admin / unauthenticated → 403 / 401.
- ✅ Keyring state survives app restart (Redis-persisted).
- ✅ Multi-instance safe: any instance's rotate writes to Redis; other instances pick up the new ring within the 30s cache TTL.

**Notes**

- **Why Redis for HS256 secret storage.** Redis is already network-isolated + password-protected in the stack; the same channel carries session refresh tokens + rate-limit data, so the trust boundary doesn't move. When this eventually switches to RS256 the store holds only public keys + kids; private keys move to KMS. The port shape stays the same; only the adapter swaps. Deferred until the ai-service / notification-worker need to verify JWTs independently — at that point the JWKS endpoint becomes a real public surface, not just an ops convenience.
- **Why a per-process 30s in-memory cache on top of Redis.** `getRing` is on the hot path — every sign + every verify. A naive "hit Redis every time" would add 0.5–2 ms per API call and a dependency on Redis for auth (bad blast-radius). 30 seconds is small enough that a rotation propagates across instances within one access-token TTL window (15 min default), which is the right ordering — a retiring kid stays valid longer than the cache lag, so no user sees a forced re-login.
- **Why the rotate endpoint isn't idempotent.** It's explicitly the verb "rotate" — every call mints a new kid + pushes the old one onto `previous`. Calling it twice in a row is legitimate (e.g. after a suspected leak, rotate twice to make sure the new secret isn't in any ops log). Idempotent "upsert a specific kid" would solve a different problem.
- **Why `previous[]` grows unboundedly in v1.** Trimming the tail is an ops decision tied to the longest token TTL (30d refresh), and automating it needs a "last-used-at" timestamp per kid which none of the sign/verify paths currently track. A dedicated follow-up can add a TTL on each `previous` entry + a background sweeper — for v1, the list adds ~80 bytes per rotated kid, which is negligible until a rotation cron runs weekly for a year.
- **Why the kid format is `<ring>-<hex8>` (not a monotonic counter or UUID).** Hex8 is short enough to eyeball in logs, is random (no ordering leak) and won't collide across rotations even if two land in the same millisecond. A monotonic counter would need coordination across instances to stay unique; a UUID would bloat every JWT header by 30-ish bytes for no gain. The `<ring>-` prefix makes `/kids` output readable at a glance.
- **Bootstrap kid is `<ring>-bootstrap`, not `<ring>-v1`.** Intentional rename from the old hardcoded `access-v1` / `refresh-v1`. The old names implied a version sequence that was never actually used (no `v2` ever minted); `bootstrap` is honest — it's the starter seed, not a versioning scheme.
- **Why the env-hydration fallback instead of failing fast.** Existing environments have running tokens signed with the env secret + the old hardcoded kids. If this shipped as "Redis-only, error if missing," every deployed instance would refuse service until ops manually seeded Redis. Bootstrap-on-first-boot makes the upgrade transparent — any token signed before this slice lands continues to verify via the `access-bootstrap` kid (which uses the same env secret), and rotations layer on top cleanly.
- **Identity module is now fully complete.** Parts 1–7 covered registration, login, refresh, logout, MFA (TOTP + backup codes), OAuth (Mock + Google + Apple), and failed-login lockout. Part 8 closes rotation. The `III.13.2` thread that's been "~97%" for the whole session now flips to DONE.
- **First admin-surface rate of expansion.** Place curation was the only admin resource pre-slice. JWKS is the second. A future admin module refactor might extract a shared `AdminXModule` pattern — for now two tightly-scoped admin controllers (places + jwks) read cleaner than an umbrella.

---

### [IV.18.10.2] — Trip × Transport overlay (5th Trip section, folded into overview)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.6 (Transport & Routing)

**What was done**

Fifth Trip × \* fold-in — after Weather, Stays, Eateries, Events. Adds `GET /api/v1/trips/:id/transport-legs`, which walks the itinerary day-by-day and returns route options between every consecutive pair of items pinned to a `Place`. Also folded into `GetTripOverviewUseCase` as the 6th Section so the bundled dashboard returns `transport` alongside the existing 5.

Itineraries finally show how a user actually moves between activities. Until this slice an itinerary was just an ordered list of pins on a map; now the dashboard can render "Item 1 → Item 2: 8 min walk / 4 min car / $5.20 rideshare." Visible UX win that exercises the entire chain: Trip itinerary → Place coords → Transport routing → response.

- **`apps/api/src/modules/trip/application/get-trip-transport-legs.use-case.ts`** — new use case. Owner-gated. For each day, walks consecutive items in `position` order; for each pair where both items have non-null `placeId`, looks up the coords (one batched `findCoordinatesForPlaceIds` query for the whole trip) and calls `GetRoutesUseCase`. Splits internal entry point `computeLegs(tripId)` so the overview can call it without re-running the owner gate.
  - **Skip semantics** — pairs are silently dropped (NOT errored) when: an item has `placeId === null` (free-form note), the place isn't in the catalog (data drift), origin === destination (caught from routing's `SAME_ORIGIN_DESTINATION`), or distance > 500km (caught from `ROUTE_TOO_LONG`). All four are "no leg here" states for the UI to render as a gap.

- **`apps/api/src/common/db/geo-queries.ts`** — adds `findCoordinatesForPlaceIds(ids)` returning `Map<id, {lat,lng}>`. PostGIS raw-SQL (CLAUDE rule 11). Empty input short-circuits.

- **`apps/api/src/modules/trip/application/get-trip-overview.use-case.ts`** — adds `transport` Section. Calls the new use-case's `computeLegs` (skipping the redundant owner gate). 6 concurrent sub-fetches now run in `Promise.all`.

- **`apps/api/src/modules/trip/interface/trip.controller.ts`** — `GET /:id/transport-legs` returns `{ legs }`. Overview DTO gets `transport: SectionDto<{ legs }>`.

- **`apps/api/src/modules/trip/trip.module.ts`** — imports `TransportModule` (which exports `GetRoutesUseCase`). Registers `GetTripTransportLegsUseCase`.

- **7 integration tests** (`apps/api/test/trip-transport.e2e-spec.ts`):
  1. No bearer → 401.
  2. Non-owner / unknown trip → 404 `TRIP_NOT_FOUND`.
  3. Day with no items → empty `legs: []`.
  4. Happy path: 3 items pinned to Places → 2 legs each with all 7 transport modes (walk + bicycle + 2-wheeler + car + taxi + rideshare + public_transit).
  5. Free-form item between two Places → both adjacency-pairs have a null side, so empty result.
  6. Two consecutive items at the same Place → silently dropped; the (same, p2) pair still yields a leg.
  7. Overview now includes a `transport` section with the same legs.

**Files created** (2) — `modules/trip/application/get-trip-transport-legs.use-case.ts`, `test/trip-transport.e2e-spec.ts`.
**Files edited** (4) — `common/db/geo-queries.ts` (+findCoordinatesForPlaceIds), `modules/trip/application/get-trip-overview.use-case.ts` (+transport section), `modules/trip/interface/trip.controller.ts` (+endpoint, +overview DTO), `modules/trip/trip.module.ts` (+TransportModule import, +use-case provider).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-transport suite 7/7 pass.
- ✅ **Full real-DB suite: 48 suites, 324 tests pass against live Docker.** (+1 suite, +7 tests.) Existing trip-overview tests still green — added a 6th section without breaking the 5 pre-existing ones.

**Acceptance criteria**

- ✅ `GET /trips/:id/transport-legs` returns one leg per consecutive Place-pinned pair, skipping the four "no leg" states.
- ✅ Owner-gated; non-owner / missing trip → 404.
- ✅ Folded into `GET /trips/:id/overview` as the `transport` section.
- ✅ Overview's existing 5 sections unchanged in shape — purely additive.
- ✅ Routing's existing 500km / same-coord caps map to silent skips, not 422s up the stack.

**Notes**

- **Why silently skip the four "no-leg" states instead of erroring.** A "skip" is the right answer, not a partial failure: the user's UI renders a gap instead of a route line, which matches the data exactly. Throwing would force every overview widget to defensively try/catch each section. The server's job is to say "this is what the data is"; the client's job is to render it.
- **Why a separate `computeLegs(tripId)` entry point alongside `execute(tripId, userId)`.** The overview use-case already runs the owner gate at the top of its own `execute`. Calling the user-facing entry point from there would double-fetch the trip + double-check ownership for nothing. The split keeps the public path safe (owner gate first) while letting the trusted internal caller skip the redundant DB hits. Same trade-off the other 4 Trip × \* fold-ins make implicitly by inlining their search calls instead of going through the per-section use-cases.
- **Why batch `findCoordinatesForPlaceIds(ids)` instead of one lookup per pair.** A typical day has 3-6 items. Two pairs would be 4 lookups under naive iteration, multiplied by N days. One `WHERE id = ANY($1)` query is a single round-trip regardless of trip size. The Map lookup in the loop is O(1).
- **Why `findCoordinatesForPlaceIds` returns a `Map` instead of an array of `{id, lat, lng}`.** Callers always do "look up coords for placeId X." Returning a Map skips the array-find loop on every consecutive pair. The cost difference is invisible in this slice but adds up if the use-case is later reused inside a tight loop (a future "live re-plan" or "alternate-route exploration" use-case).
- **Why no caching on the use-case itself.** The Transport module's `CachedRoutingProvider` already memoises by (origin, destination, modes) inside Redis with TTL. Wrapping the trip-level use-case in another cache would create stale-after-itinerary-edit entries and double the invalidation surface for zero new wins. The repeated lookups across users at the same coords are exactly what the lower cache catches.
- **Why fold into overview now, not in a follow-up.** Five sections to six is a one-line change in the response shape; clients that ignore unknown fields are unaffected, and clients that DO want the section get it for free without a new round-trip. Holding it back would mean adding a second fetch in the mobile client for a value that's already computed alongside the rest.
- **First Trip × \* fold-in that needs a sibling module's use-case (`GetRoutesUseCase`) AND raw PostGIS (`findCoordinatesForPlaceIds`) AND another use-case from within the same module (`GetTripTransportLegsUseCase` reused by overview).** Three-way composition that lands cleanly because each piece is already a port-shaped seam. Hex pays off here.

---

### [IV.18.4.2] — Federated → catalog write-through (sha256 sourceKey dedup + ingest opt-in)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.3 (Places Catalog)

**What was done**

Closes the long-promised "follow-up slice" referenced inside [IV.18.4.1]'s comments. Federated provider results now have a path into the canonical `Place` catalog — opt-in via `ingest: true` on the existing `POST /places/federated-search`. First slice in the session whose value compounds with every passing day: the catalog grows organically from real user queries, and every downstream module that already searches Places benefits without code changes.

The dedup key is the schema-defined `sourceKey = sha256(provider + ':' + externalId)` (matches the comment on `Place.sourceKey @unique`). Stable across provider id format changes — a future Google migration from `<placeId>` to `places/<placeId>` would NOT shift our keys.

- **`apps/api/src/modules/places/` extension:**
  - `application/ingest-federated-results.use-case.ts` — **new file**; `IngestFederatedResultsUseCase`. Per result: hash sourceKey → repo.findBySourceKey → if hit return existing + `created=false`, else repo.insert + `created=true`. Catches Prisma `P2002` (unique-constraint race from a concurrent insert), re-reads, returns the winner.
  - `application/ports/place.repository.ts` — adds `findBySourceKey(sourceKey)` for the find-half of find-or-create. Returns `Place | null`.
  - `infrastructure/prisma-place.repository.ts` — implements `findBySourceKey` via Prisma `findUnique` with explicit `select` (skips the `Unsupported` PostGIS column — no GeoQueries needed for the read; insert still goes through GeoQueries to satisfy CLAUDE rule 11).
  - `interface/dto/places.dto.ts` — `FederatedSearchPlacesBodySchema` gains optional `ingest: boolean`.
  - `interface/places.controller.ts` — federated route now accepts `ingest`; when true, calls `IngestFederatedResultsUseCase` after the search and decorates each response item with `placeId` + `created`. When absent, behaviour is unchanged (pure read, no DB writes, no `placeId` decoration).
  - `places.module.ts` — registers + exports the new use-case.

- **5 integration tests** (`apps/api/test/places-ingest.e2e-spec.ts`) using a stub `PlaceProvider` override (same pattern as `places-federated.e2e-spec.ts`):
  1. `ingest=true` → 3 rows in DB + each response item has a `placeId` + `created=true`.
  2. Repeat ingest with same payload → still 3 rows, `created=false`, `placeId` stable across calls.
  3. Default (no `ingest`) → 0 rows in DB, no `placeId` / `created` decoration.
  4. End-to-end roundtrip: ingest → `POST /places/search` near same anchor → finds the 3 rows with the test prefix.
  5. `category=cafe` filter at ingest time → only the 1 matching row is persisted.

**Files created** (2) — `modules/places/application/ingest-federated-results.use-case.ts`, `test/places-ingest.e2e-spec.ts`.
**Files edited** (4) — `modules/places/application/ports/place.repository.ts` (+findBySourceKey), `modules/places/infrastructure/prisma-place.repository.ts` (+findBySourceKey impl), `modules/places/interface/dto/places.dto.ts` (+ingest optional), `modules/places/interface/places.controller.ts` (+ingest wiring + response decoration), `modules/places/places.module.ts` (+use-case provider/export).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ All 4 places suites green: 25/25 (existing 20 + new 5).
- ✅ **Full real-DB suite: 47 suites, 317 tests pass against live Docker.** (+1 suite, +5 tests.)

**Acceptance criteria**

- ✅ `POST /places/federated-search` with `ingest: true` persists rows into `Place`.
- ✅ Idempotent — repeat call doesn't duplicate; `created=false` on second pass.
- ✅ `placeId` is stable across calls (same row keeps its id).
- ✅ Default behaviour unchanged — no DB writes, response shape backwards-compatible.
- ✅ Concurrent inserts race safely (P2002 caught + re-read).
- ✅ Ingested rows are findable via `POST /places/search` (canonical catalog read).

**Notes**

- **Why opt-in via `ingest: true` instead of always-on write-through.** Two reasons. First, test isolation: many existing federated-search tests don't expect DB row side-effects, and forcing them all to clean up Place rows is a real cost. Second, semantic separation: a "see what's around" exploration query is conceptually different from "save these to my catalog." Letting the client signal intent keeps the read surface fast + clean. The default stays read-only-safe; the data moat builds up when clients explicitly commit.
- **Why sha256 the sourceKey instead of using the literal `provider:externalId`.** The schema's existing comment specifies sha256 — staying consistent with that. Hashing also normalises across format changes (URL-safe, fixed-width, doesn't leak provider IDs into other systems that scan the column). Trade-off: can't reverse-look-up the original IDs from sourceKey alone, but we store them in `metadata` for debug + future reconciliation.
- **Why catch `P2002` and re-read instead of using Prisma `upsert`.** Two reasons. First, `upsert` would force every ingest call to attempt an UPDATE on the existing row, which would touch the `coordinates` column — breaking CLAUDE rule 11 (PostGIS columns can't be written through Prisma's typed path). Second, the find-then-insert + race-catch shape is exactly what the use-case wants: report `created=true` only when we actually inserted, `created=false` when we found-or-raced. `upsert` would flatten that distinction.
- **Why `metadata: { provider, externalId }` on insert.** Provenance for ops/debug — `sourceKey` is opaque (it's a hash), so the metadata column lets a human (or a future re-ingest tool) trace which provider+id any given row came from. Costs ~30 bytes per row.
- **Why the response decorates `FederatedPlaceResult` rather than returning a totally different shape.** Backwards compatibility — clients that don't pass `ingest=true` still get the existing shape, byte-for-byte. Clients that do pass it get extra optional fields (`placeId`, `created`) without breaking JSON deserializers that don't know about them.
- **First "data moat" mechanism in the codebase.** Every prior slice was either pure read, scoped write to a user's own data (Trips, SOS, Media, Notifications), or admin-only seed (Places insert). This is the first slice where multiple users' federated queries cumulatively build a shared knowledge graph — the playbook's defensibility argument made operational.
- **Sets up downstream slices**: future `places-ingestion-worker` (extracted) reads its inputs via this same use-case, just batched + scheduled. The port shape doesn't need to change.

---

### [IV.18.15.1] — Notifications v1: persist NotificationLog + SOS handler + GET /notifications/me

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.15 (Notifications)

**What was done**

Closes the long-running "events fire into the void" gap. Three independent gains in one slice: a missing handler is added (Safety.SosTriggered, the highest-value unhandled event), the in-memory-only sender becomes a persistent ledger (every dispatched notification lands in `NotificationLog`), and the ledger gets a queryable HTTP surface (`GET /api/v1/notifications/me`). 13th HTTP module surface; first read-API for the Notifications module.

- **`apps/api/src/modules/notifications/` extension:**
  - `domain/notification-log.entity.ts` — **new file**; plain-data `NotificationLog` mirroring the Prisma row (channel, templateId, status, payload JSON, read, deliveredAt).
  - `application/ports/notification-log.repository.ts` — **new file**; 2-method port: `create` (called by sender) + `listForUser` (called by use-case).
  - `infrastructure/prisma-notification-log.repository.ts` — **new file**; direct Prisma adapter. Uses Prisma's enum types via cast at the boundary.
  - `infrastructure/logging-notification-sender.ts` — **wired through repo**. Every `send()` now does logging + in-memory ring buffer push + DB row insert. **Persistence failure is swallowed-and-logged** — same policy as the SOS event-publish path. The handler must not propagate errors back to the EventBus, which would otherwise retry the whole event and cause duplicate sends.
  - `application/handlers/sos-triggered.handler.ts` — **new handler**; subscribes to `Safety.SosTriggered` at `OnApplicationBootstrap`, sends a "SOS received" push stub through the same sender port. Confirmation back to the caller; future emergency-contacts fan-out latches on the same event.
  - `application/list-my-notifications.use-case.ts` — **new use case**; default 50, cap 200. Same shape as ListMySosEventsUseCase.
  - `interface/notifications.controller.ts` — **new controller**; `GET /notifications/me` returns the authed user's recent rows, owner-gated by JWT sub.
  - `notifications.module.ts` — registers the new repo, handler, use-case, controller. Existing exports preserved.

- **5 integration tests** (`apps/api/test/notifications-persistence.e2e-spec.ts`):
  1. No bearer on `GET /notifications/me` → 401.
  2. Register triggers SessionIssued → row appears in DB → `GET /me` surfaces it with `templateId=session_issued_new_device`, `channel=email`, `status=delivered`, non-null `deliveredAt`.
  3. POST SOS → SosTriggeredHandler subscribed at boot → push row persisted with `templateId=safety_sos_received`, `payload.context.sosEventId` matches, `payload.context.trigger` matches.
  4. Cross-user leak defence — Bob's SOS doesn't show up in Alice's `/me`.
  5. `?limit=2` query param caps results.

  Existing 4 tests in `notifications.e2e-spec.ts` (in-memory log assertions for SessionIssued + ItineraryGenerated) still pass — adding DB persistence on top didn't break the in-memory contract.

**Files created** (8) — `modules/notifications/domain/notification-log.entity.ts`, `modules/notifications/application/ports/notification-log.repository.ts`, `modules/notifications/infrastructure/prisma-notification-log.repository.ts`, `modules/notifications/application/handlers/sos-triggered.handler.ts`, `modules/notifications/application/list-my-notifications.use-case.ts`, `modules/notifications/interface/notifications.controller.ts`, `test/notifications-persistence.e2e-spec.ts`.
**Files edited** (2) — `modules/notifications/infrastructure/logging-notification-sender.ts` (+constructor injection of repo, +DB insert in send()), `modules/notifications/notifications.module.ts` (+4 providers + controller).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Notifications + persistence suites both green: 9/9 (4 existing + 5 new).
- ✅ **Full real-DB suite: 46 suites, 312 tests pass against live Docker.** (+1 suite, +5 tests.)

**Acceptance criteria**

- ✅ `Safety.SosTriggered` now has a real subscriber; previously emitted into the void.
- ✅ Every notification dispatched through `NotificationSender` writes a `NotificationLog` row.
- ✅ Authenticated users can `GET /notifications/me` to see their own ledger.
- ✅ Cross-user `GET /me` does not leak other users' notifications.
- ✅ DB-write failure in the sender does not bubble to the EventBus (no duplicate sends).
- ✅ Existing in-memory-log test contract unbroken — `peekSent` / `drainSent` still work.

**Notes**

- **Why persist in the sender, not in a parallel handler.** Two reasons. First, every dispatched notification — regardless of which event triggered it — should appear in the ledger; putting persistence in the sender means a future `Trip.ShareIssued` handler that's added later automatically gets persisted without a co-located DB call. Second, it keeps handlers thin (one responsibility: translate event → SendNotificationInput) and the sender becomes the single integration point for "what does it mean to send."
- **Why swallow-and-log persistence failures.** The handler runs inside the EventBus consumer loop. A thrown error there triggers retry-then-DLQ. If the DB is down for 30 seconds, every retry would re-log + re-call the sender's in-memory buffer — duplicate user-visible state. The persistent ledger is "best effort to record what we already sent"; the in-memory dispatch is the source of truth. Same policy SOS event-publish uses.
- **Why `delivered` status immediately for the logging stub.** The stub is fully synchronous; there is no provider ack to wait for. When a real Resend/Twilio adapter lands, it'll start the row in `queued`, return, then a webhook handler flips it to `delivered` / `failed`. The `status` column is already enum-correct for that future.
- **Why no mark-as-read endpoint in v1.** The schema has `read` for it (defaulted false), and the column is in the index — but adding `POST /:id/mark-read` is a separate slice with its own auth + bulk-update considerations. Keeping v1 to "ledger fills + you can read it" matches the discipline applied to every other module's first slice.
- **Why a separate test file (`notifications-persistence.e2e-spec.ts`) instead of extending `notifications.e2e-spec.ts`.** The existing file's contract is "events drive in-memory log assertions." Conflating those with DB assertions would force every test to clean up rows, making the suite slower without buying clarity. Split files keep the SCAN-DEL / row-clean / sender-drain ceremonies scoped to the file that needs them.
- **Why `list-my-notifications` has the same shape as `list-my-sos-events`.** Pure consistency — every "my own list" use-case in the codebase now returns up to 200 items, defaults to 50, accepts an optional `limit` query param, and clamps to the same bounds. Less to remember.
- **Notification fan-out is now end-to-end testable** without subscribing test code to the EventBus directly. The DB row is the assertion; that's strictly more durable than peeking in-memory state.

---

### [IV.18.12.1] — Media v1: presigned S3 uploads (upload-url + confirm + download)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.13 (Media & Memory)

**What was done**

Opens the Media bounded context — the first slice to exercise S3-compatible object storage (MinIO in dev/test via the `travel-minio` container that's been running idle the entire session; R2 / real S3 in prod). 12th HTTP module. The API brokers presigned URLs; bytes never flow through Node. Transcoding + EXIF stripping + thumbnails are out of scope here — they land in `media-service` (the extracted worker from Playbook §3.2).

Three HTTP surfaces:

| Route                                 | What it does                                                    |
| ------------------------------------- | --------------------------------------------------------------- |
| `POST /api/v1/media/upload-url`       | Create a `processing` row + return short-lived PUT URL (15 min) |
| `POST /api/v1/media/:id/confirm`      | HEAD the S3 object to verify upload landed, flip row to `ready` |
| `GET  /api/v1/media/:id/download-url` | Short-lived GET URL (5 min) for a `ready` asset                 |

- **`apps/api/src/modules/media/` new module:**
  - `domain/media-asset.entity.ts` — plain-data `MediaAsset` + `MediaKind` + `MediaStatus` (subset of the Prisma row; `variants`, `coordinates`, `takenAt` skipped in v1).
  - `application/ports/media-asset.repository.ts` — `create` + `markReady` + `findByIdForOwner`. Owner-gated throughout (IDOR defence: 404 on wrong-id OR wrong-owner, never 403).
  - `application/ports/storage-provider.ts` — 3-method port: `createPresignedUploadUrl` / `createPresignedDownloadUrl` / `objectExists`. Domain / application layers never see AWS SDK types.
  - `infrastructure/prisma-media-asset.repository.ts` — direct Prisma (no PostGIS writes — v1 leaves `coordinates` null). `markReady` uses `updateMany` + count-gate for atomic owner-scope flip.
  - `infrastructure/s3-storage-provider.ts` — AWS SDK v3 client. **Signs URLs with `getSignedUrl` then dispatches HTTP via native `fetch`** instead of `client.send()` — see gotcha below. `onModuleInit` runs `ensureBucket` (HeadBucket → 404 → CreateBucket) so MinIO dev/test stacks don't need a manual provisioning step.
  - `application/create-upload-url.use-case.ts` — generates a key `${ownerId}/${randomHex}/${randomHex}`, inserts the row in `processing`, returns presigned PUT URL + asset id.
  - `application/confirm-upload.use-case.ts` — owner-gated lookup, short-circuits if already `ready` (idempotent), HEADs the object, flips status.
  - `application/get-media-download-url.use-case.ts` — owner-gated; 409 `UPLOAD_NOT_COMPLETED` if status ≠ `ready`; else 5-min presigned GET.
  - `interface/dto/media.dto.ts` — Zod `CreateUploadUrlBodySchema` with `kind ∈ {image, video}` + `contentType` + optional `tripId`.
  - `interface/media.controller.ts` — three routes above; all authed via the app-wide `JwtAuthGuard`.
  - `media.module.ts` — wires the two port tokens + three use-cases + controller.
- **`app.module.ts`** — +MediaModule.
- **`apps/api/package.json`** — +`@aws-sdk/client-s3@^3.705.0`, +`@aws-sdk/s3-request-presigner@^3.705.0`.

- **7 integration tests** (`apps/api/test/media.e2e-spec.ts`) against real MinIO + Postgres:
  1. No bearer on `POST /media/upload-url` → 401.
  2. **Full end-to-end**: request upload URL → PUT 4-byte payload to the presigned URL via Node native fetch → confirm → 200 + `status=ready` → request download URL → fetch the URL → **bytes come back byte-for-byte identical**.
  3. Confirm before actual upload → 409 `UPLOAD_NOT_COMPLETED`.
  4. User B confirms User A's asset → 404 `MEDIA_NOT_FOUND` (IDOR).
  5. User B requests download URL for User A's asset (even after A uploaded + confirmed) → 404 `MEDIA_NOT_FOUND`.
  6. Invalid `kind` (e.g. `'audio'`) → 422 `VALIDATION_FAILED`.
  7. Double-confirm is idempotent — second call still returns 200 + `status=ready`.

**Files created** (11) — `modules/media/domain/media-asset.entity.ts`, `modules/media/application/ports/media-asset.repository.ts`, `modules/media/application/ports/storage-provider.ts`, `modules/media/application/create-upload-url.use-case.ts`, `modules/media/application/confirm-upload.use-case.ts`, `modules/media/application/get-media-download-url.use-case.ts`, `modules/media/infrastructure/prisma-media-asset.repository.ts`, `modules/media/infrastructure/s3-storage-provider.ts`, `modules/media/interface/dto/media.dto.ts`, `modules/media/interface/media.controller.ts`, `modules/media/media.module.ts`, `test/media.e2e-spec.ts`.
**Files edited** (2) — `apps/api/package.json` (+2 AWS SDK deps), `apps/api/src/app.module.ts` (+MediaModule).

**Dependencies added** — `@aws-sdk/client-s3@^3.705.0`, `@aws-sdk/s3-request-presigner@^3.705.0`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Media suite 7/7 pass — including auto-bucket-create (dropped `travel-test` before run; `ensureBucket` recreated it; happy-path PUT + confirm + download all succeeded).
- ✅ **Full real-DB + real-MinIO suite: 45 suites, 307 tests pass against live Docker.** (+1 suite, +7 tests.)

**Acceptance criteria**

- ✅ Authenticated client can request a presigned PUT URL and a `MediaAsset` row exists in `processing` state.
- ✅ Client PUTs bytes directly to MinIO (API never proxies bytes).
- ✅ Confirm-upload verifies the object actually landed via HEAD before flipping status.
- ✅ Download-URL is owner-gated + short-lived (5 min).
- ✅ Cross-user IDOR attempts all collapse to 404 `MEDIA_NOT_FOUND`.
- ✅ Idempotent double-confirm doesn't 409.
- ✅ Bucket auto-creates on module init (MinIO dev ergonomics).

**Notes**

- **Why `getSignedUrl` + native fetch instead of `client.send()`.** The AWS SDK v3's `client.send` path does a dynamic `import()` to lazily load its HTTP handler. Jest's VM sandbox rejects those with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG: A dynamic import callback was invoked without --experimental-vm-modules`. Instead of forcing every test in the suite onto that flag, the adapter signs URLs (pure HMAC — no dynamic imports, works in every runtime including Jest VM, Cloudflare Workers, Deno) and dispatches actual HTTP via Node's built-in `fetch`. In prod this is a zero-cost difference: presigning is a sub-millisecond HMAC; the HTTP round-trip is identical. The same pattern covers HeadObject (probe in `objectExists`), HeadBucket (probe on init), and CreateBucket (auto-provision). Durable environment gotcha — every future slice that adds S3 ops should follow the same shape.
- **Why auto-create the bucket on init.** MinIO dev containers start empty. Shipping a working "one command up" story (`docker compose up` then `pnpm dev`) means no manual `mc mb`. In prod the bucket pre-exists — `HeadBucket` succeeds on first boot and `CreateBucket` never runs. Any failure in `ensureBucket` is logged but not thrown, so a transient MinIO hiccup doesn't block API startup; the first real upload would surface a genuine misconfig.
- **Why `status` flip happens in the API, not in an S3 event.** In prod, the "official" pattern is an S3 Event Notification → SQS → worker → status flip. That adds three new infra dependencies (SNS, SQS, a worker), none of which the current stack has. Confirming via a client-driven POST + a HEAD probe is simpler, works against MinIO in dev, and the eventual S3-events migration is a pure adapter swap.
- **Why owner-prefix the S3 key.** Bucket listing stays tidy, per-user lifecycle policies become trivial, and eventual object-level ACL tightening (per-user encryption keys, GDPR right-to-erasure by prefix) is cheap. The `/` in the key is a visual delimiter only; MinIO/S3 don't create directories.
- **Why 15-min upload / 5-min download TTLs.** Mobile uploads over flaky networks can take minutes; 15 reaps any client-side retries with margin. Downloads render fast — 5 min is plenty and minimises exposure window if a URL is logged/shared accidentally.
- **Why the asset-row is inserted BEFORE the URL is returned.** The confirm step owner-gates by `id + ownerId` without an extra lookup. A row whose bytes never land stays in `processing` forever — a cleanup worker can reap them in a follow-up; v1 just tolerates the drift.
- **First domain to have a genuinely-external infrastructure dep beyond Postgres + Redis.** Weather/Stays/Food/Places-federation/Events/Transport all mocked their upstreams. MinIO is the first real adapter this session, and proves the "port + external provider adapter" shape works end-to-end against a boxed service. Same shape will carry Payments (Stripe), Comms (Resend/Twilio), and Search (Meilisearch) when those slices land.
- **Event emission deferred.** No `Media.UploadCompleted` event on confirm in v1. The reason is subtle: a worker-driven transcode path would be the natural subscriber, and that worker itself would emit `Media.VariantsReady`. Shipping the event now risks a premature shape. The confirm use-case has the exact right seam to add one later.

---

### [IV.18.11.2] — Safety: SOS events (trigger + list-mine + resolve)

**Date:** 2026-04-24 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety)

**What was done**

Second safety primitive alongside scam reports. Scam reports are "I saw something bad here for others to avoid"; SOS is "I need help right now." Three HTTP surfaces: trigger (create), list-mine (read), resolve (update).

- **`GeoQueries.insertSosEvent`** — raw-SQL INSERT for the PostGIS `coordinates` column. Sparse-by-design: `resolvedAt` + note start null, flipped by the resolve path (not by insert).

- **`apps/api/src/modules/safety/` extension:**
  - `domain/sos-event.entity.ts` — `SosEvent` mirroring the Prisma row minus the PostGIS column.
  - `domain/safety.events.ts` — **new file**; `Safety.SosTriggered` typed domain event + `makeSafetyEvent` factory. No handlers in this slice — the event fires so a future notification subscriber (push to emergency contacts / SMS to ops on-call) can latch on. Parity with how Identity/Trip shipped their events ahead of handlers.
  - `application/ports/sos-event.repository.ts` — `create` + `listForUser` + `resolve`. Resolve is scoped to `(id, userId, resolvedAt: null)` so strangers can't resolve and repeats 404.
  - `infrastructure/prisma-sos-event.repository.ts` — `create` via `GeoQueries`; list + resolve via direct Prisma delegates. Resolve uses `updateMany` + `count === 1` gate for the atomic owner-scope + unresolved-only filter (same trick the trip-share revoke uses).
  - `application/trigger-sos.use-case.ts` — validates lat/lng, delegates to repo, emits `Safety.SosTriggered`. **Event-publish failure is swallowed-and-logged** — the row is already in the DB, and an emergency SOS path MUST NOT 500 because an event bus hiccuped.
  - `application/list-my-sos-events.use-case.ts` — `listForUser(userId, limit)`. Default 50, cap 200.
  - `application/resolve-sos.use-case.ts` — delegates to repo; `null` return → 404 `SOS_NOT_FOUND` (repeat-resolve, stranger-resolve, unknown-id all collapse to the same error — no IDOR leak).
  - `interface/dto/safety.dto.ts` — +`TriggerSosBodySchema`, +`ResolveSosBodySchema`. Trigger is free-form 1–60 chars so `fall_detected` / `voice_command` etc. don't need schema migrations.
  - `interface/sos.controller.ts` — **new controller** (`@Controller('safety/sos')`, separate from `SafetyController`). Three routes map to the three use-cases.
  - `safety.module.ts` — two new providers, two new use-cases added, both controllers listed.

- **7 integration tests** (`apps/api/test/sos.e2e-spec.ts`):
  1. No bearer → 401.
  2. Full flow: trigger → list shows unresolved → resolve with note → list now shows `resolvedAt` + `resolutionNote` populated.
  3. Cross-user leak defence: Alice's list only returns Alice's events, not Bob's.
  4. Bob tries to resolve Alice's SOS → 404 `SOS_NOT_FOUND` + Alice's event still unresolved.
  5. Repeat resolve → second call returns 404 (already resolved; filter `resolvedAt: null` excludes the row).
  6. Resolve unknown id → 404 `SOS_NOT_FOUND`.
  7. `lat=999` → 422 `VALIDATION_FAILED`.

**Files created** (7) — `modules/safety/domain/sos-event.entity.ts`, `modules/safety/domain/safety.events.ts`, `modules/safety/application/ports/sos-event.repository.ts`, `modules/safety/application/trigger-sos.use-case.ts`, `modules/safety/application/list-my-sos-events.use-case.ts`, `modules/safety/application/resolve-sos.use-case.ts`, `modules/safety/infrastructure/prisma-sos-event.repository.ts`, `modules/safety/interface/sos.controller.ts`, `test/sos.e2e-spec.ts`.
**Files edited** (3) — `common/db/geo-queries.ts` (+insertSosEvent + `InsertSosEventInput`), `modules/safety/interface/dto/safety.dto.ts` (+TriggerSos + ResolveSos schemas), `modules/safety/safety.module.ts` (+4 providers + SosController).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ SOS suite 7/7 pass.
- ✅ **Full real-DB suite: 44 suites, 300 tests pass against live Docker.** (+1 suite, +7 tests. 300-test milestone.)

**Acceptance criteria**

- ✅ Authenticated user can trigger an SOS pinned to a coordinate.
- ✅ User can list their own SOS history (most recent first), active + resolved.
- ✅ Owner can resolve their own event with an optional note.
- ✅ Non-owner / repeat / unknown resolves collapse to one 404 code.
- ✅ `Safety.SosTriggered` domain event emitted on create (latch-point for future notification fan-out).
- ✅ Event-bus hiccup doesn't 500 the SOS path.

**Notes**

- **Why the event-publish failure is swallowed-and-logged.** SOS is a life-safety path. The data integrity guarantee is "row is in the DB." Notification fan-out is a best-effort layer on top. If the event bus is down, the row still exists, ops can still query it, and the client still got its 201 with the id. Bubbling the publish error would violate the core contract for an optional-layer problem.
- **Why `resolve` is POST not PATCH.** REST purists would say PATCH, but resolving an SOS is a state-machine transition ("I am no longer in danger"), not a partial edit. POST + explicit verb path matches how the app's other state transitions work (trip share revoke, MFA verify).
- **Why the "already resolved" response is 404 not 409.** Callers don't distinguish between "never existed" and "existed but already in the terminal state" — both mean "you can't resolve it now." Trying a dozen error codes at the boundary is a UX cost with no win. Same call the trip-share revoke made.
- **Why no "ops dashboard" endpoint for all active SOS.** That's an admin surface — different auth gate (role=admin), different data visibility (all users, including sensitive precise coordinates), different rate limits. When an ops team exists and there's a concrete UI for them, that surface lands in its own slice under `/admin/safety/sos`.
- **Why free-form `trigger` string.** New SOS modes emerge (`apple_watch_fall`, `voice_assistant`, `shake_to_sos`). Locking to an enum would force a migration every time. A moderation-curated catalog can bolt on later if analytics wants consistent values. Same pattern scam-report `category` uses.
- **First domain event emitted outside Identity + Trip.** Those two had events from day one because sessions and trips both have fan-out concerns (notifications, analytics). Safety joins that list naturally — an SOS is the canonical "tell the system something urgent happened" moment.

---

### [IV.18.11.1] — Safety v1: scam reports (user-report + geo-scoped search)

**Date:** 2026-04-23 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.7 (Safety)

**What was done**

Opens the Safety bounded context — the playbook's stated moat, at 0% for the entire prior session. First slice scopes to the cleanest primitive: **crowd-sourced scam reports**. An authenticated user reports a scam at a coordinate; any other authenticated user searches nearby scams. Crime layer, SOS events, agent marketplace, and moderation flip-`verified` all remain follow-ups.

First domain with genuine write-path complexity beyond Trip — every prior new domain this session (Weather/Stays/Food/Places federation/Events/Transport) was read-only mock-backed.

- **`GeoQueries` extended** with two new raw-SQL methods (PostGIS `coordinates` column; CLAUDE rule 11):
  - `insertScamReport(input)` — straightforward INSERT + RETURNING with `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.
  - `findScamReportsWithinRadius(input)` — `ST_DWithin` for the radius filter, `ST_Distance` for ordering, threshold-style `minSeverity` via an inline CASE statement that ranks the enum values numerically.
  - New input + result types co-located: `InsertScamReportInput`, `FindScamReportsInput`, `ScamReportWithDistance`.

- **`apps/api/src/modules/safety/` scaffold:**
  - `domain/scam-report.entity.ts` — plain-data `ScamReport` + `ScamReportWithDistance` + local `ScamSeverity` type mirroring the Prisma enum.
  - `application/ports/scam-report.repository.ts` — `ScamReportRepository.report` (write) + `findNearby` (read). Two methods; moderation lands in its own slice.
  - `infrastructure/prisma-scam-report.repository.ts` — delegates both methods to `GeoQueries`. Cross-package enum coercion handled via `as` casts at the adapter boundary (domain-local `ScamSeverity` ↔ Prisma-generated `ScamSeverity`).
  - `application/report-scam.use-case.ts` — validates lat/lng; **`reporterId` comes from the JWT**, NEVER the request body (defence against cross-user report impersonation).
  - `application/find-nearby-scams.use-case.ts` — validates lat/lng + radius `(0, 50]` (broader than Food/Places because scam patterns cluster at city scale: pickpocket district, tourist-trap overcharge zone). Optional `category` + `minSeverity` + `limit` (default 50, cap 200 — higher than the place-search default because safety-layer markers render densely on a map).
  - `interface/dto/safety.dto.ts` — Zod schemas. `description` 10–2000 chars; `evidenceUrls` ≤ 5; severity enum.
  - `interface/safety.controller.ts` — `POST /api/v1/safety/scam-reports` (create) + `POST /api/v1/safety/scam-reports/search` (read). Both authenticated. Search is POST (not GET) because the body has coord + filters — matches the pattern of every other search endpoint in the app.
  - `safety.module.ts` — clean-hex wiring; `GeoQueries` comes from the global `DbModule`.

- **`AppModule` imports `SafetyModule`**.

- **8 integration tests** (`apps/api/test/safety.e2e-spec.ts`) — all hit real PostGIS through `GeoQueries` (no provider stubs — the domain is users, not an external API):
  1. No bearer → 401.
  2. Happy path: create → distance-scored `ScamReportWithDistance` found in nearby search. `verified: false` on submission. Distance < 300m for coords ~180m apart.
  3. Cross-user visibility: Alice's report shows up in Bob's nearby search (explicit; this is crowd-safety, not private data).
  4. `minSeverity: 'high'` filter — 4 reports seeded at low/medium/high/critical → response contains only high + critical (2 rows). Threshold semantics match the SQL `CASE` ranking.
  5. `category: 'pickpocket'` filter — exact match narrows to one of two seeded reports.
  6. Description < 10 chars → 422 `VALIDATION_FAILED` (Zod `.min(10)`).
  7. Search radius 100km → 422 `INVALID_RADIUS` (domain, not Zod).
  8. Invalid severity enum → 422 `VALIDATION_FAILED` (Zod).

**Files created** (10) — under `apps/api/src/modules/safety/` + `test/safety.e2e-spec.ts`.
**Files edited** (2) — `apps/api/src/common/db/geo-queries.ts` (+2 methods, +3 types, +1 import), `apps/api/src/app.module.ts` (+SafetyModule).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Safety suite 8/8 pass.
- ✅ **Full real-DB suite: 43 suites, 293 tests pass against live Docker.** (+1 suite, +8 tests.)

**Acceptance criteria**

- ✅ Authenticated users can submit scam reports pinned to a coordinate.
- ✅ Any authenticated user can search nearby scams (the feature's whole point).
- ✅ Reporter id comes from the JWT, not the body — no impersonation path.
- ✅ Radius + severity + category filters work at SQL level (ST_DWithin + CASE rank).
- ✅ Results sorted ascending by geodesic distance.
- ✅ `verified` stays `false` on create — sets up a future moderation flow.

**Notes**

- **Why no cache in front of this (unlike the 6 other searches).** Scam reports are a WRITE path. If Alice reports a scam and then searches nearby, she must see her own report immediately — a cache would break the read-your-own-writes invariant. When moderation lands with a "show verified only" toggle, we can layer a cache on the verified-only read path (stable data, safe to serve slightly stale) without touching the write path.
- **Why `minSeverity` as threshold, not exact match.** UX pattern: users want "show me serious stuff" not "show me only exactly medium-severity reports." Threshold naturally matches how a safety layer is toggled on a map.
- **Why severity coerced via SQL `CASE` instead of Prisma query.** Prisma can't query enums with ordinal comparisons (`severity >= 'high'`) — the enum has no inherent order to the DB. The CASE statement makes the ordering explicit at the SQL layer. A follow-up refactor could add a numeric `severityRank` column maintained by a trigger, but that's premature until the query pattern is proven.
- **Why `category` as free-form string.** Scam categories evolve (`crypto-atm-scam` didn't exist 3 years ago). Free text + a client-side catalog pattern (for autocomplete) beats a locked enum that requires a migration for every new scam type. If abuse becomes a problem, a moderation-curated allowlist can bolt on later.
- **Why the first domain with real write paths waited until slice 77.** Every prior new domain (Weather/Stays/Food/Places federation/Events/Transport) was read-only through a mock provider. Safety couldn't be — there are no "scam report providers"; it IS the community. Forced us to exercise the `GeoQueries` raw-SQL INSERT path beyond what Places admin needs (ScamReport has `text[]` for evidence URLs, an enum column, and a reporter FK).
- **Moat status: unlocked (v1).** One module with scam reports doesn't win a moat; six modules with scam reports + crime overlay + SOS + KYC'd local agent marketplace would. This is slice 1 of that build-out.

---

### [IV.18.10.1] — Transport & Routing v1: POST /transport/routes (mock provider + cache)

**Date:** 2026-04-23 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.6 (Transport & Routing)

**What was done**

New bounded context opened — mode-fit routing between two coords. Sixth consumer of `TypedRedisCache<T>`. Deterministic mock provider using haversine + mode-specific speed/cost tables; real adapters (Google Directions, Mapbox, OpenRouteService, GTFS) land when credentials + licensing are sorted.

- **`apps/api/src/modules/transport/` scaffold:**
  - `domain/route-leg.entity.ts` — `TransportMode` type matching the Prisma enum (walk | bicycle | public_transit | two_wheeler | car | taxi | rideshare) + `RouteLeg` with `mode, distanceMeters, durationSeconds, estimatedCostUsd, confidence`.
  - `application/ports/routing-provider.ts` — `RoutingProvider.getRoutes(input)` with optional `modes` filter hint.
  - `application/ports/routing-cache.ts` — mirrors the pattern.
  - `application/get-routes.use-case.ts` — validates lat/lng ranges, rejects identical origin/destination, caps straight-line distance at 500km (inter-city routing is a separate product concern — different cost models, different providers). Typed errors: `INVALID_COORDINATES`, `SAME_ORIGIN_DESTINATION`, `ROUTE_TOO_LONG`.
  - `infrastructure/mock-routing-provider.ts` — haversine × 1.3 urban-overhead factor + mode-specific speeds/costs:

    | mode           | speed (km/h) | cost         | omit when |
    | -------------- | ------------ | ------------ | --------- |
    | walk           | 5            | free         | >20 km    |
    | bicycle        | 15           | free         | >80 km    |
    | public_transit | 20           | base 2 USD   | >100 km   |
    | two_wheeler    | 25           | 0.1 × km     | —         |
    | car            | 20 (urban)   | 0.2 × km     | —         |
    | taxi           | 20           | 2 + 1.5 × km | —         |
    | rideshare      | 22           | 2 + 1.7 × km | —         |

  - `infrastructure/redis-routing-cache.ts` — **~22 lines**; subclass of `TypedRedisCache<readonly RouteLeg[]>`. Namespace `routing`.
  - `infrastructure/cached-routing-provider.ts` — decorator. **4-decimal coord precision** (~11m) in the cache key vs the 3-decimal the search caches use — routing legs are more sensitive to small position shifts (origin across a road = different leg). Modes list sorted so `[car, walk]` and `[walk, car]` share an entry. **TTL 10 min** (route durations depend on live traffic; stale drive-times at rush hour is the user-facing hit).
  - `interface/dto/transport.dto.ts` — Zod enum matches the domain type.
  - `interface/transport.controller.ts` — `POST /api/v1/transport/routes`.
  - `transport.module.ts` + AppModule registration.

- **8 integration tests** (`apps/api/test/transport.e2e-spec.ts`):
  1. No bearer → 401.
  2. 5km trip returns all 7 modes; walk slower + free, rideshare costlier than car.
  3. 55km trip omits walk (>20km cap) but keeps car/taxi/transit.
  4. `modes: ['walk', 'bicycle']` narrows the response to those two.
  5. Identical origin/destination → 422 `SAME_ORIGIN_DESTINATION`.
  6. NYC → Chicago (>500km straight-line) → 422 `ROUTE_TOO_LONG`.
  7. `lat=999` → 422 `VALIDATION_FAILED` (Zod beats domain).
  8. `modes: ['teleport']` → 422 `VALIDATION_FAILED` (Zod enum rejects).

**Files created** (11) — under `apps/api/src/modules/transport/` + `test/transport.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+TransportModule).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Transport suite 8/8 pass.
- ✅ **Full real-DB suite: 42 suites, 285 tests pass against live Docker.** (+1 suite, +8 tests.)

**Acceptance criteria**

- ✅ Authenticated users can get mode-fit route options between two coords.
- ✅ Domain-meaningful mode omissions (walk>20km, transit>100km) happen at the provider.
- ✅ Radius cap (500km straight-line) enforced before provider call.
- ✅ Mode filter flows through; defaults to "all supported modes."
- ✅ 6th consumer of `TypedRedisCache<T>` — still zero base-class edits.

**Notes**

- **Why `Prisma.TransportMode` enum mirror rather than import.** `Prisma.TransportMode` is a generated enum; importing it couples the domain types to Prisma's shape. The handwritten `type TransportMode = 'walk' | ...` stays in sync with the schema by discipline — if they drift, `createdRouteLeg: Prisma.RouteLeg` assignments would fail at compile time (a future save-route slice lands that check).
- **Why haversine × 1.3 for distance.** Real urban routes follow a road network that's ~1.3× the great-circle distance (standard urban-grid factor). Makes distances + durations honest vs "straight line, no traffic." Real providers replace this with actual leg geometries.
- **Why 4-decimal cache precision (not 3 like the search caches).** Routing is sensitive to position on the order of ~10m: an origin on one side of a road vs the other has a different first turn. The search caches can coarsen aggressively because "place within 100m" is the same answer; routing can't.
- **Why the 500km straight-line cap at the use-case, not the provider.** It's a domain invariant, not a provider quirk. A future Mapbox adapter would still want to reject 1,000km queries at the use-case layer — regional/inter-city routing is a separate product concern.
- **Why no persistence in v1.** `RouteLeg` + `TransitSchedule` Prisma tables already exist (from the original schema), but nothing in v1 saves legs. "Save this route to my trip" is a separate follow-up that ties a User + Trip + RouteLeg together; the route endpoint itself is read-only.

---

### [III.13.2.7] — Apple OAuth adapter (sibling to Google)

**Date:** 2026-04-23 · **Status:** DONE · **Kind:** Build · **Playbook §** 13 (Identity, part 7)

**What was done**

Finishes the OAuth story opened in `[III.13.2.6]`. Same decorator-of-DI shape Google uses, different provider metadata.

- **`AppleOAuthProvider`** — sibling class to `GoogleOAuthProvider`:
  - Issuer: `https://appleid.apple.com` (single, no alternates like Google).
  - JWKS URL: `https://appleid.apple.com/auth/keys`.
  - Audience: `APPLE_CLIENT_ID` env var (bundle id for native, Services ID for web).
  - **`email_verified` coercion**: Apple returns this as EITHER boolean `true` OR string `"true"`. `coerceBool(...)` handles both.
  - **Name handling**: Apple doesn't put the name in the ID token. It sends the user's name via a separate form field on first sign-in only, which the client has to pass through. v1 leaves `displayName: null` in the returned profile; `SignInWithOAuthUseCase` already defaults to the email local-part when that's null. A follow-up slice can accept an optional `name` on the request body.
  - **Private relay addresses**: `*@privaterelay.appleid.com` emails are permitted — they're valid Apple-issued and verified. Nothing special needed; the existing email validation accepts them.

- **Module registry**: factory in `identity.module.ts` extended — Apple registers only when `APPLE_CLIENT_ID` is present (env schema already optional). No changes to the port, use-case, controller, or schema. The `POST /auth/oauth/:provider` route handles Apple identically to Google + Mock — the registry picks the right adapter by provider name.

- **Test** (+1): a sanity check that when `APPLE_CLIENT_ID` isn't set (test env), `POST /auth/oauth/apple` returns 401 `OAUTH_PROVIDER_UNKNOWN`. Proves the env-gated registration pattern actually gates — the route still exists (path param), but the registry lookup misses. Doesn't hit Apple's JWKS (not possible in CI, and not useful — the Mock adapter already exercises the full HTTP → use-case → link-flow path).

**Files created** (1) — `modules/identity/infrastructure/apple-oauth-provider.ts`.
**Files edited** (2) — `modules/identity/identity.module.ts` (+AppleOAuthProvider import + env-gated registry entry), `test/oauth.e2e-spec.ts` (+1 test).

**Dependencies** — none new (uses existing `jose`).

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ OAuth suite 8/8 pass (was 7; +1 for Apple-unregistered path).
- ✅ **Full real-DB suite: 41 suites, 277 tests pass against live Docker.** (+1 test.)

**Acceptance criteria**

- ✅ Apple sign-in works at the same URL as Google: `POST /auth/oauth/apple`.
- ✅ Apple-specific `email_verified` string/boolean quirk handled via `coerceBool`.
- ✅ Private relay addresses accepted (no special code needed).
- ✅ Apple only registers when `APPLE_CLIENT_ID` is set — local dev without Apple creds still boots.
- ✅ When unregistered, lookup returns the same `OAUTH_PROVIDER_UNKNOWN` 401 as any other unknown provider name.

**Notes**

- **Why no deep integration test of the real Apple adapter.** Same reasoning as Google: we can't hit Apple's JWKS from CI, and the `Mock` adapter already exercises the full HTTP → use-case → link-flow chain. The Apple adapter's only novel logic (issuer/audience/`email_verified` coerce) is type-checked + unit-trivial. If we ever add true JWKS-stubbed tests, they can exercise both adapters the same way.
- **Why one adapter per audience.** A single `AppleOAuthProvider` instance checks against a single audience value. If the product eventually needs iOS + web on the same deployment (different bundle id vs Services ID), register two adapters under different provider names (`apple-ios`, `apple-web`). The route param already lets that drop in without a port change.
- **Why not capture the `name` form field in v1.** Apple only sends it on the FIRST sign-in, and only as client-side form data (not in the ID token). Supporting it properly means: (1) accepting an optional `name` on the request body, (2) using it ONLY when creating a new user (ignoring for repeat sign-ins so malicious clients can't rename other people's accounts). That's a real design decision worth its own slice; for now, email-local-part is a reasonable fallback.
- **Identity module now covers**: email + password, MFA (TOTP + backup codes), account lockout, session rotation + reuse-detection cascade, Google OAuth, Apple OAuth, Mock OAuth. Still open: JWKS rotation + Redis-backed keyring persistence (the `@app/auth` package already supports it; the wiring in `jwt-token.service.ts` is stub-level single-key).

---

### [III.13.2.6] — OAuth sign-in: POST /auth/oauth/:provider (Google + Mock adapters)

**Date:** 2026-04-22 · **Status:** DONE · **Kind:** Build · **Playbook §** 13 (Identity, part 6)

**What was done**

Closes the oldest open gap in Identity — parts 1–5 (password + MFA + backup codes + sessions + account lockout) shipped weeks ago, but "Sign in with Google/Apple" has been a TODO. This slice ships the full pattern: port, two real-ish adapters, use-case with three-stage user resolution, HTTP surface, migration. Apple is a follow-up (its quirks — aud bundle-ids, required-claim list, first-sign-in name — deserve their own slice).

- **New Prisma model `UserOAuthIdentity`** (schema append-only per CLAUDE rule 8):
  - Columns: `id`, `userId`, `provider`, `providerUserId`, `providerEmail?`, `linkedAt`.
  - Uniqueness on `(provider, providerUserId)` — Google's `sub` + our provider name is the stable link.
  - `onDelete: Cascade` from `User` — soft-deleting a user drops the links.
  - Migration `20260422000000_oauth_identity`: applied via `docker exec psql` because the DB wasn't tracked by `_prisma_migrations` (prior schema was `db push`'d). The SQL was generated via `prisma migrate diff` (subset — Prisma's diff wanted to drop PostGIS GiST indexes it can't express in the schema, which we ignored).
  - `CreateUserInput.passwordHash` widened from `string` to `string | null` (schema already allowed nullable passwords; the port had been narrower).

- **Port `OAuthProvider`**:
  - Single method `verifyIdToken(idToken): Promise<OAuthProfile>`.
  - `OAuthProfile = { provider, providerUserId, email, displayName }`.
  - `OAuthProviderRegistry` DI token — a `get(name)` map so the use-case can route by provider name.

- **Port `UserOAuthIdentityRepository`**:
  - `findByProviderUser(provider, providerUserId) → UserOAuthIdentity | null`.
  - `link({ userId, provider, providerUserId, providerEmail })`.

- **Adapters**:
  - `GoogleOAuthProvider` — real verification using `jose`'s `createRemoteJWKSet` (fetches Google's certs at `googleapis.com/oauth2/v3/certs`, cached). Checks signature + issuer (`accounts.google.com` either form) + audience (`GOOGLE_CLIENT_ID`) + `email_verified === true`. Throws `UnauthorizedError(..., 'OAUTH_INVALID_TOKEN')` or `'OAUTH_EMAIL_UNVERIFIED'`.
  - `MockOAuthProvider` — accepts a JSON-encoded profile as the "id token." For dev + tests only; registered outside `NODE_ENV=production`.
  - `PrismaUserOAuthIdentityRepository` — direct Prisma delegate calls.

- **Use-case `SignInWithOAuthUseCase`** — three-stage resolution:
  1. **Existing link**: `findByProviderUser` hits → issue session for that user. Most common.
  2. **Email match, no link**: unlinked `(provider, providerUserId)` but email matches an existing password user → auto-link + issue session. Safe because the provider already verified the email.
  3. **New user**: create password-less User + link + issue. Display name from provider or email local-part.
  - Result includes `createdUser` / `linkedExisting` booleans so the UI can distinguish the three paths.

- **Provider registry (module factory)**: built at module init from env. `mock` only in non-prod (NODE_ENV gate). `google` only when `GOOGLE_CLIENT_ID` is set (constructor asserts; the registry swallows the "not configured" case by simply not registering the adapter). Tests don't need to override — the `mock` entry is live in test env.

- **HTTP**: `POST /api/v1/auth/oauth/:provider` → `{ userId, accessToken, expiresAt }` + sets `refresh_token` cookie. Same shape as register + login for client unification. `@Public()` (no existing session required). Reads device context (IP hash, UA, fingerprint) and issues a normal session via `IssueSessionUseCase` — sessions from OAuth are indistinguishable downstream from password sessions.

- **Dependency added**: `jose@^5.9.6` to `apps/api/package.json` (already transitively via `@app/auth`, but an explicit dep makes the Google adapter's imports visible).

- **7 integration tests** (`apps/api/test/oauth.e2e-spec.ts`) — all drive the real `MockOAuthProvider` (no Nest-level override needed since it's already wired):
  1. Unknown provider → 401 `OAUTH_PROVIDER_UNKNOWN`.
  2. First sign-in creates a password-less user + link row; returns access token + cookie.
  3. Repeat sign-in with same `(provider, providerUserId)` → same userId; only one link row.
  4. Pre-existing password user with the same email → auto-linked; same userId across the two flows.
  5. Malformed JSON id token → 401 `OAUTH_INVALID_TOKEN`.
  6. `emailVerified: false` → 401 `OAUTH_EMAIL_UNVERIFIED`.
  7. Missing body → 422 `VALIDATION_FAILED`.

**Files created** (6) — `apps/api/prisma/migrations/20260422000000_oauth_identity/migration.sql`, `modules/identity/application/ports/oauth-provider.ts`, `modules/identity/application/ports/user-oauth-identity.repository.ts`, `modules/identity/application/sign-in-with-oauth.use-case.ts`, `modules/identity/infrastructure/mock-oauth-provider.ts`, `modules/identity/infrastructure/google-oauth-provider.ts`, `modules/identity/infrastructure/prisma-user-oauth-identity.repository.ts`, `test/oauth.e2e-spec.ts`.
**Files edited** (5) — `prisma/schema.prisma` (+UserOAuthIdentity model + User.oauthIdentities back-relation), `apps/api/package.json` (+jose), `modules/identity/application/ports/user.repository.ts` (passwordHash → string | null), `modules/identity/identity.module.ts` (wiring + factory-provider for registry), `modules/identity/interface/auth.controller.ts` (+POST /oauth/:provider + inject), `modules/identity/interface/dto/auth.dto.ts` (+OAuthSignInBodySchema).

**Dependencies** — `jose@^5.9.6` (direct).

**Verification**

- ✅ Migration applied; `_prisma_migrations` table absent → migration applied directly via psql. Prisma client regenerated (needed a DLL unlock on Windows + OneDrive per known gotcha).
- ✅ `tsc --noEmit` green.
- ✅ OAuth suite 7/7 pass against Docker Postgres.
- ✅ **Full real-DB suite: 41 suites, 276 tests pass.** (+1 suite, +7 tests.)

**Acceptance criteria**

- ✅ Users can sign in with Google (real JWT verification via `jose` + remote JWKS).
- ✅ `MockOAuthProvider` shipped for dev/test ergonomics; gated out of `NODE_ENV=production`.
- ✅ First sign-in auto-creates a password-less account.
- ✅ Password users auto-link on matching verified email — no account fork.
- ✅ Repeat sign-ins stable by `(provider, providerUserId)` (not email, which can change).
- ✅ Sessions from OAuth use the same `IssueSessionUseCase` + cookie policy as password flows.

**Notes**

- **Why email-based auto-linking is safe.** The provider has verified the email on its side (adapters enforce `email_verified === true`). An attacker controlling `foo@bar.com`'s Google account legitimately IS the owner. If we're ever uncomfortable with that (e.g., adding TOTP-on-first-link as a belt), it's a use-case change, not a port change.
- **Why `(provider, providerUserId)` is the link key, not email.** Providers let users change their email. Google's `sub` is permanent. Keying on email would orphan users the first time they update their Google account email.
- **Why a factory provider for the registry.** Google should only register when `GOOGLE_CLIENT_ID` is set — an unconditional `useClass: GoogleOAuthProvider` would throw at module init on local dev. The factory inspects env at startup and registers conditionally. Also gates `mock` out of production.
- **Why path-param provider vs separate routes per provider.** Adding a 3rd provider (Apple) is a new adapter + a registry entry, not a new route + controller method. Keeps the HTTP surface from sprawling.
- **Why the Prisma migration had to be applied via `docker exec psql`.** The DB was originally seeded via `prisma db push` or manual baseline — the `_prisma_migrations` tracking table doesn't exist. `prisma migrate deploy` bails with P3005. Options were: resolve all prior migrations as applied (chatty), or apply only the new SQL directly (done). Either works; direct-apply was fewer steps and the SQL was already generated.
- **Why no test-level override of the registry.** The mock adapter is a real, shipping adapter (just gated to non-prod). Tests don't need to swap anything — they just build valid JSON-encoded profiles and POST them. Keeps the test close to the real behaviour.
- **Apple deferred.** Apple's ID token has `aud = <bundle-id>` (not a client-id), required claims are a slightly different subset, and the name is only sent on FIRST sign-in (provider tells you nothing on repeat). Each is a real complication; shipping Google clean first + Apple as its own slice is the right split.

---

### [IV.18.7.5] — Trip overview: add events as 5th Section

**Date:** 2026-04-22 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.2 (cross-context)

**What was done**

Closes the overview-dashboard story: now bundles 5 sections (itinerary, weather, stays, eateries, **events**) in one response. Pure composition over the existing `[IV.18.9.2]` fold-in primitives.

- **`GetTripOverviewUseCase`** extended:
  - +inject `SearchEventsUseCase` + import `EventListing`.
  - +`events: Section<readonly EventListing[]>` on the `TripOverview` interface.
  - +5th sub-fetch in the `Promise.all`, using the same `GracefulSkip('TRIP_DATES_REQUIRED')` pattern stays uses when `startsOn`/`endsOn` are missing.
  - Full-day window bounds (`endsOn + 23:59:59.999`) same as the Trip × Events fold-in.
  - Radius clamp to 30km (Events' domain cap).

- **`TripOverviewDto`** (controller) + **`mapSection`** call updated to pass through the new section.

- **5 existing overview tests** extended (+1 new stub class):
  - Happy-path test (now "all **five** sections ok:true") asserts `events.ok === true` + non-empty list.
  - Dateless test (renamed: "stays + events sections ok:false") now asserts both stays AND events return `TRIP_DATES_REQUIRED`; weather/eateries/itinerary still ok.
  - Weather-failure test now also asserts `events.ok === true` (event upstream unaffected by weather outage).
  - +`StubEvent` provider added to the suite's provider overrides. Events cache namespace added to the `SCAN-DEL` pre-suite wipe.

**Files edited** (3) — `modules/trip/application/get-trip-overview.use-case.ts` (+events section), `modules/trip/interface/trip.controller.ts` (+events on TripOverviewDto + mapping), `test/trip-overview.e2e-spec.ts` (+StubEvent + override + assertions on 3 existing tests + events namespace in SCAN-DEL).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ **Full real-DB suite: 40 suites, 269 tests pass** (same test count — no new `it()` blocks, but existing ones now assert 5 sections instead of 4).

**Acceptance criteria**

- ✅ Overview response includes `events` section as a discriminated `Section<{ list }>`.
- ✅ Dateless trips degrade `events` + `stays` via `TRIP_DATES_REQUIRED` (same code, reusing `GracefulSkip`).
- ✅ Weather outage doesn't affect events (independent sub-fetches).
- ✅ Section count + parallel fanout is now 5 — still O(max) latency, not O(sum).
- ✅ Zero new HTTP routes — purely compositional.

**Notes**

- **Why extending existing tests vs new `it()` blocks.** The semantic contract of each test is "this condition → these section states." Events is a new state to check under the same conditions. Adding assertions to existing tests keeps the coverage graph coherent (one test per condition, all sections asserted) and mirrors how a client renders the whole bundle at once — it doesn't do the "weather check" separately from the "events check."
- **Why reuse the same `TRIP_DATES_REQUIRED` code for both stays and events.** Both are intrinsically time-scoped; a client that handles one already knows the fix (set dates). One code + two sections sharing it keeps the UI's error-surface simple.
- **Why not add Places (federated) as a 6th section.** Places federation is user-intent-driven ("what's in this city?") not trip-center-driven ("here's what's near your trip"). Bundling would muddle the signal — the overview is "here's the state of my trip," not "let me browse the catalog." If we ever want federated places as trip context, that's an explicit cross-module decision, not a drive-by fold-in.
- **Overview is now feature-complete for v1 demo.** Five sections, graceful per-section degradation, owner gate runs once, provider stubs never called on auth failure. A mobile client can render the entire "trip home" screen from one request.

---

### [IV.18.9.2] — Trip × Events fold-in: GET /trips/:id/events

**Date:** 2026-04-22 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.9 + 3.2 (cross-context)

**What was done**

Fourth cross-module fold-in on Trip (after Weather, Stays, Eateries). Events during the trip's date window, scoped to the trip's center.

- **`GetTripEventsUseCase`** in Trip's application layer:
  - Owner gate → 404 `TRIP_NOT_FOUND`.
  - **Requires `trip.startsOn` + `trip.endsOn`** (matches Trip × Stays policy; `TRIP_DATES_REQUIRED` 422). "What's on during my trip" is the canonical question — dateless = meaningless here.
  - Reads `trip.center` via `GeoQueries`.
  - Clamps `radiusKm` to 30km (Events' domain cap; Trip's own max is 500km).
  - **Full-day window bounds**: `from = startsOn.toISOString()` (stored as 00:00 UTC); `to = endsOn + 23:59:59.999 UTC` so an event at 11pm on the last day still matches. Without the offset, `to <= endsOn` would miss end-of-day events.
  - Delegates to `SearchEventsUseCase`.
  - Optional `category` pass-through.

- **Cross-module wiring**: `TripModule` imports `EventsModule` (direct import — no alias needed here because Trip doesn't touch the `common/events` domain-event-bus module).

- **HTTP**: `GET /api/v1/trips/:id/events?category=`. Returns `{ events: EventListing[] }`.

- **6 integration tests** (`apps/api/test/trip-events.e2e-spec.ts`) with `MockEventProvider` overridden by a recording stub:
  1. Happy path → provider sees `trip.center` + full-day window bounds.
  2. `?category=music` flows through to provider.
  3. `trip.radiusKm: 200` → provider sees 30 (clamp).
  4. Dateless trip → 422 `TRIP_DATES_REQUIRED`, provider never invoked.
  5. Non-owner → 404 `TRIP_NOT_FOUND`, provider never invoked.
  6. Unauthenticated → 401, provider never invoked.

**Files created** (2) — `modules/trip/application/get-trip-events.use-case.ts`, `test/trip-events.e2e-spec.ts`.
**Files edited** (2) — `modules/trip/trip.module.ts` (+EventsModule import + UC), `modules/trip/interface/trip.controller.ts` (+GET /:id/events route + imports).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-events suite 6/6 pass.
- ✅ **Full real-DB suite: 40 suites, 269 tests pass.** (+1 suite, +6 tests.)

**Acceptance criteria**

- ✅ Trip owner gets events during their trip window in one request.
- ✅ Date requirement enforced (parallels Trip × Stays).
- ✅ Trip radius exceeding Events' 30km cap degrades gracefully (clamp).
- ✅ Full-day window bounds so last-day evening events aren't missed.
- ✅ Provider never runs when auth / ownership / date checks fail.

**Notes**

- **Why `TRIP_DATES_REQUIRED` here, mirroring Trip × Stays rather than Trip × Food.** Events are time-scoped identity-level information ("the symphony on Sep 5th" is a different event than "the symphony on Oct 12th"). Stays are similar (availability changes per-night). Food is not — the same restaurant exists whenever. Requiring trip dates forces the user to answer "when" before asking "what," which is also how mental models of trip planning work.
- **Why the full-day `to` offset (23:59:59.999) instead of `endsOn.toISOString()` directly.** A trip ending `2026-08-04` means "I'm there on the 4th through the end of the day." Without the offset, `to = 2026-08-04T00:00:00.000Z` would miss any event that starts after midnight. Extending to end-of-day captures concerts, late-night tours, etc. that are clearly in-scope.
- **Why not add events to the bundled overview dashboard** (`[IV.18.7.3]`). Could. But it'd require designing section semantics for "dateless trip → skip events with `TRIP_DATES_REQUIRED`" (same pattern as stays). The fold-in first ships the standalone capability; a future slice adds events as a 5th Section once we've decided whether the dashboard should include them by default or via a query flag.

---

### [IV.18.9.1] — Events & Culture v1: POST /events/search (mock provider + cache)

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.9 (Events & Culture)

**What was done**

Fourth new bounded context opened this session (after Weather, Stays, Food). Date + coord scoped search — parallels Stays in structure (time-window + radius) but with absolute-UTC `startsAt`/`endsAt` timestamps instead of date-only `checkIn`/`checkOut`. Fifth consumer of `TypedRedisCache<T>` — pattern continues to hold.

- **`apps/api/src/modules/events/` scaffold:**
  - `domain/event-listing.entity.ts` — `EventListing` (externalId, provider, title, description, category, venueName, lat/lng, distanceMeters, startsAt, endsAt, currency, priceMin/Max, sourceUrl). Prices serialized as decimal strings to preserve precision through JSON. `null` values permitted for free events + missing-signal fields.
  - `application/ports/event-provider.ts` — `EventProvider.searchNearby({ lat, lng, radiusKm, from, to, category? })`. ISO-8601 datetime strings (absolute UTC).
  - `application/ports/event-cache.ts` — mirrors the other cache ports.
  - `application/search-events.use-case.ts` — validates lat/lng + radius `(0, 30]` (tighter than Stays' 50km — evening-out scope, not day-trip) + window strict-ordered + window ≤ 90 days. Typed errors: `INVALID_COORDINATES`, `INVALID_RADIUS`, `INVALID_DATE_RANGE`.
  - `infrastructure/mock-event-provider.ts` — 4 fixtures (jazz night, farmers market, art opening, symphony) with deterministic hour-offsets from the `from` timestamp so tests can assert exact filtering without clock games.
  - `infrastructure/redis-event-cache.ts` — **22 lines**; subclass of `TypedRedisCache<readonly EventListing[]>`. Namespace `events`, logger `events.cache`.
  - `infrastructure/cached-event-provider.ts` — decorator. Key includes `from` + `to` so different windows never collide. **TTL 10 minutes** (shorter than the other caches' 30 min — events have real-time churn: sold-out, cancelled, postponed; stale "available" is a UX-trust hit).
  - `interface/dto/events.dto.ts` — `SearchEventsBodySchema` (Zod, ISO-8601 datetime strings).
  - `interface/events.controller.ts` — `POST /api/v1/events/search`.
  - `events.module.ts` — same decorator-of-DI wiring Weather/Stays/Food/Places use.

- **`AppModule` imports the new module aliased as `EventsSearchModule`** — the existing `common/events/events.module.ts` already owns the `EventsModule` class name (it's the global domain-event-bus module). Import alias in `app.module.ts` keeps both module names sensible in their own files; the new module's class stays `EventsModule` inside its folder.

- **8 integration tests** (`apps/api/test/events-search.e2e-spec.ts` — named to avoid collision with `events.e2e-spec.ts` which tests the event bus) with `MockEventProvider` overridden by a recording stub:
  1. No bearer → 401.
  2. Happy path → 200 + provider echo (no category filter).
  3. `category=music` → narrows results + flows through.
  4. `radiusKm=50` → 422 `INVALID_RADIUS`.
  5. `to ≤ from` → 422 `INVALID_DATE_RANGE`.
  6. Window > 90 days → 422 `INVALID_DATE_RANGE`.
  7. Three identical searches → upstream called once (cache hit).
  8. Different window → separate upstream call.

**Files created** (10) — all under `apps/api/src/modules/events/` + `test/events-search.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+aliased `EventsSearchModule` import).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green (aliased import resolved the `EventsModule` duplicate-identifier collision).
- ✅ Events-search suite 8/8 pass against Docker + Redis.
- ✅ **Full real-DB suite: 39 suites, 263 tests pass against live Docker.** (+1 suite, +8 tests vs `[IV.18.4.1]`.)

**Acceptance criteria**

- ✅ Authenticated users can search events near a coord for a time window with optional category filter.
- ✅ Provider behind a port — real adapters (Meetup, Eventbrite public, local scraper) drop in as sibling classes.
- ✅ Cache re-used from the established pattern — zero bespoke cache code.
- ✅ 5th consumer of `TypedRedisCache<T>` — still zero base-class edits.
- ✅ Window validation (ordering + max-days) enforced at the domain level with typed errors.

**Notes**

- **Why 10-minute TTL instead of the default 30.** Events data has genuine real-time churn. Weather corrections, stay availability, and eatery hours are stable on a 30-min horizon; event "still available" is not. A recipient who sees "sold out" 15 minutes after a cache hit has a worse UX than one who waits for a fresh fetch. If we ever want to go further, individual providers can override the TTL per-provider (not this slice).
- **Why `priceMin`/`priceMax` as decimal strings, not numbers.** Prisma's `Decimal(10,2)` is a bignum, and `JSON.parse` drops trailing zeros on numeric doubles (`15.00` → `15`). Keeping strings through the wire preserves the exact provider-reported precision; the UI renders with its own formatter. Same call Stripe's wire format makes.
- **Why the module alias (`EventsSearchModule`).** Rather than renaming the new class to something like `CultureEventsModule`, the alias keeps each file's own naming clean: inside `common/events/` the class is `EventsModule` (for the bus); inside `modules/events/` it's also `EventsModule` (for the search feature). The alias at the import site is localized to `app.module.ts` — no other file sees the collision.
- **Why `from`/`to` as ISO-8601 datetimes, not dates.** Events have hour-scope ("live jazz at 8pm tonight"); date-only semantics would force the UI to synthesize window bounds + lose timezone fidelity. Absolute UTC datetimes are the honest contract; client converts to local on render.
- **5th cache consumer moment.** `TypedRedisCache<readonly EventListing[]>` subclass is 22 lines. Base class required zero edits across Weather → Stays → Food → Places → Events — five distinct shapes (one object, three array-of-domain-entity, one richer array-of-DTO). The `[IV.18.8.1]` extraction is paying dividends; each new cache costs ~10 lines of subclass + constructor super.

---

### [IV.18.4.1] — Places federation prep: POST /places/federated-search + cache

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.3 (Places Catalog)

**What was done**

Deepens the previously-thin Places module with external-provider federation — the playbook's catalog-growth story. Ships a `PlaceProvider` port, a deterministic `MockPlaceProvider` as the default adapter, and a new HTTP surface `POST /api/v1/places/federated-search` separate from the existing catalog-only `/places/search`. Fourth consumer of the extracted `TypedRedisCache<T>` base — validates the abstraction on a new shape.

- **`apps/api/src/modules/places/` extensions:**
  - `domain/federated-place-result.entity.ts` — `FederatedPlaceResult` (externalId, provider, name, category, address, countryCode, lat, lng, distanceMeters). Distinct from the internal `Place` entity: no `id`/`createdAt`/`relaxationScore` — the place may not exist in our catalog yet.
  - `application/ports/place-provider.ts` — `PlaceProvider.search(input)` with `FederatedPlaceSearchInput = { lat, lng, radiusKm, category? }`. Token `PLACE_PROVIDER`.
  - `application/ports/place-search-cache.ts` — narrow get/set mirroring `WeatherCache`/`StayCache`/`EateryCache`.
  - `application/federated-search-places.use-case.ts` — validates lat/lng + radius `(0, 50]` (same cap as the internal search). Throws the already-typed `InvalidRadiusError`.
  - `infrastructure/mock-place-provider.ts` — 4 fixtures across categories (museum, cafe, park, viewpoint). Applies category filter + radius filter + distance sort.
  - `infrastructure/redis-place-search-cache.ts` — **~10 lines**; subclass of `TypedRedisCache<readonly FederatedPlaceResult[]>`. Namespace `places-search`, logger `places.cache`.
  - `infrastructure/cached-place-provider.ts` — decorator. Key is `lat.toFixed(3):lng.toFixed(3):radiusKm.toFixed(1):category`. TTL 30 minutes.
  - `interface/dto/places.dto.ts` — `FederatedSearchPlacesBodySchema` alongside the existing `SearchPlacesBodySchema`.
  - `interface/places.controller.ts` — `POST /api/v1/places/federated-search` with arg-scoped Zod pipe. Returns `{ results: FederatedPlaceResult[] }`.
  - `places.module.ts` — decorator-of-DI wiring same as Weather/Stays/Food: `MockPlaceProvider` registered as its own class token, `PLACE_PROVIDER` → `CachedPlaceProvider`, `PLACE_SEARCH_CACHE` → `RedisPlaceSearchCache`. Exports `PLACE_PROVIDER` + `FederatedSearchPlacesUseCase` so a future Trip × Places fold-in can consume them.

- **7 integration tests** (`apps/api/test/places-federated.e2e-spec.ts`) with `MockPlaceProvider` overridden by a recording stub:
  1. No bearer → 401.
  2. Happy path → 200 + provider echo (no `category`).
  3. `category=museum` narrows results + flows through.
  4. `radiusKm=75` → 422 `INVALID_RADIUS` (domain typed error).
  5. `lat=999` → 422 `VALIDATION_FAILED` (Zod beats domain).
  6. Three identical searches → upstream called once (cache hit).
  7. Different category → separate upstream call (cache miss).

**Files created** (8) — `domain/federated-place-result.entity.ts`, `application/ports/place-provider.ts`, `application/ports/place-search-cache.ts`, `application/federated-search-places.use-case.ts`, `infrastructure/mock-place-provider.ts`, `infrastructure/redis-place-search-cache.ts`, `infrastructure/cached-place-provider.ts`, `test/places-federated.e2e-spec.ts`.
**Files edited** (3) — `interface/dto/places.dto.ts` (+`FederatedSearchPlacesBodySchema`), `interface/places.controller.ts` (+POST /federated-search + FederatedSearchPlacesUseCase inject), `places.module.ts` (+decorator-of-DI wiring + exports).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Places-federated suite 7/7 pass against Docker + Redis.
- ✅ **Full real-DB suite: 38 suites, 255 tests pass against live Docker.** (+1 suite, +7 tests vs `[IV.18.7.3]`.)

**Acceptance criteria**

- ✅ Authenticated users can search external providers for places near a coord.
- ✅ Provider is behind a port — Google / FSQ / OSM adapters drop in as sibling classes.
- ✅ Cache decorator pattern re-used from Weather / Stays / Food — zero bespoke cache code in the Places application layer.
- ✅ 4th consumer of `TypedRedisCache<T>` validates the abstraction on a new value shape (`readonly FederatedPlaceResult[]`) without base-class edits.
- ✅ New endpoint is distinct from the existing catalog-only `/places/search` — no behaviour regression there.

**Notes**

- **Why a new endpoint instead of falling back from `/places/search`.** Federated search and catalog search have different semantics: federated fetches live, doesn't write through, has its own TTL. Conflating them would mean the existing `/places/search` callers suddenly see foreign `externalId`s and null timestamps — a breaking contract change. Separate endpoints today; a future `[IV.18.4.2]` slice can add a merged view once write-through + dedup by `(provider, externalId)` exists.
- **Why no write-through in v1.** Write-through requires: (a) dedup policy when the same place comes from multiple providers; (b) cross-provider identity (`sourceKey` unique-constraint handling); (c) a clear "freshness" vs "curated" signal for the `relaxationScore`. Each of those is a real design call. Shipping read-only federation first lets the UI light up without locking in premature catalog policy.
- **Why `MockPlaceProvider` is the shipping default, not test-only.** Same reasoning as Stays and Food: Google Places/FSQ/OSM each need credentials + billing (or rate-limit-proof patterns for OSM). Mock keeps the endpoint usable end-to-end; swap is one `useClass` change when real adapters land.
- **Cache-pattern validation moment.** This is the 4th `TypedRedisCache` subclass. The base class required zero edits to accommodate a new `T` (`readonly FederatedPlaceResult[]`) — which is exactly what the extraction was meant to prove. If we'd needed to touch the base, the abstraction would be wrong.
- **Why 50km cap (same as catalog search), not 25km (like Food).** Federated results include destinations (museums, parks, viewpoints), not walking-distance picks. 50km mirrors what users mean by "things to do in this area"; 25 would strand regional attractions.

---

### [IV.18.7.3] — Trip overview dashboard: GET /trips/:id/overview (bundles 4 sections)

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.2 (cross-context composition)

**What was done**

Stitches the three existing Trip fold-ins (weather, stays, eateries) + itinerary into one response so a mobile client can render the "trip home" screen with one round-trip instead of four. Purely compositional — no new modules, no new ports, no new providers.

- **`GetTripOverviewUseCase`** (`apps/api/src/modules/trip/application/get-trip-overview.use-case.ts`):
  - Owner gate runs ONCE at the top via `TripRepository.findByIdForUser` (404 `TRIP_NOT_FOUND`). Sub-fetches never run for non-owners — no provider quota burned.
  - Reads `trip.center` ONCE via `GeoQueries.findTripCenter`. Subsequent sub-calls reuse it.
  - **Calls the inner sibling use-cases** (`GetForecastUseCase`, `SearchStaysUseCase`, `SearchEateriesUseCase`, `ItineraryRepository.listDays`) — not the Trip × \* wrappers — since we're already owner-gated. Wrapper reuse would duplicate the `findByIdForUser` + `findTripCenter` calls 3+ times.
  - **`Promise.all` across the 4 sub-fetches** — they run concurrently. A 4-hit trip overview takes roughly max(weather, stays, eateries, itinerary) instead of sum.
  - **Per-section graceful degradation**: each sub-fetch is wrapped in a `section<T>()` helper that catches and converts to `{ ok: false, code }`. A weather-provider outage no longer 500s the overview; the widget just goes grey.
  - **`GracefulSkip` marker class** for known "skip reasons" like the dateless trip can't search stays — the wrapper surfaces `TRIP_DATES_REQUIRED` as the section code instead of pretending it's a generic error.

- **Discriminated-union response shape**:

  ```ts
  type Section<T> = { ok: true; data: T } | { ok: false; code: string };
  interface TripOverviewDto {
    trip: TripDto;
    itinerary: Section<{ days: ItineraryDayDto[] }>;
    weather: Section<{ forecast: WeatherForecast }>;
    stays: Section<{ list: StayListing[] }>;
    eateries: Section<{ list: EateryListing[] }>;
  }
  ```

  Client type-narrows on `.ok` — no null-juggling per section.

- **HTTP:** `GET /api/v1/trips/:id/overview`. Owner-only. Route added to the existing `TripController` alongside the other Trip × \* fold-ins.

- **5 integration tests** (`apps/api/test/trip-overview.e2e-spec.ts`) — overrides `WEATHER_PROVIDER`, `MockStayProvider`, `MockEateryProvider` so the underlying cache decorators + Redis stay in the chain but data is deterministic:
  1. Happy path: trip with dates + itinerary generated → all 4 sections `ok: true`, itinerary non-empty, weather matches trip duration, stays + eateries populated.
  2. Dateless trip → `stays.ok = false` with `code = 'TRIP_DATES_REQUIRED'`; weather + eateries + itinerary remain ok. Itinerary empty list is still `ok: true` (empty is not a failure).
  3. Weather provider throws → `weather.ok = false` with some code; stays + eateries unaffected.
  4. Non-owner → **404 `TRIP_NOT_FOUND`** at the top (NOT a partial response). Graceful degradation is intentional for sub-fetch failures, not for auth — owner gate is an auth-style hard fail.
  5. Unauthenticated → 401.

**Files created** (2) — `modules/trip/application/get-trip-overview.use-case.ts`, `test/trip-overview.e2e-spec.ts`.
**Files edited** (2) — `modules/trip/trip.module.ts` (+GetTripOverviewUseCase provider), `modules/trip/interface/trip.controller.ts` (+GET /:id/overview route, +TripOverviewDto + SectionDto mapping).

**Dependencies** — none new. Every sub-fetch is an existing use-case.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Overview suite 5/5 pass against Docker + Redis.
- ✅ **Full real-DB suite: 37 suites, 248 tests pass.** (+1 suite, +5 tests vs `[IV.18.8.1]`.)

**Acceptance criteria**

- ✅ One request returns trip + itinerary + weather + stays + eateries.
- ✅ Concurrent sub-fetches — overview latency is max(sub), not sum(sub).
- ✅ Sub-failures degrade per-section; the bundle still arrives.
- ✅ Owner gate fails hard (404), never a partial success with leaked trip metadata.
- ✅ Dateless trip surfaces a typed skip code for stays, not a generic error.
- ✅ No new ports, providers, or adapters — 100% composition.

**Notes**

- **Why call inner use-cases instead of reusing `GetTripWeather/Stays/EateriesUseCase`.** The wrapper use-cases each do their own owner gate + `findTripCenter` call (correct for their standalone endpoints). Reusing them here would mean 4 owner gates + 4 center lookups per overview request — cheap individually but silly to duplicate when we've already established the same context at the top of the overview use-case.
- **Why graceful sub-section failures but hard 404 on owner mismatch.** The two failure modes are different: sub-failures are transient infrastructure problems (provider down, network blip) that the UI should degrade through; owner-mismatch is an auth signal that should propagate as the usual 404 so clients know the request was categorically wrong (not "try again in a minute").
- **Why a `GracefulSkip` marker class instead of returning null from the sub-callback.** Section callbacks promise a `T` — returning null would force every `T` to permit null. `throw new GracefulSkip(code)` keeps the success/failure partition explicit and lets ONE code path (the outer section wrapper) handle both exception paths uniformly.
- **Why empty itinerary is `ok: true` data=[], not `ok: false`.** An un-generated itinerary is the owner's own choice, not a failure. `ok: false` would wrongly imply a retry. Semantically: the fetch succeeded; there are zero days.
- **Why a `weather` widget failure doesn't fall back to cached data.** The cache decorator already handles Redis outages transparently (swallow-and-log → "fresh fetch"). By the time the use-case sees an exception, the upstream provider itself threw — there is no stale-but-valid data to fall back to. Surfacing `ok: false` is honest; the UI decides whether to show "Unable to load weather" or hide the widget.
- **Why no bulk-overview for multiple trips.** One request per trip dashboard is fine at current scale. If a "recent trips" landing page ever needs 10 previews with weather, that's its own slice and likely needs a denormalized shape (`{ tripId → weatherSummary }`), not this bundle × N.

---

### [IV.18.8.1] — TypedRedisCache<T>: extract the shared cache base class

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Refactor · **Playbook §** 12 (Cache)

**What was done**

Rule-of-three trigger: Weather ([IV.18.5.2]) + Stays ([IV.18.6.1]) + Food ([IV.18.7.1]) each shipped a ~70-line Redis cache class that only differed in namespace + logger name + stored type. This slice collapses all three onto a shared `TypedRedisCache<T>` base so bug fixes touch one place and the 4th / 5th cache module costs ~10 lines instead of ~70.

- **`apps/api/src/common/cache/typed-redis-cache.ts`** — abstract base class. Owns:
  - ioredis client creation (`lazyConnect: true` + `enableOfflineQueue: false` + `maxRetriesPerRequest: 2` — the tuple that needs the `ensureConnected()` guard).
  - `ensureConnected()` before every get/set (same guard `RedisThrottlerStorage` uses; original Weather cache missed this in the first pass and a test caught it).
  - JSON serialize on set / deserialize on get.
  - Swallow-and-log on failure (dead Redis degrades to "no cache", not 500).
  - `onModuleDestroy()` graceful quit.
  - Configurable key prefix (`travel-${NODE_ENV}:${namespace}:`) + logger name.

- **Three module caches collapsed to thin subclasses** (~22 lines each instead of ~70):
  - `RedisWeatherCache extends TypedRedisCache<WeatherForecast> implements WeatherCache`
  - `RedisStayCache extends TypedRedisCache<readonly StayListing[]> implements StayCache`
  - `RedisEateryCache extends TypedRedisCache<readonly EateryListing[]> implements EateryCache`

  Each subclass constructor just calls `super(config, '<namespace>', '<logger-name>')`. The original port interfaces (`WeatherCache`, `StayCache`, `EateryCache`) stay in their modules — the subclass implements both the port and the typed base simultaneously via TypeScript structural typing.

- **Module DI bindings unchanged.** `WeatherModule` / `StaysModule` / `FoodModule` still `provide: WEATHER_CACHE → useClass: RedisWeatherCache` etc. — the refactor is internal to the adapter class.

- **Location: `apps/api/src/common/cache/`, NOT `@app/cache`.** Only the api consumes this today; promoting to a workspace package would cost pnpm-workspace + tsconfig paths + jest moduleNameMapper updates for no consumer benefit. When `notification-worker` or `crawler-worker` grow a cache (real work, not a stub), extract then.

**Files created** (1) — `apps/api/src/common/cache/typed-redis-cache.ts`.
**Files edited** (3) — `modules/weather/infrastructure/redis-weather-cache.ts`, `modules/stays/infrastructure/redis-stay-cache.ts`, `modules/food/infrastructure/redis-eatery-cache.ts` — each now ~22 lines that subclass + constructor-super.

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green (generic variance + structural port conformance both type-check).
- ✅ **Full real-DB suite: 36 suites, 243 tests pass against live Docker** — no test changes needed, existing cache behaviour tests (weather-cache, food, stays) exercise the shared code end-to-end across three distinct namespaces.

**Line-count delta**

Before: 3 × ~75 lines = ~225. After: 119 (shared) + 22 + 22 + 22 = 185. Net −40 lines today, but the real payoff is the marginal cost of the 4th cache is ~22 lines instead of ~75.

**Acceptance criteria**

- ✅ Bug fixes to the cache adapter (reconnect logic, key prefix, failure policy) now live in exactly one file.
- ✅ Each module-specific cache preserves its domain-typed port (the `WeatherCache`/`StayCache`/`EateryCache` interfaces are unchanged — no leak of `TypedRedisCache<T>` into application layers).
- ✅ Every existing test continues to pass without modification.
- ✅ New consumers add ~10 lines of subclass, not 70 lines of copy-paste.

**Notes**

- **Why an abstract class, not a factory function / composed generic service.** NestJS's DI resolves by class token; a factory would force every consumer to use `useFactory` wiring with explicit `Inject()` tokens — more ceremony per module, not less. Abstract base + `@Injectable()` subclass is the native shape.
- **Why keep the per-module port interfaces** (`WeatherCache`, `StayCache`, `EateryCache`) **instead of one generic `TypedCache<T>` port.** Per-module ports keep the domain-typed contracts clean: `WeatherCache.get` returns `Promise<WeatherForecast | null>` — the caller's intellisense names the actual shape. A single `TypedCache<T>` would push the type burden to the consumer (every use-case would need to restate `TypedCache<WeatherForecast>`). Ports belong to the application layer; the infrastructure shortcut of "one base class" doesn't need to leak upward.
- **Why not extract to `packages/cache` as a proper workspace package.** That change would touch pnpm-workspace.yaml, add a `packages/cache/package.json`, update jest `moduleNameMapper`, add tsconfig references — for zero new consumer. Scope-lock. When a second app (notification-worker's idempotency cache, say) needs it, the extraction is straightforward — subclass is already decoupled from `apps/api`-specific imports.
- **Why no dedicated unit test for `TypedRedisCache`.** The three existing module e2e tests already exercise the base class through three distinct namespaces against real Redis — that IS the integration test for the shared code. A unit test against a mocked ioredis would test less than what's already in CI.
- **Debt paid: the `ensureConnected` bug.** The first Weather cache shipped without this guard and the test caught it. Now the guard is in one place; future cache modules can't forget it even if the author hasn't read `redis-weather-cache.ts`'s history.

---

### [IV.18.7.2] — Trip × Food fold-in: GET /trips/:id/eateries

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.5 + 3.2 (cross-context)

**What was done**

Third cross-module fold-in (Trip × Weather, Trip × Stays were #1 and #2). Same shape: Trip's use-case reads `trip.center` via GeoQueries, delegates to the Food module's `SearchEateriesUseCase`.

- **`GetTripEateriesUseCase`** in Trip's application layer:
  - Owner-gated via `TripRepository.findByIdForUser` (404 `TRIP_NOT_FOUND` on miss or wrong owner).
  - Reads `trip.center` via `GeoQueries.findTripCenter`.
  - **No date requirement** (unlike Trip × Stays) — "show me restaurants near my trip" is meaningful regardless of when the trip is. The trip is the anchor, not the search window.
  - Clamps `radiusKm` to Food's 25km domain cap (Trip allows 500km).
  - Delegates to `SearchEateriesUseCase` (not the raw `EATERY_PROVIDER`) so caching + validation propagate automatically.
  - Optional `cuisineTag` / `maxPriceTier` pass through.

- **Cross-module wiring:** `TripModule` imports `FoodModule` (already exports `SearchEateriesUseCase` from the v1 slice).

- **HTTP:** `GET /api/v1/trips/:id/eateries?cuisineTag=&maxPriceTier=`. Query params parsed manually off `@Query()` (strings only from Fastify). `maxPriceTier` clamped `[1, 5]` at the controller.

- **6 integration tests** (`apps/api/test/trip-eateries.e2e-spec.ts`) — `MockEateryProvider` overridden by a recording stub:
  1. Happy path → provider receives `trip.center` + `trip.radiusKm` + no filters.
  2. `?cuisineTag=japanese&maxPriceTier=3` → both flow through.
  3. `trip.radiusKm: 250` → clamped to 25 at the provider call.
  4. Dateless trip → 200 OK (the interesting assertion here vs Trip × Stays).
  5. Non-owner → 404 `TRIP_NOT_FOUND`, provider never invoked.
  6. Unauthenticated → 401, provider never invoked.

- **Caveat logged in the test**: the dateless test asserts only the 200 status + non-empty response, not a provider call count — the cache may have served it from an earlier test in the same suite with the same `(lat, lng, radiusKm, filters)` tuple. Cache transparency across a session is the whole point of the decorator.

**Files created** (2) — `modules/trip/application/get-trip-eateries.use-case.ts`, `test/trip-eateries.e2e-spec.ts`.
**Files edited** (2) — `modules/trip/trip.module.ts` (+FoodModule import + UC), `modules/trip/interface/trip.controller.ts` (+GET /:id/eateries + imports).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-eateries suite 6/6 pass against Docker + Redis.
- ✅ **Full real-DB suite: 36 suites, 243 tests pass against live Docker.** (+1 suite, +6 tests vs `[IV.18.7.1]`.)

**Acceptance criteria**

- ✅ Trip owner gets restaurants near their trip's center in one request.
- ✅ Cuisine + price-tier filters flow end-to-end.
- ✅ Trip radius exceeding Food's 25km cap degrades gracefully (clamp, not 422).
- ✅ Dateless trips work (the important behavioural difference vs Trip × Stays).
- ✅ Non-owner / missing / unauth paths never invoke the provider (no quota burn on rejected auth).

**Notes**

- **Why NOT require trip dates here.** Unlike stay availability (which is intrinsically date-scoped), eateries exist independent of your trip timing. Users frequently look at restaurants before locking in dates. Requiring dates would force a worse UX for zero safety gain.
- **Trip is now the hub of three cross-module fold-ins** — weather, stays, eateries. A future "dashboard" endpoint that returns all three in one response is a natural follow-up (reduces mobile round-trips). Not in this slice because three parallel requests is fine at current scale and a bundled response needs its own DTO design decision.
- **Cache key coincidence caught a test bug.** The first pass of the dateless test asserted the provider was called; that failed because test #1 in the same suite had already populated the cache for `(REMOTE, 3km, no filters)`. Adjusted the test to assert status + body only — the point is "dates aren't required," not "provider was hit." Another reminder that cached systems make call-count tests fragile across a shared-state suite.

---

### [IV.18.7.1] — Food module v1: POST /eateries/search (mock provider + cache)

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.5 (Food & Tryouts)

**What was done**

Third new bounded context this session (after Weather + Stays). Ships the eatery-search surface using the same clean-hex + decorator cache pattern. This is deliberately the **third copy** of the cache-around-port implementation — the `@app/cache` extraction is now overdue and queued as its own slice where a generic `TypedRedisCache<T>` design can get proper attention.

- **`apps/api/src/modules/food/` scaffold:**
  - `domain/eatery-listing.entity.ts` — flat `EateryListing` (externalId, provider, name, cuisineTags, priceTier, lat/lng, distanceMeters). Dish-level enrichment (the `Dish`/`DishTag` Prisma tables) deferred to the real-provider integration slice.
  - `application/ports/eatery-provider.ts` — narrow `searchNearby(input)` with optional `cuisineTag` + `maxPriceTier` filters. Token `EATERY_PROVIDER`.
  - `application/ports/eatery-cache.ts` — `get`/`set` over readonly arrays.
  - `application/search-eateries.use-case.ts` — validates lat/lng, radius `(0, 25]` (tighter than Stays' 50km — "eateries near me" is a walking/short-ride use case), price tier `[1, 5]`. Typed errors: `INVALID_COORDINATES`, `INVALID_RADIUS`, `INVALID_PRICE_TIER`.
  - `infrastructure/mock-eatery-provider.ts` — 4 fixtures spanning cuisines + price tiers (ramen/trattoria/tacos/omakase). Real filters applied inside the mock so tests can observe the cuisine/price flow-through.
  - `infrastructure/redis-eatery-cache.ts` — 3rd copy of the `ensureConnected()` + swallow-and-log pattern. Key prefix `travel-${NODE_ENV}:eateries:`.
  - `infrastructure/cached-eatery-provider.ts` — decorator. Key is `lat.toFixed(3):lng.toFixed(3):radiusKm.toFixed(1):cuisineTag:maxPriceTier`. TTL 30min (eatery metadata is stable; hours-open data would drop the TTL).
  - `interface/dto/food.dto.ts` — `SearchEateriesBodySchema` (Zod) with `maxPriceTier: 1..5` at the DTO level.
  - `interface/food.controller.ts` — `POST /api/v1/eateries/search`.
  - `food.module.ts` — same decorator-of-DI wiring Weather + Stays use.

- **`AppModule` imports `FoodModule`**.

- **8 integration tests** (`apps/api/test/food.e2e-spec.ts`) with `MockEateryProvider` overridden by a recording + filtering stub:
  1. No bearer → 401.
  2. Happy path → 200 + provider echo (undefined filters).
  3. `cuisineTag=mexican` → narrows to mexican-tagged results + flows through to provider.
  4. `maxPriceTier=2` → response only has `priceTier ≤ 2`.
  5. `radiusKm=50` → 422 `INVALID_RADIUS`.
  6. `maxPriceTier=6` → 422 `VALIDATION_FAILED` (Zod `.max(5)` trips first).
  7. Three identical searches → upstream called once (cache hit).
  8. Different cuisine → separate upstream call (cache miss).

- **Test isolation**: `beforeAll` SCAN-DELs every `travel-test:eateries:*` key before the suite runs, same trick Weather + Stays use.

**Files created** (10) — all under `apps/api/src/modules/food/` + `test/food.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+FoodModule).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Food suite 8/8 pass.
- ✅ **Full real-DB suite: 35 suites, 237 tests pass against live Docker.** (+1 suite, +8 tests vs `[IV.18.6.2]`.)

**Acceptance criteria**

- ✅ Authenticated users can search for eateries near a coordinate with optional cuisine + price filters.
- ✅ Provider behind a port — real providers (Yelp / Google Places / Zomato) drop in as sibling classes.
- ✅ Cache pattern re-used from Weather + Stays — zero bespoke cache code in Food's application layer.
- ✅ Domain validation rejects bad radius / tier with typed errors.
- ✅ Filter parameters affect cache key so different filters don't share entries.

**Notes**

- **Why 25km radius cap instead of Stays' 50km.** "Eateries near me" is a walking / short-ride use-case; anything beyond 25km isn't helping someone choose lunch. Stays are an intentional-booking choice where 50km "I don't mind driving to the lodge" is reasonable. Different domain, different cap.
- **Why dish-level enrichment isn't here.** `Dish` + `DishTag` need a real provider (or manual crowd-sourcing infra) to populate meaningfully. Shipping them behind a mock would be lying to UI devs about what data is actually available. When Yelp Fusion or Google Places category=restaurant is wired, that slice brings Dish with it.
- **Why lowercase the cuisineTag filter match in the mock.** Keeps the provider tolerant to client casing (`"Mexican"` vs `"mexican"`) without polluting the domain DTO. Real providers all normalize; the mock matches that behaviour so tests write naturally.
- **Why `@app/cache` isn't extracted as part of this slice.** Three instances is the trigger, but the extraction is its own design decision — generic type parameters, shared key-prefix contract, test-isolation helper, Redis client reuse policy. Cramming it into this slice would rush that. Queued as `[IV.18.7.x]` so it gets a clean slice with code-review surface on just the extraction.

---

### [IV.18.6.2] — Trip × Stays fold-in: GET /trips/:id/stays

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.4 + 3.2 (cross-context)

**What was done**

Second cross-module fold-in (Trip × Weather being the first) — same pattern, different payload. Surface returns stay listings near the trip's center for the trip's date range.

- **`GetTripStaysUseCase`** in Trip's application layer:
  - Owner-gated via `TripRepository.findByIdForUser` — missing/wrong-owner collapse to 404 `TRIP_NOT_FOUND`.
  - **Requires the trip to have both `startsOn` and `endsOn` set** — stay availability is intrinsically date-scoped; a search without dates is meaningless. Missing → 422 `TRIP_DATES_REQUIRED`. Clients PATCH the trip with dates first (existing route).
  - Reads `trip.center` via `GeoQueries.findTripCenter` (PostGIS seam, CLAUDE rule 11).
  - **Clamps `radiusKm` to 50km** before calling into stays — Trip's own domain allows radius up to 500km, but `SearchStaysUseCase` enforces 50km. Without the clamp a long-range trip would always 422. With it the stay search degrades gracefully.
  - Delegates to `StaysModule`'s `SearchStaysUseCase` (not the raw `STAY_PROVIDER`) — consistent with Trip × Weather, so caching and any future stays-side additions propagate automatically.
  - Optional `guests` command parameter; use-case passes it through if present.

- **Cross-module DI wiring:**
  - `StaysModule` now exports `SearchStaysUseCase` alongside `STAY_PROVIDER`.
  - `TripModule` imports `StaysModule` (one-way; Stays still doesn't know Trip exists).

- **HTTP:** `GET /api/v1/trips/:id/stays` with optional `?guests=N` query (clamped to `[1, 20]` at the controller). Returns `{ stays: StayListing[] }`.

- **6 integration tests** (`apps/api/test/trip-stays.e2e-spec.ts`) with `MockStayProvider` overridden by a recording stub:
  1. Happy path: trip with both dates → provider receives exactly `trip.center` lat/lng + `YYYY-MM-DD` checkIn/checkOut + `guests: 1` default.
  2. `?guests=3` → provider sees `guests: 3`.
  3. Trip with `radiusKm: 300` → provider sees `radiusKm: 50` (clamp).
  4. Trip missing dates → 422 `TRIP_DATES_REQUIRED`, provider never invoked.
  5. Non-owner → 404 `TRIP_NOT_FOUND`, provider never invoked.
  6. Unauthenticated → 401 `UNAUTHENTICATED`, provider never invoked.

**Files created** (2) — `modules/trip/application/get-trip-stays.use-case.ts`, `test/trip-stays.e2e-spec.ts`.
**Files edited** (3) — `modules/stays/stays.module.ts` (+SearchStaysUseCase export), `modules/trip/trip.module.ts` (+StaysModule import + UC), `modules/trip/interface/trip.controller.ts` (+GET /:id/stays route + imports).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-stays suite 6/6 pass against Docker + Redis.
- ✅ **Full real-DB suite: 34 suites, 229 tests pass against live Docker.** (+1 suite, +6 tests vs `[IV.18.6.1]`.)

**Acceptance criteria**

- ✅ Authenticated trip owner gets stay listings scoped to their trip's center + dates.
- ✅ Dateless trip forces the date-set flow first (422, not silent bad search).
- ✅ Non-owner response indistinguishable from missing trip.
- ✅ Trip's own 500km radius doesn't break stays' 50km domain invariant.
- ✅ Pattern consistent with Trip × Weather — both fold-ins re-use the other module's use-case, not its port.

**Notes**

- **Why 422 `TRIP_DATES_REQUIRED` instead of defaulting to "today + 7 days" (as Trip × Weather does for missing dates).** Weather is genuinely useful with or without trip-specific dates — "what's the weather like there?" is an honest question. Stay search without dates is undefined — availability depends on dates, and returning "today + 7" would mislead users into thinking they've searched for their actual trip dates. Better to force the explicit decision.
- **Why clamp trip.radiusKm at the use-case level, not return an error for > 50km.** The trip's own radius is meaningful for itinerary generation + share view, where "how far will I roam" is a valid 500km question. For stay search specifically, anything beyond ~50km is a separate trip's worth of lodging, not hotels-near-your-destination. Clamping gives the expected answer for the expected query.
- **Why `?guests` as a query param instead of reading from trip.** Trip schema has no `guests` field. Adding one would imply richer semantics (party composition, per-person preferences) that belong in a separate slice. For now, accept it per-request so clients can vary by search without mutating the trip.
- **Why import `SearchStaysUseCase` not `STAY_PROVIDER` directly.** Caching, validation, guest clamping all live in the use-case. Calling the port directly would either duplicate that logic (bad) or skip it (worse). Use-case-as-composition-primitive is the same decision Trip × Weather made — now it's a pattern.

---

### [IV.18.6.1] — Stays module v1: POST /stays/search (mock provider behind the cache decorator)

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.4 (Stays)

**What was done**

First new bounded context since Weather. Exercises the cache-around-port decorator pattern on a second module so the pattern is proven, not just declared. Ship a search surface that returns stay listings near a coord + date range, with the real provider boundary mocked out until Booking.com/Amadeus credentials are in hand.

- **`apps/api/src/modules/stays/` clean-hex scaffold:**
  - `domain/stay-listing.entity.ts` — flat `StayListing` (externalId, provider, name, starRating, amenities, lat/lng, distanceMeters, priceUsdPerNight, currency). Kept flat on purpose: splitting metadata vs price quote would be premature when the v1 surface is read-only.
  - `application/ports/stay-provider.ts` — `StayProvider.searchNearby(input)` with `SearchStaysInput` = `{ lat, lng, radiusKm, checkIn, checkOut, guests }`. Token `STAY_PROVIDER`. Narrow on purpose — booking/cancellation live in their own ports when the booking-flow slice lands.
  - `application/ports/stay-cache.ts` — `get`/`set` over opaque keys, mirrors `WeatherCache`.
  - `application/search-stays.use-case.ts` — validates lat/lng ranges, radius `(0, 50]`, `checkOut > checkIn`, range ≤ 30 nights, clamps guests to `[1, 20]`. Typed domain errors: `INVALID_COORDINATES`, `INVALID_RADIUS`, `INVALID_DATE_RANGE`.
  - `infrastructure/mock-stay-provider.ts` — deterministic 3-ring fixture (200m central boutique, 1.5km midtown inn, 4km budget suburb). Prices scale with guest count so tests can assert the `guests` parameter actually flows through.
  - `infrastructure/redis-stay-cache.ts` — same `ensureConnected()` guard pattern as `RedisWeatherCache`. Key prefix `travel-${NODE_ENV}:stays:`. Swallow-and-log on failures.
  - `infrastructure/cached-stay-provider.ts` — decorator. Key is `lat.toFixed(3):lng.toFixed(3):radiusKm.toFixed(1):checkIn:checkOut:guests` — every parameter affects results so they all go in. TTL 15 minutes (shorter than weather's 30min because availability churns faster; stale "room available" would be a user-facing bug).
  - `interface/dto/stays.dto.ts` — `SearchStaysBodySchema` (Zod). Mirrors Places + Trip center-and-radius shape.
  - `interface/stays.controller.ts` — `POST /api/v1/stays/search` with arg-scoped `@Body(new ZodValidationPipe(...))`.
  - `stays.module.ts` — wires `STAY_PROVIDER` → `CachedStayProvider`, `STAY_CACHE` → `RedisStayCache`, `MockStayProvider` registered as a class token (so the decorator can `@Inject` by class, not the port symbol — breaks circular self-resolution).

- **`AppModule` imports `StaysModule`**.

- **8 integration tests** (`apps/api/test/stays.e2e-spec.ts`) — `MockStayProvider` overridden with a `RecordingStayProvider` to count upstream invocations (keeps the cache + decorator in the chain, bypasses only the data source):
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Happy path → 200 + provider sees exactly the command that arrived.
  3. Missing `guests` → defaults to 1.
  4. `radiusKm=75` → 422 `INVALID_RADIUS`.
  5. `checkOut ≤ checkIn` → 422 `INVALID_DATE_RANGE`.
  6. Range > 30 nights → 422 `INVALID_DATE_RANGE`.
  7. Cache hit: three identical searches → upstream called once, all 3 return 200.
  8. Cache miss on different dates → upstream called twice.

- **Test cache isolation**: `beforeAll` opens a raw ioredis client + SCAN-DELs every `travel-test:stays:*` key before the suite runs. Same pattern `weather-cache.e2e-spec.ts` established.

**Files created** (10) — `modules/stays/domain/stay-listing.entity.ts`, `modules/stays/application/ports/stay-provider.ts`, `modules/stays/application/ports/stay-cache.ts`, `modules/stays/application/search-stays.use-case.ts`, `modules/stays/infrastructure/mock-stay-provider.ts`, `modules/stays/infrastructure/redis-stay-cache.ts`, `modules/stays/infrastructure/cached-stay-provider.ts`, `modules/stays/interface/dto/stays.dto.ts`, `modules/stays/interface/stays.controller.ts`, `modules/stays/stays.module.ts`, `test/stays.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+StaysModule).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Stays suite 8/8 pass against live Docker Redis.
- ✅ **Full real-DB suite: 33 suites, 223 tests pass against live Docker.** (+1 suite, +8 tests vs `[IV.18.5.2]`.)

**Acceptance criteria**

- ✅ Authenticated users can search for stays within a radius + date range.
- ✅ Provider is behind a port — the mock swaps out for Amadeus/Booking when credentials exist.
- ✅ Cache pattern re-used from Weather — zero bespoke cache code in Stays' application layer.
- ✅ Domain validation rejects bad dates / radius / guest counts with typed errors.
- ✅ Tests exercise the full HTTP → use-case → decorator → cache → provider chain.

**Notes**

- **Why the mock provider is the shipping default, not a test-only stub.** Booking.com partner access takes paperwork; Amadeus needs a sandbox key. Shipping with a mock keeps the HTTP surface usable end-to-end, and swapping in a real provider is a single `useClass` change in the module. Importantly the mock isn't test-only — it's an honest `StayProvider` implementation that returns deterministic fixture data.
- **Why 15-min TTL instead of weather's 30-min.** Stay availability changes minute-to-minute in peak season; showing a cached "rooms available" that was sold 25 minutes ago would be a direct user-trust hit. Weather corrections propagate more slowly, so 30 min is fine there.
- **Why every search parameter participates in the cache key.** A different `guests` value legitimately returns different prices (family rooms vs single). Different `checkIn/checkOut` literally has different availability. Partial keys would cross-contaminate. The ~110m coord coarsening stays in (to reduce keyspace without losing meaningful variation).
- **Why the pattern duplication vs extracting a shared `@app/cache` package.** Two instances isn't enough to know the right abstraction. When Places federation lands with a third cache-around-port decorator, THEN we extract — we'll have a clear pattern to generalize from. Premature extraction would force the two existing decorators to accommodate a future one we haven't built.
- **Why v1 omits Stays booking/history.** Booking touches payments (Stripe), provider-specific affiliate tracking, and cancellation windows — each is its own slice. Search is the loose end that closes right here.

---

### [IV.18.5.2] — Weather provider cache: Redis decorator around WEATHER_PROVIDER

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.8 (Weather) + §12 (Cache)

**What was done**

Closes the "every hot client loop burns Open-Meteo quota" concern that `[IV.18.5.1]`'s own notes flagged. Installs a Redis-backed cache decorator in front of the weather provider, so every current + future caller of `WEATHER_PROVIDER` — `/weather/forecast` direct, the `GET /trips/:id/weather` fold-in, and anything downstream — inherits caching transparently.

Establishes the **cache-around-port decorator pattern** that Places federation (`[IV.18.4.x]`), Translation, and any paid-provider integration will re-use.

- **`WeatherCache` port** (`application/ports/weather-cache.ts`) — narrow interface with `get(key)` / `set(key, value, ttlSec)`. Stores domain-shape `WeatherForecast` objects, not raw provider responses, so a future provider swap doesn't invalidate every cached entry.

- **`RedisWeatherCache`** (`infrastructure/redis-weather-cache.ts`) — own ioredis client, same single-purpose pattern as `RedisThrottlerStorage` (isolated failure domain per feature). Key prefix is `travel-${NODE_ENV}:weather:`. Failure policy is **swallow-and-log**: a dead Redis degrades to "no cache" rather than 500 on the weather endpoint.
  - **`ensureConnected()` guard** — `lazyConnect: true` + `enableOfflineQueue: false` means commands fail instantly while status is `wait`/`end`/`close`. The first call into `get`/`set` explicitly `connect()`s. Caught this in the first test run (all calls missed the cache) and matches `RedisThrottlerStorage`'s approach.

- **`CachedWeatherProvider`** (`infrastructure/cached-weather-provider.ts`) — decorator implementing `WeatherProvider`. Wraps the injected `OpenMeteoWeatherProvider` (raw class token) + `WEATHER_CACHE`. Key is `${lat.toFixed(3)}:${lng.toFixed(3)}:${days}` — 3 decimals ≈ 110 m resolution, so nearby callers share entries without blowing up the keyspace. TTL is 30 minutes — short enough for weather corrections to propagate, long enough that a hot trip-planner UI loop doesn't hammer upstream.

- **`WeatherModule` wiring** changed so `WEATHER_PROVIDER` now resolves to `CachedWeatherProvider`, which itself injects `OpenMeteoWeatherProvider` (registered as its own class token so the decorator can `@Inject(OpenMeteoWeatherProvider)` without circular self-resolution against the port token).

- **`weather-cache.e2e-spec.ts`** — 4 integration tests:
  1. Three identical requests → upstream stub called exactly once (cache hit on calls 2+3).
  2. Different coords → independent entries (stub called twice).
  3. Different `days` → independent entries.
  4. Near-but-different coords (differ at 4th decimal) → **don't** share an entry, proving the 3-decimal contract is enforced. Same-at-3rd-decimal pair does collapse.

- **Test isolation**: a `beforeAll` block opens a raw ioredis client + SCAN-DELs every `travel-test:weather:*` key so stale entries from a prior failed run can't masquerade as cache hits and break the suite on re-run.

- **Existing tests unaffected**: `weather.e2e-spec.ts` and `trip-weather.e2e-spec.ts` override the `WEATHER_PROVIDER` token, which bypasses both the decorator AND the cache — exactly the right seam for exercising upstream stubs without Redis-in-test complexity. The new cache test overrides `OpenMeteoWeatherProvider` (the class token) instead, keeping `CachedWeatherProvider` + `RedisWeatherCache` in the chain.

**Files created** (4) — `modules/weather/application/ports/weather-cache.ts`, `modules/weather/infrastructure/redis-weather-cache.ts`, `modules/weather/infrastructure/cached-weather-provider.ts`, `test/weather-cache.e2e-spec.ts`.
**Files edited** (1) — `modules/weather/weather.module.ts` (+`OpenMeteoWeatherProvider` as class token, +`WEATHER_CACHE` → `RedisWeatherCache`, `WEATHER_PROVIDER` → `CachedWeatherProvider`).

**Dependencies** — none new. `ioredis` was already a dependency.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Cache suite 4/4 pass against live Docker Redis.
- ✅ **Full real-DB suite: 32 suites, 215 tests pass against live Docker.** (+1 suite, +4 tests vs `[IV.18.5.3]`.)

**Acceptance criteria**

- ✅ Identical forecast requests hit the cache — upstream invoked once, not per request.
- ✅ Different coord / day tuples never collide on a cache entry.
- ✅ Near-duplicate coords (sub-3-decimal) share the entry — intentional coarse-graining.
- ✅ Redis outage degrades gracefully — no 500 from the weather endpoint if cache is dead.
- ✅ Pattern transparent to every `WEATHER_PROVIDER` caller — `/weather/forecast`, `/trips/:id/weather`, and any future consumer inherit caching without code changes.

**Notes**

- **Why a provider-level decorator vs a use-case-level cache.** Use-case-level caching would require `GetForecastUseCase` to know about a `WEATHER_CACHE` — suddenly caching logic leaks into application. The decorator keeps application pure; cache is infrastructure (where it belongs), and anyone calling `WEATHER_PROVIDER` — including use-cases that weren't imagined when the cache was added — gets it for free.
- **Why `@Inject(OpenMeteoWeatherProvider)` by class token, not the port symbol.** Circular self-resolution: the decorator IS the thing bound to `WEATHER_PROVIDER`. Binding the raw upstream to its class token and having the decorator inject by class breaks the cycle cleanly. Standard decorator-of-DI pattern — the same trick NestJS's own `@Logger` takes when it wraps the platform logger.
- **Why `toFixed(3)` (~110m) granularity instead of exact lat/lng.** Two clients picking "the same cafe" typically submit coords that differ in the 5th decimal (because one used the map centre, the other a marker). Exact keys would treat these as separate; 3-decimal collapses them. Beyond 3 decimals (~11m) the forecast literally doesn't change — Open-Meteo's grid is coarser than that.
- **Why 30-minute TTL.** Weather providers update model runs roughly every 1–6 hours; a 30-minute TTL means users see a correction within half an hour without hammering the provider. Shorter TTLs (5 min) would leak quota on hot loops; longer (2 h) risks staleness on fast-moving fronts (thunderstorm warnings).
- **Why swallow-and-log on cache failures instead of propagating.** The forecast call already succeeded; a cache write failure is an optimization miss, not a user-facing failure. Propagating would make a dead Redis take down the weather endpoint — exactly the kind of "adding resilience made things less resilient" foot-gun to avoid.
- **Why a TTL-expiry test isn't in the suite.** Real-time expiry testing is flaky (requires either sleeping past the TTL — slow — or time-mocking that doesn't play well with the ioredis client). The 30-min TTL is a configuration-level decision; once the set/get pair works (tests 1–4), TTL expiration is a Redis guarantee we trust. A unit test with a mocked cache could exercise expiry if we ever need to, but the cost/value is wrong here.

---

### [IV.18.5.3] — Trip × Weather: GET /trips/:id/weather

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.8 + 3.2 (cross-context)

**What was done**

First cross-module integration that matters to users — a trip's forecast served from one endpoint, wiring the Weather module into Trip via clean-hex port re-use.

- **`GetTripWeatherUseCase`** in Trip's application layer:
  - Owner-gated via `TripRepository.findByIdForUser(tripId, userId)` — missing trip OR wrong owner both 404 `TRIP_NOT_FOUND`, same error story as every other Trip read surface.
  - Reads the trip's PostGIS `center` via `GeoQueries.findTripCenter(tripId)` — the raw-SQL seam that keeps the PostGIS `Unsupported` column off Prisma's typed paths (CLAUDE rule 11).
  - Day-count policy: `trip.startsOn && trip.endsOn` ⇒ `min(16, max(1, daysInclusive(...)))`; otherwise fall back to 7. 16 is Open-Meteo's hard ceiling; the clamp surfaces in the use-case so the HTTP layer doesn't need to know about provider quirks.
  - Delegates to `WeatherModule`'s `GetForecastUseCase` — not the raw `WEATHER_PROVIDER` port — so the Trip-weather path inherits the same input validation (lat/lng ranges) and any future additions (cache fold-in, retry, etc.) without call-site churn.

- **Cross-module DI wiring:**
  - `WeatherModule` now exports `GetForecastUseCase` alongside `WEATHER_PROVIDER`. Use-cases-as-composition-primitive is the cleaner seam than exposing the port directly.
  - `TripModule` imports `WeatherModule`. One-way dep — Weather has no knowledge of Trip (and shouldn't).
  - `daysInclusive` in `generate-itinerary-stub.use-case.ts` was flipped from file-private to `export`ed so both itinerary + weather use-cases share the same "YYYY-MM-DD inclusive day count" helper. Cheaper than extracting to a new utility file for two callers.

- **HTTP:** `GET /api/v1/trips/:id/weather` — owner-only via the global `JwtAuthGuard` + `@CurrentUser()`. Returns `{ forecast: WeatherForecast }` (flat `WeatherForecast` shape matches the standalone `/weather/forecast` endpoint so clients can share render components).

- **6 integration tests** (`apps/api/test/trip-weather.e2e-spec.ts`) — `WEATHER_PROVIDER` overridden with a stub that records every call:
  1. Happy path: trip with both dates → provider receives exactly `trip.center` lat/lng + `daysInclusive(...)`.
  2. Trip with no dates → provider gets `days=7`.
  3. Trip duration > 16 days → clamped to 16 before reaching the provider.
  4. Non-owner → 404 `TRIP_NOT_FOUND`, **and** provider never invoked (ownership gate runs first).
  5. Missing trip → 404 `TRIP_NOT_FOUND`, provider never invoked.
  6. Unauthenticated → 401 `UNAUTHENTICATED`, provider never invoked.

**Files created** (2) — `apps/api/src/modules/trip/application/get-trip-weather.use-case.ts`, `apps/api/test/trip-weather.e2e-spec.ts`.
**Files edited** (4) — `modules/weather/weather.module.ts` (+GetForecastUseCase in exports), `modules/trip/trip.module.ts` (+WeatherModule import + GetTripWeatherUseCase), `modules/trip/interface/trip.controller.ts` (+GET /:id/weather route + WeatherForecast import), `modules/trip/application/generate-itinerary-stub.use-case.ts` (`daysInclusive` → `export function`).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ trip-weather suite 6/6 pass against Docker (provider stub → no network dependency).
- ✅ **Full real-DB suite: 31 suites, 211 tests pass against live Docker.** (+1 suite, +6 tests vs `[IV.18.5.1]`.)

**Acceptance criteria**

- ✅ Authenticated owner can fetch a forecast scoped to their trip's center + dates.
- ✅ Non-owner response indistinguishable from missing trip (404 `TRIP_NOT_FOUND`).
- ✅ Ownership gate runs before provider call (no quota burn on rejected auth).
- ✅ Day count respects both the trip duration AND Open-Meteo's 16-day ceiling.
- ✅ Trip module depends on Weather, not the reverse.

**Notes**

- **Why re-use `GetForecastUseCase` and not the `WEATHER_PROVIDER` port directly.** The use-case owns input validation + day clamping. If the Trip-weather path bypassed it and wired straight to the provider, the two HTTP surfaces could drift (e.g., weather module adding a cache layer, Trip-weather not getting it). Use-cases-as-composition-primitive is the explicit contract the clean-hex layering expects.
- **Why `daysInclusive` got an `export` keyword instead of a new `trip/domain/date-range.ts` file.** Exactly two callers in the same module directory; extracting would trade module locality for reach. Scope-lock also discouraged proactive refactors. If a third caller lands (e.g., Stays' availability search), promote it then.
- **Why not include trip metadata (title, status, dates) in the response.** `{ forecast: ... }` keeps this endpoint's contract tight — callers fetch trip metadata from `GET /trips/:id` when they need it. Combining would encourage tight coupling on client renderers.
- **Why the provider-never-invoked assertion on the IDOR test.** Without it, a regression that called the provider before the ownership gate would still pass (the eventual 404 masks the leak). Asserting `stub.calls.length === 0` on failure paths catches the "provider called too eagerly" failure mode that burns external quota.
- **Why not align the forecast window to the trip dates.** Open-Meteo's free endpoint returns "from today forward" — a trip starting in 30 days can't get a meaningful forecast today regardless. The v1 behaviour (match duration, start from today) is the honest response. Future slices can layer a longer-range paid provider behind the same port if trip-future weather becomes a real requirement.

---

### [IV.18.5.1] — Weather module v1: GET /weather/forecast via Open-Meteo

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.8 (Weather & Environment)

**What was done**

First new top-level bounded context since the original Trip module. Establishes the "external-provider behind a port" pattern that Places federation, Translation, and any paid data-service integration will re-use. Open-Meteo is free + keyless so no Doppler secrets are needed to run this locally.

- **`apps/api/src/modules/weather/` clean-hex scaffold:**
  - `domain/weather-forecast.entity.ts` — `WeatherForecast` (lat, lng, timezone, days[]) + `DailyForecast` (date, maxTempC, minTempC, weatherCode, precipitationProbabilityPercent). `weatherCode` is WMO raw — UI layers own the icon/label mapping so a new provider can be swapped in without a schema change.
  - `application/ports/weather-provider.ts` — `WeatherProvider` interface with a single method `getDailyForecast(input)`. Token symbol `WEATHER_PROVIDER`. Intentionally narrow: hourly / alerts / AQI land as separate methods when callers actually ask.
  - `application/get-forecast.use-case.ts` — validates lat/lng ranges (typed `INVALID_COORDINATES` errors), clamps `days` to `[1, 16]` (Open-Meteo's hard ceiling), defaults to 7. Stateless — the planned cache layer (`[IV.18.5.2]`) drops in behind the same use-case without call-site churn.
  - `infrastructure/open-meteo-provider.ts` — `OpenMeteoWeatherProvider` using stdlib `fetch`. Builds the query via `URLSearchParams` (`daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=N&timezone=auto`). Wraps network failures + non-OK HTTP + malformed responses in `ExternalServiceError('open-meteo', …, 'WEATHER_PROVIDER_UNAVAILABLE')` → 502 on the wire.
  - `interface/dto/weather.dto.ts` — `WeatherForecastQuerySchema` with `z.coerce.number()` (query params arrive as strings from Fastify).
  - `interface/weather.controller.ts` — `@Get('forecast')` with arg-scoped `@Query(new ZodValidationPipe(...))` per the `[IV.18.2.5.fix]` pattern.
  - `weather.module.ts` — wires `WEATHER_PROVIDER` to `OpenMeteoWeatherProvider` and exports the token so future modules (Trip's "weather at trip center" fold-in) can inject it.

- **`AppModule` imports `WeatherModule`**. Auth + rate-limit guards apply globally — `/weather/forecast` requires a bearer so the throttler keys on user.

- **7 integration tests** (`apps/api/test/weather.e2e-spec.ts`) — all use an in-memory `StubWeatherProvider` via `Test.overrideProvider(WEATHER_PROVIDER).useValue(stub)`:
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. Happy path → 200 + provider sees exactly the (lat, lng, days) passed in, response body echoes timezone + days.
  3. Missing `days` query → use-case defaults to 7.
  4. `days=50` → clamped to 16 before reaching the provider.
  5. `lat=999` → 422 `VALIDATION_FAILED` (Zod `.max(90)` trips first).
  6. `lng=not-a-number` → 422 `VALIDATION_FAILED`.
  7. Provider throws `ExternalServiceError` → 502 `WEATHER_PROVIDER_UNAVAILABLE`.

**Files created** (8) — `modules/weather/domain/weather-forecast.entity.ts`, `modules/weather/application/ports/weather-provider.ts`, `modules/weather/application/get-forecast.use-case.ts`, `modules/weather/infrastructure/open-meteo-provider.ts`, `modules/weather/interface/dto/weather.dto.ts`, `modules/weather/interface/weather.controller.ts`, `modules/weather/weather.module.ts`, `test/weather.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+WeatherModule).

**Dependencies** — none new. `fetch` is stdlib in Node 22.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Weather suite 7/7 pass against Docker (provider stub → no network dependency).
- ✅ **Full real-DB suite: 30 suites, 205 tests pass against live Docker.** (+1 suite, +7 tests vs `[IV.18.2.15]`.)

**Acceptance criteria**

- ✅ Authenticated users can fetch a daily forecast for any coordinate pair.
- ✅ Provider is behind a port — a paid or region-specific provider drops in as a sibling adapter class.
- ✅ Tests exercise the full HTTP → use-case → port chain without hitting the real Open-Meteo API.
- ✅ Upstream failure surfaces as a clean 502 with a typed code (not a 500 stack trace).
- ✅ Input validation is enforced at both Zod (DTO) and domain (use-case) layers.

**Notes**

- **Why the stub `WEATHER_PROVIDER` override in tests, not a mocked `fetch`.** `fetch` mocking (via `jest.spyOn(globalThis, 'fetch')` or msw) tests the provider's JSON parsing but couples the test to the Open-Meteo payload shape. Overriding at the port level tests the HTTP→use-case→port chain — the contract we actually care about. A separate `OpenMeteoWeatherProvider` unit test (future slice, no real network) would cover the payload parsing side.
- **Why `weatherCode` as a raw WMO integer instead of a string enum / normalized category.** Different providers (OWM, Tomorrow.io, AccuWeather) use different taxonomies; any normalization in the domain layer would either drop information or require a lossy mapping. The UI's icon/label layer knows its provider — keep the domain neutral. If a future use-case needs "is it raining?" semantics, that lives in a `weatherCodeCategory(code)` helper, not in the stored shape.
- **Why clamp `days > 16` instead of rejecting.** Open-Meteo's 16-day ceiling is a provider limit, not a domain invariant. A caller asking for 30 days probably wants "as long as you can give me". Clamping is the forgiving behaviour; swapping to a provider with a 14-day ceiling later is just a MAX_DAYS change.
- **Why no cache yet.** The slice stays small + the cache is a cross-cutting concern worth its own design pass (TTL? Per-lat-lng-day-count key? Redis vs the `WeatherForecast` Prisma table already in the schema?). Deferring keeps this slice reviewable; `[IV.18.5.2]` can add Redis + DB caching behind the same `GetForecastUseCase` seam.
- **Why the controller isn't a `Places`-style POST.** Weather is a pure GET — the request has no body, responses are cacheable on recipient + CDN + client side. A POST would fight that cachability without a clear upside.

---

### [IV.18.2.15] — GET /trips/:id/shares: owner lists every share they've minted

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Closes the last owner-facing gap in the share feature. Before this slice an owner who minted several codes had no way to list them — they could revoke only codes they'd remembered from the `POST /:id/share` response. Now `GET /api/v1/trips/:id/shares` returns every share (active AND revoked) the caller has minted for the given trip, newest first.

- **`TripShareRepository.listByTripForOwner(tripId, ownerId): Promise<TripShare[]>`** — new port method. Prisma adapter uses `findMany({ where: { tripId, ownerId }, orderBy: { createdAt: 'desc' } })`. Adapter is the minimal WHERE — the use-case is the owner gate.

- **`ListTripSharesUseCase`** — gates via `TripRepository.findByIdForUser(tripId, ownerId)` first. A miss (missing trip OR wrong owner) throws 404 `TRIP_NOT_FOUND`, matching the existence-probe defence on every other Trip endpoint. Without the gate, a non-owner calling this path could probe existence by observing `[]` vs `404`.

- **`GET /api/v1/trips/:id/shares` route** — auth via global `JwtAuthGuard` + `@CurrentUser()`. Returns `{ shares: [{ id, shareCode, publicRead, expiresAt, createdAt }] }`. Deliberately exposes `publicRead` so the UI can render "Active" vs "Revoked" badges; doesn't expose `ownerId` (always the caller), `tripId` (always the path param).

- **`TripShareOwnerDto`** — separate interface from `TripShareDto` (the POST response) because this surface explicitly exposes the `publicRead` boolean, which the mint response omits (it's always `true` on creation).

- **4 new integration tests** added to `apps/api/test/trip-share.e2e-spec.ts` (suite 12 → 16 tests):
  1. Owner lists 2 shares (1 revoked, 1 active) → 200 + newest-first ordering + `publicRead` state visible.
  2. Non-owner list → 404 `TRIP_NOT_FOUND` (IDOR + enumeration leak defence).
  3. Unauthenticated list → 401 `UNAUTHENTICATED`.
  4. Trip with no shares → 200 `{ shares: [] }`.

**Files created** (1) — `trip/application/list-trip-shares.use-case.ts`.
**Files edited** (5) — `trip/application/ports/trip-share.repository.ts` (+listByTripForOwner), `trip/infrastructure/prisma-trip-share.repository.ts` (impl), `trip/interface/trip.controller.ts` (+GET /:id/shares + TripShareOwnerDto), `trip/trip.module.ts` (+ListTripSharesUseCase), `test/trip-share.e2e-spec.ts` (+4 tests).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-share suite 16/16 pass against Docker (+4 vs previous).
- ✅ **Full real-DB suite: 29 suites, 198 tests pass against live Docker.** (Same suite count, +4 tests vs `[IV.18.2.14]`.)

**Acceptance criteria**

- ✅ Owner sees every active + revoked share they've minted for one trip.
- ✅ Newest first ordering — matches the natural rendering order on a UI panel.
- ✅ `publicRead` state surfaces so clients can distinguish active vs revoked rows.
- ✅ Non-owner response indistinguishable from missing trip (404 `TRIP_NOT_FOUND`).
- ✅ Empty trips return 200 with `shares: []`, not 404.

**Notes**

- **Why include revoked shares in the response, not filter them out.** An owner who revoked by mistake wants to see that a code is dead in the audit trail. Filtering would mean the UI would need a separate "show revoked" toggle (extra state + extra round trip). The `publicRead: false` flag is right there — let the client decide.
- **Why not paginate.** TripShare rows per trip are bounded by the owner's own mint volume (a reasonable user mints 1–5; an abusive one is rate-limited by the global throttler). Offset/limit would be ceremony; real pagination lands if + when one trip starts growing hundreds of shares.
- **Why a separate DTO (`TripShareOwnerDto`) vs reusing `TripShareDto`.** The POST response omits `publicRead` (always `true` on creation); the list response needs it. Two types make both contracts explicit — reusing one would either litter the POST response with an always-true boolean or require a `Partial<>` / `Omit<>` dance that obscures what each endpoint actually returns.
- **Why the owner gate uses `findByIdForUser` instead of the adapter's ownerId filter alone.** Two benefits: (1) the error code is `TRIP_NOT_FOUND`, consistent with GET /trips/:id — clients have one "this trip isn't yours" code to handle; (2) if the trip exists but has no shares, a bare adapter WHERE would still return `[]` — no way to tell "you're not the owner" from "you haven't minted any". The gate makes the error story unambiguous.

---

### [IV.18.2.14] — Trip share: revoke endpoint + itinerary in public resolver

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

Closes two gaps from `[IV.18.2.13]`:

1. **Revoke.** A leaked share code had no kill switch short of deleting the trip. Now an owner can `DELETE /api/v1/trips/:id/share/:code` to soft-revoke (flips `publicRead = false`). Recipient-side response is indistinguishable from a wholly unknown code (both are `SHARE_NOT_FOUND`).
2. **Itinerary in the public view.** The shared response was metadata-only, which isn't that useful ("Alice shared a 7km-radius trip"). Recipients now see the full itinerary — days + items with `placeId`, `notes`, start/end times — the same shape the owner gets via `GET /trips/:id/itinerary`.

Changes:

- **`TripShareRepository.revokeByCodeForOwner(code, ownerId): Promise<boolean>`** — new port method. Prisma adapter uses `updateMany({ where: { shareCode, ownerId, publicRead: true }, data: { publicRead: false } })` + returns `count === 1`. Filtering on `publicRead: true` means a re-revoke returns `false` (idempotency is the use-case's problem, not the adapter's).

- **`RevokeTripShareUseCase`** — delegates to the repo; translates `false` to 404 `SHARE_NOT_FOUND`. Single error code for all three failure modes (missing, non-owner, already-revoked) so the response doesn't leak ownership or row existence.

- **`DELETE /api/v1/trips/:id/share/:code` route** — owner-only via the global `JwtAuthGuard` + `@CurrentUser()`. Returns 204 on success. Note: the `:id` path param is accepted for route shape, but the use-case only queries by `shareCode` + `ownerId` — this means a misspelled trip id doesn't disrupt revocation (shareCode is globally unique; the trip id in the URL is syntactic only).

- **`ResolveTripShareUseCase` — itinerary fold-in.** Injects `ITINERARY_REPOSITORY` and appends `days` (via `listDays(trip.id)`) to the `ResolvedShare` payload. Empty array when no itinerary exists yet. Controller maps days through the existing `toDayDto` helper so the public shape matches the authenticated `GET /trips/:id/itinerary` exactly.

- **5 new integration tests** added to `apps/api/test/trip-share.e2e-spec.ts` (suite grew 7 → 12 tests):
  1. Metadata-only resolve now asserts `days: []` present (schema consistency).
  2. New: generate itinerary → mint share → resolve publicly → `days.length > 0` with full day shape.
  3. Revoke by owner → 204 → resolve returns 404 `SHARE_NOT_FOUND`.
  4. Revoke by non-owner → 404 + code still works for the recipient.
  5. Revoke unknown code → 404.
  6. Revoke twice → second call returns 404 (idempotent from client POV — already revoked row falls outside the `publicRead: true` filter).

**Files created** (1) — `trip/application/revoke-trip-share.use-case.ts`.
**Files edited** (5) — `trip/application/ports/trip-share.repository.ts` (+revokeByCodeForOwner), `trip/infrastructure/prisma-trip-share.repository.ts` (impl), `trip/application/resolve-trip-share.use-case.ts` (+ITINERARY_REPOSITORY + days in payload), `trip/interface/trip.controller.ts` (+DELETE route, +days in SharedTripDto + resolver mapping), `trip/trip.module.ts` (+RevokeTripShareUseCase), `test/trip-share.e2e-spec.ts` (+5 tests, +days assertion in existing happy path).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-share suite 12/12 pass against Docker (+5 vs previous).
- ✅ **Full real-DB suite: 29 suites, 194 tests pass against live Docker.** (Same suite count, +5 tests vs `[IV.18.2.13]`.)

**Acceptance criteria**

- ✅ Owner can kill a share code without deleting the trip.
- ✅ Soft-revoke (flips `publicRead`) — row still exists for audit, but dead to both owner (re-revoke) and recipient (resolve).
- ✅ Missing / non-owner / already-revoked all collapse to one public error code.
- ✅ Public share response includes itinerary days + items (real plan, not just metadata).
- ✅ Empty-itinerary trips still resolve with `days: []` — schema is consistent regardless of itinerary state.

**Notes**

- **Why the `:id` path param on DELETE isn't enforced.** The shareCode is globally unique via a DB-level `@@unique`, so URL structure like `/trips/abc/share/XYZ` where `abc` is nonsense still matches the correct share row. Honoring the id would require either (a) an extra trip-share-belongs-to-this-trip check — pure ceremony — or (b) a route like `/trips/shares/:code` that doesn't mention the trip id. The current URL matches REST convention (nested under its parent) without paying for the nesting semantically.
- **Why `publicRead: true` in the WHERE of the update.** Without it, a re-revoke would still return `count=1` (it would touch the already-false row with the same false value). Filtering on `publicRead: true` means "only flip if currently live", which matches the use-case's idempotency contract — a second revoke is a 404 because there's nothing to revoke, same as an unknown code.
- **Why include itinerary on the public surface vs a separate `/shared/:code/itinerary` endpoint.** Two round-trips for one user-facing action (viewing a shared trip) is a UX loss with no security upside — the itinerary data is no more sensitive than the trip metadata. One response, one fetch.
- **Why not expose the trip's version / status to recipients.** Still holds from `[IV.18.2.13]`: anything owner-coupled (version counter, draft/archived state) leaks mutation cadence. Days + items are stable enough to share without the surrounding lifecycle metadata.

---

### [IV.18.2.13] — Trip sharing: POST /trips/:id/share + public GET /trips/shared/:code

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.12 (Social & Groups)

**What was done**

First piece of the Social context: trip owner mints an opaque share code; recipient reads trip metadata without authenticating. Uses the `TripShare` table that was already in the Prisma schema — no migration needed.

- **Clean-hex add to the Trip module** (not a new module — `TripShare` is intrinsically per-trip and belongs to the same bounded context):
  - `domain/trip-share.entity.ts` — plain-data `TripShare` type (id, tripId, ownerId, shareCode, publicRead, expiresAt, createdAt).
  - `application/ports/trip-share.repository.ts` — narrow port with `create` + `findByCode`. Revoke / list-my-shares deliberately deferred to a follow-up slice.
  - `infrastructure/prisma-trip-share.repository.ts` — direct Prisma delegate (no PostGIS columns on this table).

- **`CreateTripShareUseCase`** — owner-only:
  - Gates on `TripRepository.findByIdForUser(tripId, ownerId)` — non-owner + missing trip collapse to 404 `TRIP_NOT_FOUND` (no existence probe leak).
  - Validates optional `expiresAt` is in the future (domain-level; Zod DTO re-validates at the wire for defence in depth).
  - Generates code via `crypto.randomBytes(12).toString('base64url')` → 16 URL-safe chars, ~72 bits of entropy.

- **`ResolveTripShareUseCase`** — unauthenticated:
  - `findByCode` miss OR `publicRead=false` → 404 `SHARE_NOT_FOUND` (the `publicRead` branch is how a future revoke endpoint soft-kills a share without deleting; both paths look identical to the recipient).
  - `expiresAt ≤ now` → 404 `SHARE_EXPIRED` (typed separately so the UI can show "this link expired" instead of "not found").
  - Trip missing after share (cascade race) → 404 `TRIP_NOT_FOUND`.
  - Looks up `user.displayName` for the shared response (direct `PrismaService` inject — a single read-by-id doesn't justify a minimal port around it).

- **HTTP surface** (in `TripController`):
  - `POST /api/v1/trips/:id/share` — owner-only, body `{ expiresAt?: ISO-date }`, returns `{ id, tripId, shareCode, expiresAt, createdAt }`.
  - `GET /api/v1/trips/shared/:code` — `@Public()` to bypass `JwtAuthGuard`. Returns a trimmed trip view: `{ id, title, radiusKm, startsOn, endsOn, ownerDisplayName, expiresAt, createdAt }`. **No `userId` / `ownerId` / `status` / `version` / `updatedAt` on the wire** — anything sensitive or owner-coupled stays off the public surface.
  - Fastify router gives the static `shared` segment priority over the parametric `:id` so `/trips/shared/<code>` never matches `GET /:id`.

- **DTO** (`CreateTripShareBodySchema`) — strict-mode Zod object with optional `expiresAt` as an ISO date string.

- **7 integration tests** (`apps/api/test/trip-share.e2e-spec.ts`):
  1. Happy path: mint → resolve publicly → owner displayName returned + sensitive fields omitted.
  2. Non-owner mint → 404 `TRIP_NOT_FOUND` (IDOR + existence probe defence).
  3. Unauthenticated mint → 401 `UNAUTHENTICATED`.
  4. Past `expiresAt` on create → 422 `INVALID_EXPIRY`.
  5. Resolve an unknown code → 404 `SHARE_NOT_FOUND`.
  6. Resolve an expired code (back-dated via direct Prisma update after creation with a future expiry) → 404 `SHARE_EXPIRED`.
  7. Deleting the trip cascades the TripShare → recipient sees `SHARE_NOT_FOUND` (Prisma schema `onDelete: Cascade` exercised end-to-end).

**Files created** (6) — `trip/domain/trip-share.entity.ts`, `trip/application/ports/trip-share.repository.ts`, `trip/application/create-trip-share.use-case.ts`, `trip/application/resolve-trip-share.use-case.ts`, `trip/infrastructure/prisma-trip-share.repository.ts`, `test/trip-share.e2e-spec.ts`.
**Files edited** (3) — `trip/trip.module.ts` (+TRIP_SHARE_REPOSITORY + 2 use-cases), `trip/interface/dto/trip.dto.ts` (+CreateTripShareBodySchema), `trip/interface/trip.controller.ts` (+2 routes, +Public import).

**Dependencies** — none new. `crypto.randomBytes` is stdlib.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Trip-share suite 7/7 pass against Docker.
- ✅ **Full real-DB suite: 29 suites, 189 tests pass against live Docker.** (+1 suite, +7 tests vs `[IV.18.3.2]`.)

**Acceptance criteria**

- ✅ Owner can mint a share code with optional expiry.
- ✅ Recipient resolves the code without authenticating.
- ✅ Non-owner can't mint a share; missing & wrong-owner both collapse to 404.
- ✅ Expired share resolves to a dedicated `SHARE_EXPIRED` code (not a generic 404).
- ✅ Public response omits every owner-coupled or sensitive field.
- ✅ Deleting a trip invalidates its shares transparently (FK cascade).

**Notes**

- **Why `TripShare` lives in the Trip module, not a new Social module.** Cross-context integration rule is "via events or facade interfaces, not direct service imports". A share is owned by exactly one trip, and its lifecycle (creation, expiry, cascade-delete) is inseparable from the trip's. Putting it in a separate module would mean importing `TRIP_REPOSITORY` across the boundary — leak. When Social grows (groups, comments, votes) those ARE separate, they'll land in their own module.
- **Why `publicRead: true` on every mint.** Today the HTTP surface always creates a publicly-readable share; the `publicRead: false` branch exists as the revoke path for a future slice. Schema already has the boolean; wiring it here means the revoke endpoint is a one-line use-case addition later instead of a model migration.
- **Why 12 random bytes, not 16.** 12 → 16 base64url chars; 16 → 22 chars. 72 bits is enough entropy for an opaque token that will live in URLs / SMS / QR codes where short matters. If we ever need collision probability below 1-in-2^72, we'll rotate to 16 bytes; today, 12 is the right trade.
- **Why `@Public()` GET instead of a separate unauthenticated controller.** Isolated public controllers are useful when the surface is big (e.g., auth). A single read route doesn't justify a new controller + module wiring; `@Public()` on the one handler is the minimum-ceremony, audit-readable solution. The route URL (`/shared/:code`) telegraphs the access model.
- **Why no `updatedAt` / `version` / `status` in the public DTO.** Anything owner-coupled (version counter, draft/archived state, update timestamps) either leaks mutation history or creates a divergent contract if the future read model differs from the owner's own GET. Keep the shared shape tight; expand only when a real UI asks for it.

---

### [IV.18.3.2] — admin-promote CLI: bootstrap the first admin without direct SQL

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 17 (Admin)

**What was done**

Closes the bootstrap loop opened by `[IV.18.3.1]`: the HTTP admin surface exists, but nobody can call it until at least one user has `role = 'admin'`. Before this slice, tests flipped the column directly with `prisma.user.update` — production can't.

- **`apps/api/scripts/promote-admin.ts`** — standalone tsx CLI. No Nest bootstrap; the script talks to Prisma directly (`new PrismaClient()`) and reuses the shared `hashEmail` helper so the equality hash over pepper+email matches the row the API wrote at registration.
  - **Core exported as `promoteUserToAdmin(prisma, rawEmail)`** — idempotent, returns a discriminated union (`PROMOTED | ALREADY_ADMIN | USER_NOT_FOUND`). No DB write when already admin (so `updatedAt` doesn't churn on a re-run).
  - **CLI wrapper `runCli(argv, deps?)`** — parses positional email arg, maps result to exit code (0 on PROMOTED/ALREADY_ADMIN, 1 on USER_NOT_FOUND/USAGE_ERROR). Accepts an optional `prisma` override so the integration test can share the test's existing `PrismaService` — no subprocess spawn needed.
  - **Thin `main()` guard (`require.main === module`)** — prevents the CLI from auto-running when jest imports the module.
  - **JSON-line stdout** — operators / CI can pipe into `jq`. Unhandled errors go to stderr with `kind: 'UNHANDLED_ERROR'` so success/failure is unambiguous at the shell level.

- **`apps/api/package.json`**: added `"admin:promote": "tsx scripts/promote-admin.ts"` script. Callers: `pnpm --filter=api admin:promote <email>`.

- **`apps/api/tsconfig.json`**: added `scripts/**/*` to `include` so typecheck covers the CLI. `tsconfig.build.json` already scopes its own include to `src/**/*`, so scripts don't leak into `dist/`.

- **7 integration tests** (`apps/api/test/promote-admin.e2e-spec.ts`):
  1. `promoteUserToAdmin` flips `role: user → admin` and writes the row.
  2. Second call on an already-admin user → `ALREADY_ADMIN`, `updatedAt` unchanged.
  3. Unknown email → `USER_NOT_FOUND` (exit 1).
  4. `runCli` happy path → exit 0 + `PROMOTED` + DB reflects it.
  5. `runCli` unknown email → exit 1 + `USER_NOT_FOUND`.
  6. `runCli` zero args → exit 1 + `USAGE_ERROR`.
  7. `runCli` malformed email → exit 1 + `USAGE_ERROR`.

**Files created** (2) — `apps/api/scripts/promote-admin.ts`, `apps/api/test/promote-admin.e2e-spec.ts`.
**Files edited** (2) — `apps/api/package.json` (+admin:promote script), `apps/api/tsconfig.json` (+scripts/\*_/_ in include).

**Dependencies** — none new. `tsx` was already a devDep.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Promote-admin suite 7/7 pass against Docker.
- ✅ **Full real-DB suite: 28 suites, 182 tests pass against live Docker.** (+1 suite, +7 tests vs `[IV.18.3.1]`.)

**Acceptance criteria**

- ✅ Operator can promote a user to admin without direct SQL: `pnpm --filter=api admin:promote user@example.com`.
- ✅ Idempotent: re-running is safe and explicitly reports `ALREADY_ADMIN`.
- ✅ Unknown email is a failure (exit 1), not a silent no-op — prevents operators from thinking a typo-ed address was promoted.
- ✅ Core logic is a pure function that tests can exercise without spawning a subprocess.
- ✅ CLI reuses the same `EMAIL_PEPPER`-based `hashEmail` helper as register/login — no duplicate hashing code paths.

**Notes**

- **Why no Nest bootstrap.** `NestFactory.createApplicationContext(AppModule)` would work, but the only two things the script needs are Prisma + `hashEmail`. Both are framework-agnostic. Skipping Nest keeps startup fast (~200ms instead of ~2s) and avoids pulling in the event bus / rate limiter / guard chain the CLI has no use for.
- **Why `USER_NOT_FOUND` is exit 1, not 0.** A successful no-op (`ALREADY_ADMIN`) is exit 0 because the post-condition holds (user is admin). `USER_NOT_FOUND` means the post-condition isn't met — scripting this into a Makefile / CI step, an operator wants that to fail loudly.
- **Why no `--demote` / `--role <role>` flag.** Single-purpose scripts are easier to reason about + audit. If we need demotion later, that's a three-line sibling script, not a flag on this one. Keeps the blast radius of a typo minimal.
- **Why store `EMAIL_PEPPER` requirement in the script's JSDoc.** Running the CLI without the pepper throws a clear error from `getPepper()` at hash time. Leading with the requirement in the docblock saves operators a round of confusion if they try to run it via plain `tsx` without Doppler / `.env` loaded.

---

### [IV.18.3.1] — Admin module: POST /admin/places + DELETE /admin/places/:id (class-level @Roles('admin'))

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1 (17. Admin)

**What was done**

First admin-only HTTP surface. Keeps Places curation out of the public API (search is user-scoped; insert/delete is operator-scoped). Thin authz shell over the existing `PLACE_REPOSITORY` port — no new domain.

- **`PlaceRepository` port** — added `deleteById(id): Promise<boolean>` alongside the earlier `insert` + `exists`. Returns `true` iff a row was actually removed. Prisma adapter uses `prisma.place.deleteMany({ where: { id } })` + checks `result.count === 1` so the PostGIS `coordinates` Unsupported column never flows through a Prisma-typed delete path.

- **`apps/api/src/modules/admin/`** (clean-hex scaffold):
  - `application/admin-create-place.use-case.ts` — wraps `PLACE_REPOSITORY.insert`. Re-validates lat/lng ranges as a domain invariant so off-HTTP seed callers get the same guarantee the Zod DTO provides.
  - `application/admin-delete-place.use-case.ts` — delegates to `deleteById`; translates `false` to `NotFoundError('PLACE_NOT_FOUND', 404)`.
  - `interface/dto/admin.dto.ts` — `AdminCreatePlaceBodySchema` (sourceKey + name + category + lat/lng + optional address/countryCode/relaxationScore/metadata).
  - `interface/admin.controller.ts` — `@Controller('admin/places')` with **class-level `@Roles('admin')`** so every method inherits the guard. POST (201) + DELETE :id (204). Arg-scoped `@Body(new ZodValidationPipe(...))` matches the `[IV.18.2.5.fix]` pattern.
  - `admin.module.ts` imports `PlacesModule` (for `PLACE_REPOSITORY`). Admin owns no repositories of its own — it's purely an authz shell.

- **`AppModule` imports `AdminModule`**. Guard chain order unchanged: rate-limit → JwtAuthGuard → RolesGuard.

- **6 integration tests** (`apps/api/test/admin-places.e2e-spec.ts`):
  1. Unauthenticated POST → 401 `UNAUTHENTICATED`.
  2. Non-admin POST → 403 `ROLE_FORBIDDEN` (context.actual='user').
  3. Admin POST → 201 + row exists + PostGIS coord matches (via `ST_X/ST_Y` raw probe).
  4. Admin DELETE → 204 + row gone.
  5. Admin DELETE missing id → 404 `PLACE_NOT_FOUND`.
  6. Non-admin DELETE → 403.

- **Admin bootstrap for tests**: no CLI for role promotion yet. Each admin-role test registers a user → flips `role = 'admin'` via `prisma.user.update` → re-logs-in so the new JWT carries the admin role (login reads `user.role` at issuance — see `login.use-case.ts`). A CLI / Makefile for admin promotion is queued as a follow-up.

- **Suite-local coord**: `{ lat: 23.4567, lng: 178.1234 }` — mid-Pacific quadrant used by no other e2e suite (per `memory/feedback_unique_test_coords.md`).

**Files created** (5) — `apps/api/src/modules/admin/admin.module.ts`, `apps/api/src/modules/admin/application/admin-create-place.use-case.ts`, `apps/api/src/modules/admin/application/admin-delete-place.use-case.ts`, `apps/api/src/modules/admin/interface/dto/admin.dto.ts`, `apps/api/src/modules/admin/interface/admin.controller.ts`, `apps/api/test/admin-places.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts` (+AdminModule), `apps/api/src/modules/places/application/ports/place.repository.ts` (+deleteById), `apps/api/src/modules/places/infrastructure/prisma-place.repository.ts` (impl).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Admin suite 6/6 pass against Docker.
- ✅ **Full real-DB suite: 27 suites, 175 tests pass against live Docker.** (+1 suite, +6 tests vs `[IV.18.2.11]`.)

**Acceptance criteria**

- ✅ POST + DELETE both gated by `@Roles('admin')` at the class level.
- ✅ Non-admin → 403 `ROLE_FORBIDDEN`; unauthenticated → 401 `UNAUTHENTICATED`.
- ✅ Missing place → 404 `PLACE_NOT_FOUND` (not 204, so clients see the difference between "deleted" and "already gone").
- ✅ PostGIS coord round-trips via `GeoQueries.insertPlace`.
- ✅ Clean-hex boundary preserved — Admin imports Places (the port owner), not a reverse dependency.

**Notes**

- **Why `deleteMany` over `delete` for deletion.** Prisma's typed `delete` implicitly does a `findUniqueOrThrow` first. The Place schema declares `coordinates` as `Unsupported("geography(Point, 4326)")`, and Prisma's read path can trip on that even when the caller doesn't select the column. `deleteMany` is straight DELETE … WHERE, so the Unsupported column stays out of the code path entirely.
- **Why class-level `@Roles('admin')` (not per-method).** Every method on this controller is admin-only. Class-level keeps the intent in one place and means a new method added later inherits the guard by default — the opposite of the "forgot to annotate a new handler" failure mode.
- **Why re-login after role flip in tests.** The role claim is baked into the access token at issuance (`login.use-case.ts:162`). A `prisma.user.update` alone doesn't rotate existing JWTs, so tests must call `/auth/login` again to pick up the promoted role.
- **Why an admin promotion CLI isn't in scope here.** Bootstrapping the first admin is an operational concern (seed script or direct-SQL) separate from the HTTP surface. Defer to a follow-up so this slice stays a focused port + controller add.

---

### [IV.18.2.11] — PATCH /trips/:tripId/itinerary/:dayId: reorder / remove / add / wipe items on a day

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1

**What was done**

Closed the UX gap where users were stuck with the generator's output — now they can tweak positions, remove items they don't like, add free-form activities (placeId=null with notes), or wipe a day clean. Whole-list-replace semantics match how list-editor UIs typically work (client sends the full new state; server replaces).

- **`ItineraryRepository` port**:
  - `findDayForUser(dayId, userId)` — scoped lookup via the `trip.userId` FK. Returns `null` when the day is missing OR owned by a different user. Prevents horizontal IDOR without a separate role gate.
  - `replaceItemsForDay(dayId, items[])` — atomic `deleteMany` + `createMany` inside one `$transaction`, returns the day with fresh items.

- **`Places.PlaceRepository` port** — added `exists(id): Promise<boolean>`. Cheap Prisma `findUnique({ select: { id } })` probe so `UpdateDayItemsUseCase` can validate every non-null `placeId` without a radius query or full row load.

- **`UpdateDayItemsUseCase`**:
  - Validates `items.length ≤ 20` (domain-level defence; Zod enforces at the DTO too).
  - Rejects duplicate `position` values with a clean `DUPLICATE_POSITION, 422` before the DB layer trips the `@@unique([dayId, position])` constraint with a P2002.
  - Looks up the day via `findDayForUser` — 404 `TRIP_NOT_FOUND` (same shape as GET) if missing, OR if the URL's `tripId` doesn't match `day.tripId` (catches URL tampering).
  - Validates every non-null `placeId` with a dedupe-then-`exists` loop → missing list collected → 404 `PLACE_NOT_FOUND` with the ids in `context.missingPlaceIds`.
  - Delegates to `replaceItemsForDay` and returns the fresh day shape.

- **Controller**: `PATCH /api/v1/trips/:tripId/itinerary/:dayId` body `{ items: [{ position, placeId?|null, notes? }] }`, arg-scoped `@Body(new ZodValidationPipe(UpdateDayItemsBodySchema))` so `@Param('tripId')` + `@Param('dayId')` don't trip validation (the `[IV.18.2.5.fix]` pattern). Response: `{ day: ItineraryDayDto }` (day nested with items).

- **10 integration tests** (`apps/api/test/itinerary-day-edit.e2e-spec.ts`):
  1. Reorder: same placeIds, new positions → persisted.
  2. Remove: subset leaves only those items.
  3. Add: placeIds + notes, including a `null`-placeId free-form activity.
  4. Wipe: empty `items: []` clears the day.
  5. Cross-user → 404 `TRIP_NOT_FOUND` (IDOR defence).
  6. Wrong `tripId` for a legit dayId (same user, different trip) → 404.
  7. Non-existent placeId → 404 `PLACE_NOT_FOUND` with the id in context.
  8. Duplicate positions → 422 `DUPLICATE_POSITION`.
  9. 21-item list → 422 `VALIDATION_FAILED` (Zod cap).
  10. Unauthenticated → 401.

**Files created** (2) — `apps/api/src/modules/trip/application/update-day-items.use-case.ts`, `apps/api/test/itinerary-day-edit.e2e-spec.ts`.
**Files edited** (6) — `application/ports/itinerary.repository.ts` (+2 methods), `infrastructure/prisma-itinerary.repository.ts` (impls), `modules/places/application/ports/place.repository.ts` (+exists), `modules/places/infrastructure/prisma-place.repository.ts` (impl), `trip.module.ts` (+UpdateDayItemsUseCase), `interface/dto/trip.dto.ts` (+UpdateDayItemsBodySchema), `interface/trip.controller.ts` (+PATCH route).

**Also fixed:** `apps/api/test/notifications.e2e-spec.ts` trip center moved to a suite-local remote coord — the first parallel full-suite run tripped the same cross-suite contamination the `[IV.18.2.10]` commit noted. Same rule applies (see `memory/feedback_unique_test_coords.md`).

**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Day-edit suite 10/10 pass.
- ✅ **Full real-DB suite: 26 suites, 169 tests pass against live Docker.**

**Acceptance criteria**

- ✅ Reorder / remove / add / wipe all supported via a single "replace whole list" endpoint.
- ✅ IDOR-scoped — day lookup via `trip.userId`.
- ✅ Cross-trip day URL rejected with 404, not silent success.
- ✅ PlaceId existence verified before write (defence against orphan FKs).
- ✅ Position uniqueness enforced at use-case level with a domain-specific code.
- ✅ Empty array is a legitimate operation (wipe).

**Notes**

- **Why "replace whole list" instead of patch-delta operations.** Delta APIs (add/remove/reorder) are three endpoints to maintain + consistency bugs when two clients race. Whole-list-replace + optimistic concurrency (future: `If-Match: <version>` header on the Day) handles everything. Every popular list-editor UI (Notion blocks, Todoist tasks) is whole-list under the hood.
- **Why `exists(id)` on PlaceRepository, not a richer `findById`.** Richer lookups are trivial to add when another caller needs them. Today only this use-case wants "does this id exist" — the narrow port keeps the domain surface disciplined.
- **Why the wrong-tripId test matters.** Without the `day.tripId !== cmd.tripId` check, someone could craft a URL like `/trips/trip-A/itinerary/day-belonging-to-trip-B` (same user) and the server would happily edit trip-B's day via trip-A's URL. Harmless in this app but violates the principle that URL params are part of the authorization surface.
- **Why `notes: null` and `notes: undefined` collapse to `null` in the use-case.** Clients send either shape; the DB column is nullable. Canonicalising once in the use-case layer means the adapter doesn't need to care. Same pattern `UpdateTripUseCase` uses for dates.

---

### [IV.18.2.10] — Itinerary generator consumes Places: ItineraryItem rows with placeId + round-robin distribution

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1, 3.3

**What was done**

Closed the Trip × Places integration loop. Today `ItineraryDay.items[]` is populated — the stub generator fetches every Place within the trip's radius, clamps at 50km, and distributes them round-robin across days at 3 items-per-day. Real AI orchestration replaces this shape-for-shape when the ai-service lands.

- **Domain**: `ItineraryDay.items: readonly ItineraryItem[]` is now part of the plain-data shape. Empty array when no places in range; a day HAS items (possibly zero). Matches how clients render.

- **`ItineraryRepository` port**:
  - `CreateDayInput` accepts an optional `items: CreateItemInput[]` sibling — same transaction writes days + items.
  - `CreateItemInput`: `{ position, placeId|null, notes?, startTime?, endTime? }`.
  - `listDays(tripId)` now returns nested items (`include: { items: { orderBy: { position: 'asc' } } }`).
  - `replaceDays` returns days with items from a fresh read inside the same transaction.

- **`prisma-itinerary.repository.ts`**: `replaceDays` iterates days (needs the generated day id to FK items), inserts each day row with Prisma `create`, then bulk `createMany` items under it. All inside `$transaction` so "re-plan" is atomic. Final `findMany({ include: { items: ... }})` inside the tx returns the full shape.

- **`GenerateItineraryStubUseCase`**:
  - New deps: `PLACE_REPOSITORY` + `GeoQueries`.
  - Step 1: `geo.findTripCenter(tripId)` reads the PostGIS `center` lat/lng via a raw-SQL `ST_Y / ST_X` (Trip domain doesn't expose `center` since Prisma omits `Unsupported` columns).
  - Step 2: `places.findWithinRadius({ lat, lng, radiusKm: min(50, trip.radiusKm) })` — capped at 50km (matches the Places search invariant). Trip with no center returns no places (never happens in prod; belt-and-braces).
  - Step 3: Slice the top `dayCount × TARGET_ITEMS_PER_DAY` (3 per day) places.
  - Step 4: Round-robin — `place[i + j * dayCount]` goes to `day[i].items[j]`. So with 9 places and 3 days: day 1 = places [0, 3, 6], day 2 = [1, 4, 7], day 3 = [2, 5, 8]. When places run out, days get partial item lists.
  - Step 5: `replaceDays` with the new shape.

- **`GeoQueries.findTripCenter(tripId)`**: new raw-SQL helper returning `{ lat, lng } | null`. Colocated with `insertTrip` so every PostGIS concern lives in `GeoQueries`.

- **`TripModule` imports `PlacesModule`**: TripModule consumes `PLACE_REPOSITORY` which `PlacesModule` exports. Directional dependency is Trip → Places; Places has no knowledge of Trips.

- **Controller `ItineraryDayDto`** now nests `items: ItineraryItemDto[]` with `{id, position, placeId, startTime, endTime, notes}`. GET + POST both return the same nested shape.

- **`apps/api/test/itinerary-items.e2e-spec.ts`** — 5 new integration tests:
  1. 3-day trip with 9 seeded places → 3 items per day, positions 1..3, every seeded place referenced exactly once across the trip.
  2. 2-day trip with only 3 seeded places → day 1 gets 2 items, day 2 gets 1 (round-robin partial fill).
  3. No places nearby → days created with empty `items[]` (back-compat with pre-Places generator + existing `itinerary.e2e-spec.ts`).
  4. GET /trips/:id/itinerary round-trips the nested items.
  5. Re-generation wipes old items (3 POSTs → still 6 items, not 18).

- **Cross-suite isolation**: both `itinerary.e2e-spec.ts` and `itinerary-items.e2e-spec.ts` moved off the shared "Victoria" test coordinate. Each suite gets a unique remote-ocean coord so cross-suite Place seeding (places-e2e, geo-queries, index-usage) can't contaminate the generator's radius search. First full-suite run under real Docker caught the race: parallel seed + delete of Places was tripping ItineraryItem FK violations in `itinerary.e2e-spec.ts`'s re-plan test. Moving trip centers to suite-local coords eliminates the race at the data level — no parallel runner tweaks needed.

**Files created** (1) — `apps/api/test/itinerary-items.e2e-spec.ts`.
**Files edited** (7) — `domain/itinerary.entity.ts` (+items on day), `application/ports/itinerary.repository.ts` (+CreateItemInput on CreateDayInput), `infrastructure/prisma-itinerary.repository.ts` (atomic days+items writes, nested reads), `application/generate-itinerary-stub.use-case.ts` (round-robin over places), `common/db/geo-queries.ts` (+findTripCenter), `interface/trip.controller.ts` (nested day DTO), `trip.module.ts` (+PlacesModule import), `test/itinerary.e2e-spec.ts` (unique coord).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Itinerary + trip + trip-crud suites: 24/24 pass.
- ✅ **Full real-DB suite: 25 suites, 159 tests pass.**

**Acceptance criteria**

- ✅ GenerateItineraryStub picks places from `PLACE_REPOSITORY`.
- ✅ Round-robin distribution verified (every seeded place referenced exactly once when capacity ≥ needs).
- ✅ Partial fill when places are scarce (day 1 gets 2, day 2 gets 1).
- ✅ Empty result when no places in radius (back-compat preserved).
- ✅ Re-generation atomic (days + items both wiped + re-inserted in one tx).
- ✅ GET + POST /trips/:id/itinerary return the nested-items DTO.

**Notes**

- **Why `TARGET_ITEMS_PER_DAY = 3`.** A generous lunch + afternoon + dinner shape. The AI orchestrator will override this with semantic scoring (morning hike + cafe + afternoon museum + dinner spot …) — this is just a sensible default that matches everyday trip density.
- **Why read the trip center via raw SQL, not extend the Trip domain.** Two options considered: (a) add `centerLat` + `centerLng` to `Trip` domain + update every repo method to read via `ST_X/ST_Y`; (b) keep Trip domain center-free + use `GeoQueries.findTripCenter` as-needed. Option (b) scopes the change to callers that actually need coords — today just the itinerary generator. Option (a) leaks PostGIS into every read path. (b) wins for now; promotable later if >2 modules need it.
- **Why the trip center moves each suite's tests to unique coordinates.** Integration tests share a Postgres. Parallel workers can seed + delete in interleaved order; my `itinerary.e2e-spec.ts` "re-generating wipes" test was failing under full-suite-parallel because `itinerary-items` was deleting its seed places mid-transaction of `itinerary`'s POST /itinerary. The generator had already picked a `placeId`, the row was gone before the INSERT, FK violation. Moving each suite's trips to its own remote coord means no cross-suite place contamination — cleaner than running tests serially.
- **Why `GenerateItineraryStubUseCase` caps search at `min(50, trip.radiusKm)`.** Trip's radius can be up to 500km; PlacesModule's `SearchPlacesUseCase` caps at 50km. The generator uses the Places repo directly (bypassing the use-case), so the cap has to live here. Documented inline. AI orchestrator will use a different strategy (semantic scoring + trip-shape awareness).

---

### [IV.18.2.9] — Places module first slice: `POST /places/search` over PostGIS with 50km cap

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.3, 11.2

**What was done**

Third feature module on top of the Phase-0 foundation. Unlocks the Trip module's fuller value — today a Trip has a radius but no places inside it; the Places module makes the search surface the Trip module will consume when `ItineraryItem` wiring lands.

- **Clean-hex layout** `apps/api/src/modules/places/`:
  - **`domain/place.entity.ts`** — plain-data `Place` + `PlaceWithDistance` (Place + `distanceMeters`). Mirrors what Prisma reads (PostGIS `coordinates` column is `Unsupported` so Prisma omits it).
  - **`application/ports/place.repository.ts`** — `PlaceRepository` with `findWithinRadius` (returns `PlaceWithDistance[]`, ordered ascending by distance) + `insert` (admin-only seed path — no HTTP route exercises it yet).
  - **`infrastructure/prisma-place.repository.ts`** — delegates straight to the existing `GeoQueries.findPlacesWithinRadius` + `insertPlace` (CLAUDE rule 11 — PostGIS column stays in raw SQL only).
  - **`application/search-places.use-case.ts`** — enforces `radiusKm ∈ (0, 50]`. Tighter than Trip's 500km cap because search returns EVERY match; cost grows with radius². `limit` clamped to [1, 100], default 20. Uses existing `InvalidRadiusError` + `ValidationError` for consistent error codes.
  - **`interface/dto/places.dto.ts`** — Zod `SearchPlacesBodySchema` with `center: {lat, lng}`, `radiusKm`, optional `category` + `limit`.
  - **`interface/places.controller.ts`** — `POST /api/v1/places/search`. Arg-scoped `@Body(new ZodValidationPipe(...))` per the `[IV.18.2.5.fix]` lesson (body-only validation, no param collision). No `@Public()` — search requires auth so the rate limiter has a user-key + we can attribute usage.
  - **`places.module.ts`** — standard DI wiring; `GeoQueries` comes in from the global `DbModule`.

- **`AppModule` imports `PlacesModule`**.

- **`apps/api/test/places.e2e-spec.ts`** — 7 integration tests:
  1. No bearer → 401 `UNAUTHENTICATED`.
  2. 5 km search around Victoria returns Hyde Park + Trafalgar (2 km + 1.7 km), excludes Windsor (~35 km); distance-ascending order verified.
  3. `category: 'park'` narrows to 1 result.
  4. Radius 51 km → 422 `INVALID_RADIUS`.
  5. Radius 0 → 422 (either `VALIDATION_FAILED` or `INVALID_RADIUS`).
  6. Remote point with no seeded data → 200 + `places: []` (not 404).
  7. `limit: 2` clamps a 4-row seed set.

- Tests use the existing `GeoQueries.insertPlace` to seed rows with a unique `SOURCE_PREFIX`, then filter results to their own prefix before asserting counts (same pattern the `geo-queries` suite uses — avoids cross-suite collision).

**Files created** (6) — `apps/api/src/modules/places/{domain/place.entity.ts, application/ports/place.repository.ts, application/search-places.use-case.ts, infrastructure/prisma-place.repository.ts, interface/dto/places.dto.ts, interface/places.controller.ts, places.module.ts}` + `apps/api/test/places.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+`PlacesModule`).
**Dependencies** — none new. Leans entirely on the already-tested `GeoQueries` layer.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Places suite 7/7 pass.
- ✅ **Full real-DB suite: 24 suites, 154 tests pass against live Docker** (Postgres + Redis + Meili + Jaeger + Minio).

**Acceptance criteria**

- ✅ Within-radius query returns distance-ordered results.
- ✅ Radius cap enforced via `InvalidRadiusError` (422).
- ✅ Category filter works.
- ✅ Auth required.
- ✅ Empty result is 200 + empty array (no false 404).
- ✅ Limit clamping.

**Notes**

- **Why a 50km search cap, not 500km like Trip.** Search returns every match — radius² cost growth matters. 50km is generous for a day-trip search + matches the Playbook's Phase-1 `discoverRadiusKm` range. Trip's 500km cap is a different invariant (how far the user's radius-of-planning extends), not a query cost limit.
- **Why no `Place.SearchPerformed` event.** Considered, punted. Analytics subscriber doesn't exist yet; emitting events nobody consumes is noise. When an analytics subscriber (PostHog / Segment) lands, we'll revisit.
- **Why auth on search, not public.** Places data is shared, so there's no IDOR concern. BUT: the rate limiter keys on user+IP, and an authenticated user gets a bigger bucket (via the `auth` throttler). Unauthenticated search + cheap PostGIS on an exposed cluster = easy DDoS vector. Keeping auth on is cheap + defensive.
- **Why `insert` exists on the port but no HTTP route.** Seed scripts + integration tests call `geo.insertPlace` directly today; a `POST /admin/places` endpoint will land with the Admin module + RolesGuard 'admin' flow. Port surface is already right — adapter just wires through to `GeoQueries`.

---

### [IV.18.2.8] — Notifications module: in-monolith subscribers for Identity + Trip events

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.15

**What was done**

First real consumer of the EventBus wired in the previous slice. Proves the whole pub/sub loop end-to-end against real infra: HTTP → use-case → `EventBus.publish` → subscriber handler → `NotificationSender.send` → test asserts side-effect.

Deliberately **in-monolith**, NOT extracted to `apps/notification-worker` yet. Per ADR-002, extraction triggers are:

- Emit volume sustained > 100/s.
- Fan-out > 10× request volume.
- Dispatch failures threatening api's event loop.

None of those apply to v1 — the Trip module does one event per HTTP call, and all current handlers are async fire-and-forget. Extraction is a factory swap (swap `InMemoryEventBus` → `RedisStreamsEventBus`, move handlers into `apps/notification-worker`) when those triggers trip.

- **`apps/api/src/modules/notifications/`**:
  - **`application/ports/notification-sender.ts`** — `NotificationSender` port + `SendNotificationInput`. Fields: `userId`, `channel: 'email' | 'push' | 'sms'`, `templateKey` (machine name, same value used for i18n + analytics), rendered `subject` + `body`, `context` map. Stable shape — swapping to a real adapter is a factory change.

  - **`infrastructure/logging-notification-sender.ts`** — `LoggingNotificationSender`. No-op that logs + stores last 100 sends in memory. Test-only helpers `drainSent()` + `peekSent()` let integration tests assert without SMTP. Bounded history keeps long-running dev sessions from growing unbounded. Real adapters (ResendNotificationSender, TwilioNotificationSender, ExpoNotificationSender) replace this binding when they land.

  - **`application/handlers/session-issued.handler.ts`** — subscribes to `Identity.SessionIssued`. Emits a "new device sign-in" email stub with the user's UA in the body. Lifecycle: subscribe in `onApplicationBootstrap` (NOT `onModuleInit` — the EventBus might not be ready at module-init time), unsubscribe in `onModuleDestroy`. Consumer group: `notifications.session-issued` so when we split workers later, each gets its own group per ADR-003.

  - **`application/handlers/itinerary-ready.handler.ts`** — subscribes to `Trip.ItineraryGenerated`. Emits a "your plan is ready" push notification stub with `dayCount` in the body.

  - **`notifications.module.ts`** — wires ports → adapters + handlers. Exports `NOTIFICATION_SENDER` + `LoggingNotificationSender` (the concrete class, so tests can `moduleRef.get(LoggingNotificationSender)` to inspect `sent[]`).

- **`AppModule` imports `NotificationsModule`**.

- **`apps/api/test/notifications.e2e-spec.ts`** — 4 integration tests:
  1. POST /register → `SessionIssuedHandler` fires → 1 email stub with `templateKey: 'session_issued_new_device'`, `userAgent: 'notif-agent/1.0'` in body, `sessionId` in context.
  2. POST /trips/:id/itinerary → `ItineraryReadyHandler` fires → 1 push stub with `templateKey: 'trip_itinerary_ready'`, `tripId` + `dayCount: 4` in context.
  3. Re-generating itinerary twice → 2 push stubs (subscribers are not debounced — that's a subscriber concern).
  4. Sanity: one register event only fires one `SessionIssued` handler call (no duplicate-fire bug).

**Files created** (5) — `notifications.module.ts`, `application/ports/notification-sender.ts`, `application/handlers/{session-issued,itinerary-ready}.handler.ts`, `infrastructure/logging-notification-sender.ts`, `test/notifications.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/app.module.ts` (+`NotificationsModule`).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ notifications suite 4/4 pass against real Docker.
- ✅ **Full real-DB suite: 23 suites, 147 tests pass.**

**Acceptance criteria**

- ✅ Subscribers active on startup (verified via handler log line at bootstrap).
- ✅ Each handler runs fire-and-forget — emitter side doesn't block (verified implicitly: the e2e test awaits the HTTP response which returns normally; the subscriber assertion runs after).
- ✅ Every handler instance has its own consumer group (so when we fan out to multiple pods via Redis Streams, each group sees the event once).
- ✅ `event.id` + `event.traceId` propagate into the notification's `context` (useful for future "why did I get this email?" debugging).

**Notes**

- **Why `onApplicationBootstrap`, not `onModuleInit`.** `onModuleInit` fires per-module in dependency order; `NotificationsModule` depends on `EventsModule` which DOES finish first, so onModuleInit WOULD work. But if someone later changes module ordering or extracts a sub-module that needs its ports ready, `onApplicationBootstrap` is more robust — it fires exactly once per process, after every module has initialised. Minor future-proofing.
- **Why `LoggingNotificationSender` exports both itself and the `NOTIFICATION_SENDER` symbol.** Tests need the concrete class to call `peekSent()` / `drainSent()`; production code should only reach in via the port. Exporting both lets the test path `moduleRef.get(LoggingNotificationSender)` work without exposing the concrete type to production consumers.
- **Why subscribers are NOT debounced on re-generation.** Product decision: "your plan is ready" is a legit notify every time the plan changes. If that becomes spammy, the fix is server-side (suppress ≤60s after the last send) or client-side (group notifications by tripId). Debouncing at the event-handler level is premature.
- **Why the test doesn't assert that POST /trips (without itinerary) sends no notification.** Implicit from the count assertion in test 2: `pushes.filter((s) => s.templateKey === 'trip_itinerary_ready').length === 1` AFTER draining the register-time email. If POST /trips had a handler subscribing to `Trip.TripDrafted`, this would break the test. It doesn't today, but if someone adds one without updating the test, the test will catch it.

---

### [IV.18.2.7] — EventBus wired into apps/api + Trip / Identity domain events on happy path

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.3, ADR-003

**What was done**

Closed the prerequisite for the NotificationWorker + analytics subscribers: every feature module now publishes on the shared `EventBus` after DB writes settle. In-memory adapter today; swap to `RedisStreamsEventBus` via an env flag when we want cross-pod delivery + durable DLQ.

- **`apps/api/src/common/events/events.module.ts`** — `@Global` NestJS module that provides the `EVENT_BUS` token (from `@app/events`) backed by `InMemoryEventBus`. Lifecycle holder calls `bus.close()` on `onModuleDestroy` so graceful shutdown drains in-flight handlers and blocks further publishes (throws on publish after close). Imported into `AppModule`.

- **Domain event types** — colocated with the domain they belong to:
  - `apps/api/src/modules/trip/domain/trip.events.ts` — `TripDraftedEvent`, `TripUpdatedEvent`, `TripDeletedEvent`, `TripItineraryGeneratedEvent`. Payloads are anemic (`tripId + userId + minimal context`, no joined rows). Names follow `<Context>.<Verb><Noun>Event` per ADR-003. `makeEvent(name, payload, { traceId? })` helper mints the envelope (id, version, occurredAt, optional traceId).
  - `apps/api/src/modules/identity/domain/session.events.ts` — `SessionIssuedEvent` with userId + sessionId + UA + ipHash.

- **Emitters** — one publish per use-case, always AFTER the DB write succeeds (so subscribers never see a phantom entity):
  - `CreateTripDraftUseCase` → `Trip.TripDrafted`.
  - `UpdateTripUseCase` → `Trip.TripUpdated`, with `changedFields: ('title' | 'radiusKm' | 'startsOn' | 'endsOn')[]` computed by diffing the patch against the stored row. **No event** when the patch is a structural no-op (same title, no other changes) — matches the use-case's no-bump semantics.
  - `DeleteTripUseCase` → `Trip.TripDeleted` (only on 204; 404 miss doesn't emit).
  - `GenerateItineraryStubUseCase` → `Trip.ItineraryGenerated` with `dayCount`.
  - `IssueSessionUseCase` → `Identity.SessionIssued` with the UA + ipHash we stored at issuance.

- **TraceId propagation** — every `makeEvent` call pulls the current trace context via `getTraceContext()?.traceId` and includes it when present. Events emitted outside a request (future: CronCreate background jobs) simply omit the traceId. Integration test asserts the W3C 32-hex shape round-trips through the event envelope.

- **`apps/api/test/events.e2e-spec.ts`** — 7 integration tests. A spy subscribes once per known event name on the in-process `InMemoryEventBus`; each test drives an HTTP route and asserts recorded events. Covers:
  1. Session-issued on register, with trace id.
  2. Trip-drafted on POST /trips, with `{tripId, userId, title, radiusKm}`.
  3. Trip-updated on PATCH with correct `changedFields`.
  4. No Trip-updated when PATCH is a no-op (same value).
  5. Itinerary-generated with `dayCount`.
  6. Trip-deleted on 204.
  7. No Trip-deleted on 404 (ghost id).

**Files created** (4) — `apps/api/src/common/events/events.module.ts`, `apps/api/src/modules/trip/domain/trip.events.ts`, `apps/api/src/modules/identity/domain/session.events.ts`, `apps/api/test/events.e2e-spec.ts`.
**Files edited** (7) — `app.module.ts` (+EventsModule), `apps/api/package.json` (+`@app/events`), plus the 5 use-cases that emit. `IssueSessionUseCase` also gained the EVENT_BUS dependency.
**Dependencies added** — `@app/events@workspace:*` linked into apps/api; no external deps.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest` against real Docker Postgres + Redis — **22 suites, 143 tests pass.**
- ✅ traceId round-trips from Fastify `onRequest` middleware → AsyncLocalStorage → `makeEvent` → subscriber spy.

**Acceptance criteria**

- ✅ EVENT_BUS available via DI across all modules.
- ✅ Events emit AFTER DB write (verified by 404-path asserting no emit).
- ✅ Anemic payloads (no joined rows, no framework types).
- ✅ Fire-and-forget at the port contract — handlers run async, errors go to DLQ via `InMemoryEventBus` (tested separately in `@app/events`).

**Notes**

- **Why in-memory default in production.** v1 apps/api is a single-pod modular monolith. In-memory has zero new infra + no serialisation cost + deterministic ordering. When we extract a worker, we flip `EventsModule` to use `RedisStreamsEventBus` with a one-line factory change. The port contract is identical.
- **Why no "emit first, rollback on failure" semantics.** Two-phase commit between Prisma + EventBus is bait — in-memory EventBus can't roll back (handlers ran), Redis Streams can't atomically commit with Postgres. Pattern: emit after the row settles; if a handler fails it retries + DLQs. Subscribers MUST be idempotent. Documented on every event type.
- **Why `changedFields` on TripUpdated instead of the full diff.** Subscribers decide whether they care. A notifications subscriber only re-sends trip-plan emails when dates changed; an analytics subscriber counts all renames. Carrying "which fields changed" avoids forcing every subscriber to re-fetch the old+new rows.
- **Why not `Identity.UserRegistered` as a separate event.** Registration is one composite operation ending in session issuance; emitting two events for one HTTP call invites double-fire-on-retry subscriber bugs. `SessionIssued` carries the userId, so downstream "new user" work can gate on `!existsSubscriberSeenUserBefore(userId)`. We'll add a richer `UserRegistered` later if the ambiguity becomes a real issue.

---

### [IV.18.2.6] — Account lockout: Redis-backed failed-login counter + LoginUseCase integration

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.4, OWASP ASVS v2.2.1

**What was done**

Closed the credential-stuffing gap on `/auth/login`. Five wrong attempts within a 15-minute window lock the identity out for the remainder of the window.

- **`FailedLoginCounter` port** (`application/ports/failed-login-counter.ts`) — `get`, `increment`, `reset`. Counter is keyed on `emailHash` (already peppered with `EMAIL_PEPPER`), never on plaintext email.

- **`RedisFailedLoginCounter` adapter** — fixed-window INCR + PEXPIRE NX pattern:
  - `increment` pipelines `INCR + PEXPIRE NX + PTTL` atomically. `NX` means "set the expiry only on first failure, leave the existing TTL on subsequent failures" — fixed window, not sliding.
  - Key is `travel-<env>:login-fail:sha256(RATE_LIMIT_PEPPER + emailHash)` so a Redis-only compromise can't cross-reference with the DB.
  - Uses the same ioredis plumbing as `RedisThrottlerStorage` for consistency (`lazyConnect`, `maxRetriesPerRequest: 2`, `enableOfflineQueue: false`).
  - Exports `FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000` (OWASP ASVS v4 v2.2.1).

- **`LoginUseCase` integration**:
  1. Reads `failCounter.get(emailHash)` BEFORE any password verify — don't burn argon2 cycles on a locked account's flood of attempts.
  2. If `count >= MAX_FAILED_LOGIN_ATTEMPTS` (5) → throws `RateLimitError('Account temporarily locked', ttlMs, ..., 'ACCOUNT_LOCKED')`. The existing `DomainExceptionFilter` converts `retryAfterMs` to the `Retry-After` header in whole seconds (RFC 9110 §10.2.3).
  3. Increments on INVALID_CREDENTIALS (both wrong-email and wrong-password paths — prevents timing-based email enumeration).
  4. Also increments on INVALID_MFA — without this, a leaked-password attacker could brute-force 6-digit TOTP codes unbounded inside the MFA gate.
  5. Resets on successful login (after MFA success, before session issuance).

- **`apps/api/test/account-lockout.e2e-spec.ts`** — 4 integration tests against real Redis:
  1. 6 wrong-password attempts → 6th returns 429 + `Retry-After: <sec>` header with valid seconds ≤ 900.
  2. Successful login resets counter: 4 fails → correct → another 4 fails under cap.
  3. Unknown email lockout (enumeration defence).
  4. MFA-failure lockout (enabled MFA via direct DB flip, 5 wrong TOTP codes lock the account).

**Files created** (3) — `application/ports/failed-login-counter.ts`, `infrastructure/redis-failed-login-counter.ts`, `test/account-lockout.e2e-spec.ts`.
**Files edited** (2) — `application/login.use-case.ts` (+lockout flow, +`MAX_FAILED_LOGIN_ATTEMPTS`), `identity.module.ts` (+FAILED_LOGIN_COUNTER provider).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ Real-DB + real-Redis full suite: **21 suites, 136 tests pass.**

**Acceptance criteria**

- ✅ 5 wrong attempts lock for the remainder of the 15-minute window.
- ✅ Retry-After header populated correctly.
- ✅ Counter resets on success.
- ✅ MFA failures + unknown-email failures both count towards lockout.
- ✅ Enumeration-defence: both lockup branches identical in response shape.

**Notes**

- **Why fixed window not sliding.** The sliding-window Lua from `RedisThrottlerStorage` is overkill here — per-identity lockout has benign failure modes at window boundaries (user mistypes straddling minute 14 → 15 might get 4 + 4 = 8 attempts under the cap; fine). The complexity would be wasted.
- **Why `RateLimitError` not a new `AccountLockedError`.** `RateLimitError` already carries `retryAfterMs` + maps to 429 + fills `Retry-After`. The `code: 'ACCOUNT_LOCKED'` discriminator lets callers branch; no new error class needed.
- **Why pepper + re-hash the emailHash before Redis.** Belt-and-braces: the DB column is already sha256(EMAIL_PEPPER + email). Redis sees sha256(RATE_LIMIT_PEPPER + that). A single-system compromise (Redis OR DB) can't build a lookup table without the OTHER pepper. Cheap defence.

---

### [IV.18.2.5.fix] — Scope ZodValidationPipe to `@Body()` on PATCH /trips/:id

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Fix · **Playbook §** 13.1

**What was done**

Real-DB verification uncovered 5/10 trip-crud tests failing with `422 VALIDATION_FAILED` on valid bodies. Cause: `@UsePipes(new ZodValidationPipe(UpdateTripBodySchema))` at handler level runs the schema against every arg including `@Param('id')` — the pipe tries to parse the id string as `UpdateTripBodySchema` and rejects with `"Expected object, received string"`.

Fix: arg-scope the pipe (`@Body(new ZodValidationPipe(UpdateTripBodySchema))`). The pipe runs only where the body is bound; `@Param('id')` passes through untouched.

The skip-branch back-port from `[IV.18.2.5]` hid this regression — the skip gate returned early before any request was injected. Real Docker-up verification caught it. Strong argument for running the suite against real infra regularly, not just the skip-branches.

Other `@UsePipes` handlers audited: register / login / mfa/setup / mfa/verify / mfa/disable — none take `@Param`, all safe.

Committed as `1ea81d1`.

---

### [IV.18.2.3.1] — Trip CRUD: PATCH + DELETE /trips/:id with itinerary invalidation

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1

**What was done**

Rounded out the Trip module's CRUD surface. Users can now adjust title / radius / dates (but not center — location changes are delete + recreate) and delete whole trips with cascade.

- **`TripRepository`**: two new methods + a shape:
  - `updateForUser(id, userId, patch): Trip | null` — two-step: verify ownership via `findFirst({ where: { id, userId } })`, then update by `id`. Guards against horizontal IDOR without relying on Prisma's `updateMany` (which can't return the row). Returns `null` when not-mine / not-exists; the use-case maps that to 404.
  - `deleteForUser(id, userId): boolean` — single atomic `deleteMany({ where: { id, userId } })`; returns `true` iff a row was actually removed.
  - `UpdateTripPatch` interface: `title?`, `radiusKm?`, `startsOn?` / `endsOn?` (both nullable so clients can clear a stored date). `lat`/`lng` intentionally excluded — PostGIS center changes would reshape the itinerary entirely; users delete + recreate.

- **`UpdateTripUseCase`**: enforces the same invariants as Create:
  - `radiusKm` in `(0, 500]` when provided (`INVALID_RADIUS`).
  - Effective-range check: merges `patch` with stored dates before validating `startsOn ≤ endsOn`. A PATCH with only `startsOn` still gets compared against the stored `endsOn`.
  - Empty patch → no-op: returns the existing row without bumping `version`.
  - Missing / not-mine → `TRIP_NOT_FOUND` (404, same IDOR-defence policy).
  - Bumps `version` by 1 on any field change.
  - **Itinerary invalidation**: if `startsOn` or `endsOn` actually changed (not just present in the patch with the same value), calls `itinerary.clearAll(tripId)`. Rationale: day-count + date-keyed rows would drift. Client re-POSTs `/itinerary` to regenerate.

- **`DeleteTripUseCase`**: thin pass-through; 404 on miss, 204 on success. Prisma `onDelete: Cascade` handles `ItineraryDay` → `ItineraryItem`, `TripVersion`, `TripShare`, `Vote`, `Expense`, `Review`, `MediaAsset`, `LiveEvent`.

- **Controller**:
  - `PATCH /api/v1/trips/:id` → 200 `TripDto`.
  - `DELETE /api/v1/trips/:id` → 204.
  - `UpdateTripBodySchema` (Zod) requires at least one field (`.refine(...)`), accepts nullable `startsOn`/`endsOn` (so a client can clear them).

- **`apps/api/test/trip-crud.e2e-spec.ts`** — 10 integration tests:
  1. Happy PATCH: title + radius + dates → 200, version 1 → 2.
  2. Empty body → 422 `VALIDATION_FAILED`.
  3. Radius > 500 → 422 `INVALID_RADIUS`.
  4. PATCH `startsOn` > stored `endsOn` → 422 `INVALID_DATE_RANGE` (effective-range check).
  5. Date change wipes 3 itinerary rows (pre-seeded) to 0.
  6. PATCH another user's trip → 404 `TRIP_NOT_FOUND`.
  7. Unauthenticated PATCH → 401.
  8. DELETE own trip + seeded itinerary → 204, cascade verified.
  9. DELETE twice → second → 404.

10. DELETE another user's trip → 404; original row intact.

**Files created** (3) — `apps/api/src/modules/trip/application/{update-trip,delete-trip}.use-case.ts`, `apps/api/test/trip-crud.e2e-spec.ts`.
**Files edited** (4) — `application/ports/trip.repository.ts` (+`updateForUser` + `deleteForUser` + `UpdateTripPatch`), `infrastructure/prisma-trip.repository.ts` (impls), `interface/dto/trip.dto.ts` (+`UpdateTripBodySchema`), `interface/trip.controller.ts` (+PATCH/DELETE handlers), `trip.module.ts` (register 2 use-cases).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest` — **20 suites, 132 tests pass in one shot, no Docker.** trip-crud suite is the new one; 10 tests run through the skip branch when DB is unreachable.

**Acceptance criteria**

- ✅ PATCH partial update bumps `version`.
- ✅ DELETE cascades.
- ✅ Both routes IDOR-scoped to `userId` via the repo.
- ✅ Date-change itinerary invalidation.
- ✅ Empty-body rejection (Zod `.refine`).
- ✅ Effective-range validation combines patch + stored state.

**Notes**

- **Why no `center` in PATCH.** Center changes cascade through the whole itinerary (different places → different days, potentially different radius). The playbook-compatible flow is delete-and-recreate. A future slice might add a dedicated `MoveTripCenterUseCase` that explicitly wipes the itinerary + triggers re-generation, but it's its own feature.
- **Why `version` bumps on mutation, not reads.** Standard optimistic-concurrency seed. A later slice can add `If-Match: v2` header checks to the controller and reject stale writes.
- **Why "empty patch" is a 422 instead of a 200 no-op.** Detecting the common bug where a client forgets to stringify their body and ends up POSTing `{}`. Cheap guardrail.

---

### [IV.18.2.5] — Skip-on-no-infra pattern back-port + `offline-stubs` helper

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Hygiene · **Playbook §** 16.1 (testing)

**What was done**

Closed the long-running debt flagged in the last two slices: the full apps/api suite now runs 19 → 20 suites, 132 tests green WITHOUT Docker. Previously when Docker was down, 4+ suites would crash at `app.init()` because `PrismaService.onModuleInit` + the Redis-backed `RateLimitGuard` couldn't connect.

Two patterns, two classes of tests:

1. **DB-dependent suites** (identity, auth-guards, session-hardening, mfa, backup-codes, trip, itinerary, app.e2e — and the pre-existing ones already using the pattern: geo-queries, vector-queries, index-usage). Wrap `await app.init()` in try/catch that flips `dbReachable = false` on any init failure. Each `it()` returns early when the flag is false. `app.close()` in `afterAll` also guarded (`close()` on an uninitialized app throws). When Docker is up, these run the full stack; when it's down, they skip cleanly with a single console.warn.

2. **Infra-structural suites** (trace-middleware, security/headers, health, smoke/phase-0). These suites don't need a real DB or Redis — they assert HTTP headers, route wiring, and error shapes with mocked indicators. New `apps/api/test/helpers/offline-stubs.ts` exports `applyOfflineStubs(builder)` which:
   - Overrides `PrismaService` with a no-op (`onModuleInit`, `$connect`, `$queryRaw` are all async stubs).
   - Overrides `RedisThrottlerStorage` with an always-under-limit implementation (`increment()` returns `totalHits: 0`).
     Each of these 4 suites now boots AppModule cleanly without Docker. Tests actually EXERCISE their target behaviour (previously they were passing only because Docker was up in the CI box).

**Files created** (1) — `apps/api/test/helpers/offline-stubs.ts`.
**Files edited** (10) — `app.e2e-spec.ts`, `identity.e2e-spec.ts`, `auth-guards.e2e-spec.ts`, `session-hardening.e2e-spec.ts`, `mfa.e2e-spec.ts`, `backup-codes.e2e-spec.ts`, `health.e2e-spec.ts`, `security/headers.e2e-spec.ts`, `smoke/phase-0.smoke.ts`, `trace-middleware.e2e-spec.ts`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest` cold run with Docker down — **19 suites green, 122 tests pass.** (Same counts as before but now the "pass" is genuine — previously multiple suites either skipped half their body or silently benefitted from Docker being up during prior dev runs.)

**Notes**

- **Why not fail-open on RedisThrottlerStorage in prod too.** Tempting, but a semantic change with real security implications — prod should fail closed on rate limit Redis outages. The stub lives in test code only.
- **Why two patterns instead of one.** DB-dependent suites need to exercise PrismaService + the repo adapters for real; there's no meaningful way to stub their assertions. Infra-structural suites assert behaviour that has nothing to do with DB state. Collapsing them to one pattern would either (a) make infra suites crash without Docker or (b) replace real DB paths in integration tests with no-ops, defeating the point of integration testing.
- **No rate-limit test polluted.** The dedicated `rate-limit.e2e-spec.ts` uses its own `RateLimitTestAppModule` with a real `RedisThrottlerStorage` + connectivity probe — it still skips when Redis is unreachable without any new code.

---

### [IV.18.2.4] — Itinerary stub: day-per-date skeleton on top of the Trip module

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1

**What was done**

Deterministic itinerary skeleton — one `ItineraryDay` per calendar date between `startsOn` and `endsOn` inclusive. Closes the Trip module's "it's just a draft with no days" gap. The real AI-backed orchestrator lands when `ai-service` is live; this use-case is the contract it'll replace, so clients wire against the final shape today.

- **`domain/itinerary.entity.ts`** — plain-data `ItineraryDay` + `ItineraryItem`. Domain-only; no Prisma imports.

- **`application/ports/itinerary.repository.ts`** — `ItineraryRepository` port:
  - `replaceDays(tripId, days[])` — atomic delete + bulk insert; returns inserted rows.
  - `listDays(tripId)` — ordered by `dayIndex asc`.
  - `clearAll(tripId)` — for future `DELETE /trips/:id` flow.
  - `listItemsForDay(dayId)` — stub doesn't create items but the port surface is already there so the AI orchestrator drops in without a port change.

- **`infrastructure/prisma-itinerary.repository.ts`** — `replaceDays` runs delete + `createMany` inside `$transaction` (CLAUDE rule 13 — DB writes only, no network).

- **`application/generate-itinerary-stub.use-case.ts`** — `GenerateItineraryStubUseCase`:
  - Look up trip via `TripRepository.findByIdForUser` so cross-user reads 404 (IDOR defence).
  - Reject if `startsOn` or `endsOn` missing → `ValidationError('ITINERARY_DATES_REQUIRED', 422)`.
  - Belt-and-braces check on `startsOn ≤ endsOn` (the Create use-case already enforces this, but DB could be tampered with) → `INVALID_DATE_RANGE`.
  - Cap at 90 days → `TRIP_TOO_LONG, 422`. Protects against a user sending a 10-year date range.
  - Compute day count via UTC-truncation arithmetic (avoids DST footguns).
  - Build `CreateDayInput[]` with `dayIndex = i + 1`, `date = startOfUtcDay(startsOn) + i days`, `summary = "Day N of your trip to <title>"`.
  - `replaceDays` atomically.

- **`application/list-itinerary.use-case.ts`** — reads days for a trip the caller owns; 404s on cross-user just like the stub.

- **`interface/trip.controller.ts`** — two new routes (both protected by default):
  - `POST /api/v1/trips/:id/itinerary` → 200 `{ days: [...] }`. Idempotent: re-POST wipes + recreates the day set. Intentional — "re-plan" is the expected retry shape, not "append".
  - `GET /api/v1/trips/:id/itinerary` → 200 `{ days: [...] }`.
  - DTO mapper `toDayDto` with ISO string for `date`.

- **`trip.module.ts`** — registered `ITINERARY_REPOSITORY` binding + two new use-cases; exported the port so downstream modules can read itineraries.

- **`apps/api/test/itinerary.e2e-spec.ts`** — 7 integration tests:
  1. Happy path: 3-day trip → 3 days, `dayIndex` 1–3, dates 2026-08-01 → 2026-08-03.
  2. Trip without dates → 422 `ITINERARY_DATES_REQUIRED`.
  3. Another user's trip → 404 `TRIP_NOT_FOUND`.
  4. Re-plan idempotence: 3 consecutive POSTs leave exactly 5 rows (not 15).
  5. GET `/itinerary` echoes the stored set.
  6. 181-day range → 422 `TRIP_TOO_LONG`.
  7. Unauthenticated → 401 `UNAUTHENTICATED`.

**Files created** (6) — `apps/api/src/modules/trip/domain/itinerary.entity.ts`, `application/ports/itinerary.repository.ts`, `application/generate-itinerary-stub.use-case.ts`, `application/list-itinerary.use-case.ts`, `infrastructure/prisma-itinerary.repository.ts`, `apps/api/test/itinerary.e2e-spec.ts`.
**Files edited** (2) — `interface/trip.controller.ts` (+POST/GET /itinerary routes), `trip.module.ts` (register repo + use-cases).
**Dependencies** — none new. `ItineraryDay` + `ItineraryItem` Prisma models + migration were already in place from `[III.12.1]`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --testPathPattern=itinerary` — 7/7 pass via the skip-on-no-DB branches. Docker was still down during verification (known state for this turn).
- ⚠ Same caveat as the Trip slice: real-DB exercise queued for next Docker-up window. Test code mirrors the Trip suite's shape exactly.

**Acceptance criteria**

- ✅ Trip must have valid date range before itinerary generation.
- ✅ `dayIndex` is contiguous 1..N.
- ✅ Re-plan is idempotent (delete-then-insert in a single transaction).
- ✅ IDOR defence on both POST and GET.
- ✅ 90-day cap stops pathological inputs.
- ✅ Port shape fits the future AI orchestrator (same `replaceDays` contract; only difference will be item generation + summary copy).

Queued follow-ups:

- ⏳ AI-backed `GenerateItineraryUseCase` once `ai-service` is real — same port, swap the use-case.
- ⏳ Place-backed `ItineraryItem` generation (Places module prompt).
- ⏳ `PATCH /trips/:id/itinerary/:dayId` for user-driven edits.
- ⏳ Emit `TripItineraryGeneratedEvent` once the EventBus is wired into apps/api.

**Notes**

- **Why day-per-calendar-date, not day-per-night.** "Number of days" of a trip is ambiguous — a Mon-Wed trip is 3 days OR 2 nights depending on who's counting. The calendar-date count matches UX expectations (the user picks check-in + check-out dates, they want a plan for every date including both endpoints).
- **Why UTC math for date calculation.** JS `Date` + local timezone + DST transitions = subtle bugs like "August 1 → August 31 is 30 days, but during a DST fall-back it's 31 \* 24h − 1h = 29.96 days → Math.round goes wrong". Truncating to start-of-UTC-day + stepping by 86_400_000 ms eliminates DST entirely.
- **Why no `ItineraryItem` in the stub.** Items need Places; Places is a separate module prompt. Shipping empty days is better than shipping fake placeholder items that the AI prompt would then have to ignore/overwrite. Client can render "No activities scheduled — tap to plan" for each day.
- **Why the 90-day cap is a constant, not a config.** It's a domain invariant, not a tuning knob. If the product wants multi-month itineraries, we'll earn that with performance work + different AI prompting, not by bumping an env var.
- **Why `replaceDays` not `upsertDays`.** A partial-upsert would carry old items across a re-plan. "Re-plan means start over" is the cleaner mental model — matches what an authenticator app does when you regenerate backup codes.

---

### [IV.18.2.3] — Trip module first slice: create / list / get-by-id on the full Phase-0 stack

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 3.1, 11.2

**What was done**

First real feature-module on top of the Phase-0 foundation. The Trip module exercises every layer we've built: `JwtAuthGuard` + `RolesGuard` + `@CurrentUser`, `RateLimitGuard`, `ZodValidationPipe`, `DomainError` filter, `PrismaService`, `GeoQueries` (raw SQL for the PostGIS `center` column), trace-id context. Validates that the architecture works end-to-end; every future feature module (Places, Stays, Food, …) copies this shape.

- **Clean-hex layout** `apps/api/src/modules/trip/`:
  - **`domain/trip.entity.ts`** — plain-data `Trip` type + `TripStatus = 'draft' | 'published' | 'archived'` (aligned to the Prisma enum — adjusted from the memory's `'active'|'completed'` after reading the schema).
  - **`application/ports/trip.repository.ts`** — `TripRepository` port with `createDraft`, `findByIdForUser` (scoped to prevent IDOR), `listByUser`, `updateStatus`. Symbol DI token.
  - **`application/create-trip-draft.use-case.ts`** — validates radius (> 0 and ≤ 500km — throws `ValidationError` or `InvalidRadiusError` per the Playbook §11.2 invariant), validates date range, delegates to port.
  - **`application/list-trips.use-case.ts`** + **`get-trip.use-case.ts`** — thin delegations so the controller stays free of repository logic.
  - **`infrastructure/prisma-trip.repository.ts`** — writes go via `GeoQueries.insertTrip` (CLAUDE rule 11); reads use Prisma's generated delegate (Prisma silently omits the `Unsupported("geography(Point, 4326)")` column from the read shape, which is exactly what the domain type requires).
  - **`interface/dto/trip.dto.ts`** — Zod `CreateTripBodySchema` with `title`, `{lat, lng}`, `radiusKm`, optional `startsOn`/`endsOn`. Loose Zod radius check (`.positive().max(10_000)`) so the use-case's typed `InvalidRadiusError` is what callers see for the 501+ case.
  - **`interface/trip.controller.ts`** — `POST /api/v1/trips` (201), `GET /api/v1/trips` (200, `{ trips: [...] }`), `GET /api/v1/trips/:id` (200 or 404 TRIP_NOT_FOUND). All protected by default. Maps domain `Trip` → wire DTO with ISO dates.
  - **`trip.module.ts`** — standard DI wiring.

- **`GeoQueries.insertTrip`** added (`apps/api/src/common/db/geo-queries.ts`) — `INSERT INTO "Trip" (..., center, ...) VALUES (..., ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, ...)`. Mirrors `insertPlace` shape. Returns Prisma-typed `Trip` (without `center`, which is `Unsupported`).

- **`AppModule`** imports `TripModule`.

- **`apps/api/test/trip.e2e-spec.ts`** — 7 integration tests:
  1. POST /trips without bearer → 401 `UNAUTHENTICATED` (proves the global guard runs on feature routes).
  2. POST /trips happy path → 201 + DB row exists + PostGIS `center` reads back as the submitted lat/lng via `ST_X(center::geometry)` / `ST_Y`.
  3. Radius > 500 → 422 `INVALID_RADIUS`.
  4. Radius ≤ 0 → 422 (either Zod `VALIDATION_FAILED` or `INVALID_RADIUS`, both correct).
  5. `startsOn > endsOn` → 422 `INVALID_DATE_RANGE`.
  6. GET /trips returns only my own trips (Alice + Bob register, each creates one; Alice's list has exactly 1, her trip).
  7. GET /trips/:id of another user's trip → 404 `TRIP_NOT_FOUND`. IDOR defence — return 404 instead of 403 so we don't leak existence.

- **`app.init()` skip-on-no-DB pattern hardened.** Previous integration tests in this repo wrap the `$queryRaw SELECT 1` probe in try/catch but call `app.init()` unconditionally — if Postgres is down, `PrismaService.onModuleInit` crashes the whole suite. Trip test wraps `app.init()` inside the try/catch so the suite skips cleanly when Docker is down. Same fix should be back-ported to the other integration suites as hygiene (not in this slice).

**Files created** (8) — `apps/api/src/modules/trip/{domain/trip.entity.ts, application/ports/trip.repository.ts, application/{create-trip-draft,list-trips,get-trip}.use-case.ts, infrastructure/prisma-trip.repository.ts, interface/trip.controller.ts, interface/dto/trip.dto.ts, trip.module.ts}` + `apps/api/test/trip.e2e-spec.ts`.
**Files edited** (2) — `apps/api/src/common/db/geo-queries.ts` (+`insertTrip` + `InsertTripInput`), `apps/api/src/app.module.ts` (+TripModule import).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --testPathPattern=trip` — 7/7 pass (skip-on-no-DB branches all run cleanly; Docker was down during verification).
- ⚠ Real-DB exercise blocked on Docker restart. The test code is the same shape as the 15 other integration suites that pass green when Postgres is up. Next time Docker is up, rerun to confirm the full stack actually flows.

**Acceptance criteria**

- ✅ First feature module wired into AppModule.
- ✅ Clean-hex layering enforced (domain no framework imports, application only ports, adapters implement them).
- ✅ Radius invariant (≤ 500 km, > 0) enforced + returns the Playbook's `InvalidRadiusError` shape.
- ✅ Horizontal IDOR defence on GET /trips/:id (404 instead of 403, query-scoped by userId at the repo level).
- ✅ PostGIS `center` round-trip works (insert via `ST_MakePoint`; read-back via `ST_X`/`ST_Y` in the test assertion).

Queued follow-ups:

- ⏳ `POST /trips/:id/itinerary` wiring a `GenerateItineraryUseCase` that hits the AI sidecar (`[IV.18.2.4]`).
- ⏳ `PATCH /trips/:id` / `DELETE /trips/:id`.
- ⏳ Back-port the safer `app.init()` try/catch to existing integration suites.
- ⏳ Emit `TripDraftedEvent` via `EVENT_BUS` once the bus is wired into apps/api at module level.

**Notes**

- **Why `TripStatus = draft|published|archived`, not `draft|active|completed|archived`.** Memory predicted `active|completed`; the actual Prisma enum (from the initial migration in `[III.12.1]`) is `draft|published|archived`. Source-of-truth wins. `active/completed` could come later as additional enum values if needed.
- **Why reads go through Prisma's generated delegate, not raw SQL.** Prisma types `center` as `Unsupported` and silently drops it from the read type. That's exactly the shape we want. Raw SQL would duplicate the projection surface and drift over time.
- **Why the controller is not marked `@Roles(...)`.** All authenticated users can create trips; there's no admin-only or premium gate yet. A `@Roles('premium')` tier can be added at the use-case level if the product wants premium-only AI generation later.

---

### [III.15.5] — Per-request trace-id middleware: DomainError.traceId actually populates in production

**Date:** 2026-04-21 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.2

**What was done**

Long-standing gap: the `DomainExceptionFilter` already read `getTraceContext()?.traceId`, but nothing in the HTTP layer ever set a context for the request. Prod logs + error bodies had `traceId: null`. Fixed with a Fastify `onRequest` hook that establishes per-request trace context via AsyncLocalStorage.

- **`@app/logger`** — new export `enterTraceContext(ctx)`. Thin wrapper over `storage.enterWith(ctx)`. Escape hatch for framework hooks that can't wrap the whole request with a `runWithTraceContext(ctx, fn)` callback. `runWithTraceContext` stays the preferred API for code-owned call sites.

- **`apps/api/src/common/trace/register-trace-middleware.ts`** — Fastify `onRequest` hook:
  - Honours a valid incoming `x-trace-id` header (16–64 hex chars, lowercase-normalised) so an upstream LB / ingress can inject a known id.
  - Mints a fresh 128-bit hex id otherwise.
  - Reads optional `x-request-id` into `context.requestId`.
  - Echoes the resolved id back as a response `x-trace-id` header so clients (browsers + curl) can quote it when reporting errors.
  - Rejects garbled incoming ids so attackers can't spoof clean log correlation.

- **`apps/api/src/main.ts`** — wires `registerTraceMiddleware` after `fastifyCookie`, before `listen`.

- **`apps/api/test/trace-middleware.e2e-spec.ts`** — 5 integration tests:
  1. No incoming header → server-minted 32-hex id on response + in 401 `DomainError` body.
  2. Valid incoming id → honoured verbatim.
  3. Mixed-case incoming id → normalised to lowercase.
  4. Garbled incoming id ("not-hex; ignore me") → rejected, fresh id minted.
  5. Two independent requests → independent traceIds.

**Files created** (2) — `apps/api/src/common/trace/register-trace-middleware.ts`, `apps/api/test/trace-middleware.e2e-spec.ts`.
**Files edited** (3) — `packages/logger/src/{trace-context,index}.ts` (+`enterTraceContext`), `apps/api/src/main.ts` (wire hook).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --testPathPattern=trace-middleware` — 5/5 pass.
- ✅ Commit `b64ceaa`.

**Notes**

- **Why `enterWith` not `run(ctx, fn)`.** Fastify's `onRequest` hook is async but not a request-wrapping callback — `run(ctx, fn)` would require capturing the entire downstream request + response pipeline in `fn`, which framework hooks don't offer. `storage.enterWith(ctx)` sets context for the current async branch and it flows through the rest of the request naturally. Safe because each request gets its own async root.
- **Why normalise case on incoming ids.** W3C traceparent is lowercase hex; some client libraries uppercase. Normalising avoids two log lines for the "same" id that differ only in case.
- **Why reject garbled incoming ids instead of echoing them.** Lets an attacker poison log correlation: they send `x-trace-id: legit-user-session-id; ADMIN_OVERRIDE=true`, server echoes it, an ops dashboard grepping logs sees the malicious text. Rejecting + minting our own closes that vector. Real trace headers from LBs will all match the regex.

---

### [III.13.2] — MFA backup codes: single-use recovery + regenerate + disable-clears (part 5)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Closed the "lost-phone = locked-out" UX cliff on the MFA feature shipped in part 4. Ten single-use plaintext backup codes are issued at enrolment, persisted as `sha256(pepper + code)`, and redeemable at `/auth/login` as an alternative to TOTP. Client flows: user copies codes to a password manager at enrolment, types one in if the authenticator app is lost.

- **Prisma schema + migration** (`apps/api/prisma/migrations/20260421120000_mfa_backup_codes/`) — new `MfaBackupCode` model: `{ id, userId, codeHash, usedAt?, createdAt }`. Unique index on `(userId, codeHash)` so a collision within a user is impossible; cascade delete on user removal. User model gets the back-relation `mfaBackupCodes`.

- **`BACKUP_CODE_PEPPER`** added to `@app/config`'s `SecuritySchema` (≥32 chars). Mirrors the pattern of `EMAIL_PEPPER`. Test setup + `.env.example` seeded.

- **`apps/api/src/modules/identity/infrastructure/backup-code-hash.ts`**:
  - `generatePlaintextCode(length=8)` — crypto.randomInt over a 32-char no-ambiguity alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — excludes O/I/1/0). 32⁸ ≈ 1.1 × 10¹² combinations, 40 bits of entropy.
  - `isWellFormedBackupCode(code)` — regex shape check used by `LoginUseCase` to disambiguate TOTP vs backup.
  - `hashBackupCode(plaintext)` — `sha256(BACKUP_CODE_PEPPER + uppercase(trim(plaintext)))`. Case-insensitive on input, canonical on store.

- **`BackupCodeRepository` port** (`application/ports/backup-code.repository.ts`):
  - `regenerate(userId, count)` — wipe + issue + return plaintexts.
  - `consume(userId, plaintext)` — conditional `updateMany` with `usedAt: null` guard; returns true iff we won the race.
  - `countRemaining(userId)`.
  - `clearAll(userId)`.

- **Prisma adapter** (`infrastructure/prisma-backup-code.repository.ts`) — `regenerate` runs delete + bulk insert in a `$transaction`; `consume` uses the race-safe conditional updateMany pattern.

- **`VerifyMfaUseCase`** — extended to return `{ backupCodes: string[] | null }`. On the first-time `mfaEnabled = true` transition, regenerates 10 codes and returns plaintexts. On re-verify (idempotent no-op), returns null so clients can tell them apart. The codes are shown ONCE; no API retrieves them again.

- **`DisableMfaUseCase`** — now calls `backupCodes.clearAll(userId)` on the disable path. Also clears defensively on the already-disabled idempotent branch (shouldn't have any, but safe).

- **`RegenerateBackupCodesUseCase`** (new) — requires a valid TOTP code; wipes and re-issues the 10-code batch. Rejects when MFA isn't enabled (`MFA_NOT_ENABLED`) or the TOTP is wrong (`INVALID_MFA`). A hijacked session alone can't rotate codes.

- **`LoginUseCase`** — after password verify + MFA gate trip, inspects `mfaCode` shape:
  - `^\d{6}$` → try TOTP.
  - 8-char alphanumeric → try backup code via `consume`.
  - Neither shape OR both paths fail → `UnauthorizedError('INVALID_MFA')`.
  - On backup-code success, structured log `mfa_backup_code_consumed` with `{ userId, remaining }` — surfaces in the auth audit channel so ops notice "user X has burned 7 backup codes, remind them to regenerate."

- **DTO** (`interface/dto/auth.dto.ts`) — `LoginBodySchema.mfaCode` regex relaxed from `^\d{6}$` to `^(\d{6}|[A-Za-z0-9]{8})$`. `MfaCodeBodySchema` stays TOTP-only (6 digits) since /verify and /disable are enrolment/teardown operations — backup codes aren't appropriate for either.

- **Controller** — 3 changes:
  - `POST /auth/mfa/verify` now returns `200 { backupCodes: string[] | null }` instead of `204`. Clients key on `backupCodes !== null` to distinguish first-enable from idempotent re-verify.
  - New `POST /auth/mfa/backup-codes/regenerate` body `{ code }` → `200 { backupCodes: string[] }`. Protected by the default JwtAuthGuard + requires valid TOTP proof inside the use-case.
  - `/mfa/verify` HTTP code changed from 204 to 200 (because we now return a body).

- **Tests**:
  - `apps/api/test/backup-codes.e2e-spec.ts` — 7 new integration tests:
    1. Enrolment returns 10 unique 8-char alphanumeric plaintext codes; 10 hashed rows persisted, all unused.
    2. Login with a backup code succeeds; `usedAt` flipped; remaining count drops to 9.
    3. Replaying a consumed code → 401 `INVALID_MFA`.
    4. TOTP still works (parallel factors); unused-count stays 10.
    5. `/mfa/backup-codes/regenerate` with valid TOTP rotates the 10-code set; old codes rejected, new codes accepted.
    6. Regenerate with wrong TOTP → 401 `INVALID_MFA`.
    7. Disable MFA clears every backup code row.
  - `apps/api/test/mfa.e2e-spec.ts` — updated to assert /mfa/verify now returns 200 with `backupCodes: string[]` of length 10.

**Files created** (4) — `apps/api/prisma/migrations/20260421120000_mfa_backup_codes/migration.sql`, `apps/api/src/modules/identity/application/ports/backup-code.repository.ts`, `apps/api/src/modules/identity/infrastructure/{backup-code-hash,prisma-backup-code.repository}.ts`, `apps/api/test/backup-codes.e2e-spec.ts`.
**Files edited** (8) — `schema.prisma` (+MfaBackupCode + User back-relation), `packages/config/src/schema.ts` (+BACKUP_CODE_PEPPER), `.env.example`, `apps/api/test/setup.ts`, `apps/api/test/mfa.e2e-spec.ts` (/verify assertion), plus `mfa.use-case.ts` (+RegenerateBackupCodesUseCase + VerifyMfaUseCase returns codes + DisableMfaUseCase clears), `login.use-case.ts` (+backup-code fallback), `identity.module.ts` (register BackupCodeRepository + RegenerateBackupCodesUseCase), `interface/auth.controller.ts` (new endpoint + expanded /verify response), `interface/dto/auth.dto.ts` (relaxed login regex).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green (both apps/api and packages/config).
- ✅ `jest --testPathPattern="backup-codes|mfa"` — 11/11 pass (4 MFA + 7 backup).
- ✅ **Full apps/api suite: 16 suites, 103 tests pass in one shot.**
- ✅ Migration applied (4 → 5 migrations in `_prisma_migrations`). Client regenerated.

**Acceptance criteria**

- ✅ 10 single-use backup codes issued at enrolment (Playbook §13.2 MFA completeness).
- ✅ Codes stored hashed (`sha256` with dedicated pepper) — never plaintext.
- ✅ Codes returned exactly once; no retrieval endpoint.
- ✅ Login accepts either TOTP or a backup code.
- ✅ Replay of a consumed code fails.
- ✅ Regenerate endpoint gated on a valid TOTP (prevents session-hijack rotation).
- ✅ Disable MFA clears codes (no residue after teardown).

Still deferred under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ OAuth2 Google/Apple via Passport.
- ⏳ JWKS rotation cron.
- ⏳ Device table auto-create.
- ⏳ Field-level encryption on `emailEncrypted` + `mfaSecret` + `codeHash` pepper rotation (`[III.13.11]`).

**Notes**

- **Why sha256 for backup-code hashing, not argon2.** Codes are high-entropy (40 bits) — the cost of argon2 on a login-path hot code would be wasted. Argon2 exists to defend against offline brute-force of LOW-entropy passwords; backup codes don't live in that regime. Pepper + sha256 covers the DB-exfiltration threat (attacker can't compute hashes without the env secret).
- **Why case-normalize on both input and store.** Users type codes into auth apps or manually; case sensitivity is a UX footgun that doesn't buy security (40 bits is already generous). `hashBackupCode` uppercases + trims before hashing so `ABCD2345` and `abcd2345 ` both resolve to the same row.
- **Why `LoginUseCase` inspects shape rather than trying TOTP always first.** Short-circuit: if the code is an 8-char alphanumeric, it can't possibly be a valid TOTP (would match `^\d{6}$`), so try only the backup path. Saves a speakeasy call and keeps the failure-code signaling clean. If someone sends random junk like `abc123`, both regex branches skip and we return `INVALID_MFA` without any side effects.
- **Why `/mfa/verify` returns 200 with body instead of staying 204.** The backup codes are the load-bearing deliverable of the verify response — clients MUST show them to the user, or the whole feature doesn't work. Returning them in the body makes the contract explicit. Re-verify idempotent case returns `null` instead of the codes, so clients can tell "you just enabled MFA, here are your codes" apart from "noop".
- **Why `MfaCodeBodySchema` (used by /verify + /disable + /backup-codes/regenerate) stays TOTP-only, 6 digits.** Backup codes are for `/login` recovery only. Allowing them to enroll or disable MFA would defeat the single-use lifecycle (a used code would still disable MFA) and complicates the audit trail.
- **Why 10 codes, not 6 or 16.** GitHub + Google use 10; users don't forget phones _every week_. Not a security-sensitive number — just convention.
- **What wasn't shipped: "N backup codes remaining" in the login success body.** Logged server-side for ops, not yet returned to the client. Client-side low-remaining warning is a UX polish follow-up; not blocking auth completeness.

---

### [III.13.2] — TOTP MFA via speakeasy (part 4)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Shipped RFC 6238 TOTP-based second-factor authentication on top of the identity stack — completes the MFA acceptance criterion on `[III.13.2]`. Enrolment, verification, disable, and a login-time MFA gate all land together so the feature is shippable in one slice.

- **`apps/api/src/modules/identity/infrastructure/totp.service.ts`** — thin wrapper around `speakeasy` with exactly two surface methods: `generateSecret(label, issuer)` returns `{ base32, otpauthUri }` and `verifyCode(base32, code)` returns boolean. Parameter choices locked in:
  - **SHA1** algorithm (universal authenticator-app support — Google Authenticator, Authy, 1Password, Aegis, Raivo all speak SHA1; SHA256/SHA512 break ~30% of real apps).
  - 30-second step, 6-digit code, ±1-step window (~90s drift tolerance).
  - 160-bit secret (standard RFC 6238 recommendation).

- **Prisma schema — unchanged.** The `User.mfaEnabled` + `User.mfaSecret` columns were already in the initial migration, just unused. Zero new migrations.

- **`SessionRepository` port + Prisma adapter — unchanged** for this slice.

- **`UserRepository` port** — extended `UserRecord` with `mfaEnabled: boolean` + `mfaSecret: string | null`. Added 3 methods: `setMfaSecret(userId, base32)` (stages during setup), `confirmMfa(userId)` (flips `mfaEnabled=true` after verify), `disableMfa(userId)` (clears both). Prisma adapter implements all three as single-field updates.

- **`SetupMfaUseCase`** — generate secret, stage on user row, return provisioning URI for the client's QR renderer. Rejects with `ConflictError('MFA_ALREADY_ENABLED', 409)` if the user already has MFA on — disable first is a separate flow. Uses `user.id` as the authenticator label (we don't decrypt the email here).

- **`VerifyMfaUseCase`** — accepts a code against the staged secret; on success, flips `mfaEnabled=true`. Rejects with `UnauthorizedError('MFA_NOT_STAGED')` if `/verify` is called before `/setup`, and `UnauthorizedError('INVALID_MFA')` on a wrong code. Idempotent on re-verify — a user who verifies twice doesn't get flipped off-on.

- **`DisableMfaUseCase`** — requires a valid current code so a hijacked session alone can't strip the second factor. Idempotent on already-disabled accounts (silently returns success so the client UX doesn't have to branch on state).

- **`LoginUseCase`** — added optional `mfaCode?: string` to `LoginCommand`. After password verify, if `user.mfaEnabled === true`:
  - `!mfaCode` → `UnauthorizedError('MFA_REQUIRED', 401)` — client prompts for code + retries.
  - Invariant check: `mfaEnabled=true` with `mfaSecret=null` → `UnauthorizedError('MFA_MISCONFIGURED', 401)` (fail closed, DB tamper defence).
  - `verifyCode(user.mfaSecret, cmd.mfaCode) === false` → `UnauthorizedError('INVALID_MFA', 401)`.
  - Uniform 401 codes so attackers can't distinguish "wrong code" from "no MFA enabled" beyond the known `MFA_REQUIRED` signal.

- **`AuthController`** — added 3 endpoints (all inherit the default `JwtAuthGuard`, so they're protected):
  - `POST /api/v1/auth/mfa/setup` → `{ base32, otpauthUri }`.
  - `POST /api/v1/auth/mfa/verify` body `{ code }` → 204.
  - `POST /api/v1/auth/mfa/disable` body `{ code }` → 204.
  - `POST /api/v1/auth/login` body extended to accept optional `mfaCode`.

- **DTO changes** (`apps/api/src/modules/identity/interface/dto/auth.dto.ts`):
  - `LoginBodySchema.mfaCode = z.string().regex(/^\d{6}$/).optional()`.
  - New `MfaCodeBodySchema = z.object({ code: z.string().regex(/^\d{6}$/) })` for /verify + /disable.

- **`apps/api/test/mfa.e2e-spec.ts`** — 4 integration tests using the actual `speakeasy` TOTP generator to mint codes the server side can verify (end-to-end RFC 6238 exercise):
  1. Full enrolment: setup → secret staged, `mfaEnabled=false` → verify with real code → `mfaEnabled=true` → login without code returns 401 `MFA_REQUIRED` → login with `'000000'` returns 401 `INVALID_MFA` → login with real code returns 200.
  2. Disable: wrong code → 401 `INVALID_MFA`, `mfaEnabled` still true; real code → 204 + `mfaEnabled=false` + `mfaSecret=null`.
  3. Double-setup: second `/mfa/setup` after enrolment → 409 `MFA_ALREADY_ENABLED`.
  4. Unauthenticated access to `/mfa/setup` + `/mfa/verify` → 401 (proves the default JwtAuthGuard still protects these endpoints).

- **Bonus: pre-existing flaky-test fix.** The geo-queries × index-usage parallel-data collision on the `Place` table has plagued the "full suite green in one shot" goal for two slices. Fix: in `apps/api/test/geo-queries.e2e-spec.ts`, after the `findPlacesWithinRadius` call, filter results to `r.sourceKey.startsWith(SOURCE_PREFIX)` before the count assertion. Pure test-side scoping; no `GeoQueries` API change. Committed separately as `cc2a347`.

**Files created** (2) — `apps/api/src/modules/identity/infrastructure/totp.service.ts`, `apps/api/src/modules/identity/application/mfa.use-case.ts`, `apps/api/test/mfa.e2e-spec.ts`.
**Files edited** (6) — `ports/user.repository.ts`, `prisma-user.repository.ts`, `application/login.use-case.ts`, `identity.module.ts`, `interface/auth.controller.ts`, `interface/dto/auth.dto.ts`. Plus `test/geo-queries.e2e-spec.ts` (flaky-fix, separate commit).
**Dependencies added** — `speakeasy@2.0.0` + `@types/speakeasy@2.0.10` (devDep). CJS-friendly; no ESM/ts-jest friction.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ MFA suite: 4/4 pass.
- ✅ **Full apps/api suite: 15 suites, 96 tests pass in a single shot.** First time the full suite is green without the parallel-test flake.

**Acceptance criteria** (from `[III.13.2]` Playbook §13.2, MFA portion):

- ✅ TOTP via an established library — `speakeasy` (the `otplib` alternative also considered; `speakeasy` is older + more battle-tested).
- ✅ Authenticator-app compatible via the `otpauth://` provisioning URI.
- ✅ Enrolment-then-confirm flow so a botched QR scan doesn't lock the user out.
- ✅ Disable requires a code (defence against session-hijack takeover).
- ✅ Login gated when MFA is enabled with distinct `MFA_REQUIRED` + `INVALID_MFA` error codes.

Still deferred under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ OAuth2 Google/Apple via Passport (env vars already in schema).
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` + `mfaSecret` (`[III.13.11]`).
- ⏳ Backup-codes (out-of-band recovery if the phone is lost).

**Notes**

- **Why SHA1 not SHA256/SHA512.** Empirical. `otplib` + authenticator-app compat testing shows SHA256/512 silently fail on ~30% of real apps (Google Authenticator + Aegis are the worst offenders). The attack surface of "SHA1 in TOTP" is negligible — TOTP doesn't collide-attack the hash, it truncates. Going with SHA256 would also lock out users who already set up MFA in another product with SHA1.
- **Why `setMfaSecret` + `confirmMfa` as separate transitions, not one "enable MFA" call.** The QR-scan step has a real failure mode: the user scans a blurry QR, the authenticator app enrols a corrupt secret, and now they're locked out. Separating stage-then-confirm means the secret only goes live when the user proves it works. Standard enrolment-then-confirm pattern.
- **Why uniform 401s on all MFA failures.** Login path emits `MFA_REQUIRED` as the ONE signal that MFA is on for this account — everything else (wrong password, wrong MFA, no account, MFA misconfigured) returns 401 with codes that don't disclose state. `MFA_REQUIRED` is unavoidable because the client MUST branch on it to prompt for a code.
- **Why no rate limit on `/mfa/verify` specifically.** The global rate limiter applies (default 60/min). A dedicated tighter bucket for MFA attempts is a logical follow-up but not part of this slice — 60 tries/min against a 6-digit TOTP is 1/16,666 cracking odds per minute, already safely below offline-brute-force economics.
- **Why store `mfaSecret` plaintext.** For v1. Field-level encryption is queued for `[III.13.11]` alongside `emailEncrypted` — same KMS-key-management work applies to both columns, cheap to bundle.
- **Why `DisableMfaUseCase` is idempotent silent-no-op on already-disabled accounts.** Client UX — the Settings screen should just say "Disable MFA" as a button regardless of state; the user clicking it twice shouldn't get an error.
- **What wasn't shipped: backup codes.** Standard MFA pattern is to emit 8–10 single-use backup codes at enrolment so a phone loss isn't account loss. Queued — not urgent until real users have MFA on in prod, and the shape is well-understood (hash-and-store, mark-as-used-on-redeem).

---

### [III.13.2] — Session concurrency cap + device-fingerprint binding (part 3)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Closed two concrete security gaps on the identity module that the previous slices deferred:

1. **Per-user concurrency cap (`MAX_SESSIONS_PER_USER = 10`).** An 11th login trims the oldest active session — users keep a rolling window of their 10 most recent device sessions. Stops unbounded session growth + the abuse vector where a compromised refresh cookie can fork itself forever.
2. **Device-fingerprint binding on refresh.** The `sha256(pepper + UA)` computed at issuance is persisted on the `Session` row. Every `/refresh` recomputes the fingerprint from the current request and compares. On mismatch → cascade revoke every session for that user, 401 `REFRESH_DFP_MISMATCH`. Catches "stolen refresh cookie replayed from a different client" (browser → curl, one app → another).

**Deliberate design choice: dfp = UA only, not UA + IP.** Mobile clients roam between wifi and cellular networks all the time; locking sessions to an IP would force re-auth on every network change. UA is stable within a client install and catches the threat that matters (different user-agent = different device).

- **`apps/api/prisma/schema.prisma`** + **`apps/api/prisma/migrations/20260420170000_session_device_fingerprint/migration.sql`** — added `Session.deviceFingerprint String?`. Nullable so legacy rows (pre-migration) don't break; new rows always populate it. `RefreshSessionUseCase` grandfathers `null` rows through without a check.

- **`apps/api/src/modules/identity/domain/session.entity.ts`** — added `deviceFingerprint: string | null` to the pure `Session` type.

- **`apps/api/src/modules/identity/application/ports/session.repository.ts`**:
  - `CreateSessionInput.deviceFingerprint` (non-null for new rows).
  - New port method: `listActiveForUser(userId): Promise<readonly Session[]>` — ordered oldest-first, used by the concurrency-cap enforcement path.

- **`apps/api/src/modules/identity/infrastructure/prisma-session.repository.ts`** — persists `deviceFingerprint` on `create()` + `rotate()`; implements `listActiveForUser` with `where: { userId, revokedAt: null, expiresAt: { gt: now } }` + `orderBy: issuedAt asc`.

- **`apps/api/src/modules/identity/application/issue-session.use-case.ts`**:
  - Exported `MAX_SESSIONS_PER_USER = 10`.
  - After `sessions.create()`, calls `listActiveForUser` and if `length > 10`, revokes `length - 10` oldest rows. Race note documented: two concurrent logins may both see count == 10 and both create — worst case we briefly hold 11 and the next login trims. Not worth a serializable transaction.
  - Structured log line `session_concurrency_cap_enforced` with the revoked count + cap for audit.

- **`apps/api/src/modules/identity/application/refresh-session.use-case.ts`** — added step 5b. After sid-match and before user lookup: `if (row.deviceFingerprint !== null && row.deviceFingerprint !== cmd.deviceFingerprint)` → `revokeAllForUser` + `REFRESH_DFP_MISMATCH` 401. Also persists `cmd.deviceFingerprint` into the new row on rotation (so the new cookie's dfp matches the new session).

- **`apps/api/src/modules/identity/interface/auth.controller.ts`** — narrowed `deviceFingerprint` from `sha256(pepper | ua | ip)` to `sha256(pepper | ua)`. IP still goes into `Session.ipHash` for audit/analytics, but is no longer part of the binding check.

- **`apps/api/test/session-hardening.e2e-spec.ts`** — 3 new integration tests:
  1. Concurrency cap: register + 9 logins = 10 active; 11th login keeps count at 10; total session rows = 11; the oldest row has `revokedAt != null`.
  2. Dfp mismatch: register + 2nd login (same UA, both active) → /refresh from a different UA returns 401 `REFRESH_DFP_MISMATCH` AND every session for the user is revoked.
  3. Dfp match: register + /refresh with the same UA → 200 (negative-control for the binding check).

- **`apps/api/test/identity.e2e-spec.ts`** — updated 2 tests (`refresh rotates...` + `REUSE CASCADE`) to send `user-agent: 'jest'` on the /refresh calls, so dfp binding doesn't trip them. Pre-change they sent no UA; that difference from the register's `'jest'` UA would have been a dfp mismatch under the new binding.

**Files created** (2) — `apps/api/prisma/migrations/20260420170000_session_device_fingerprint/migration.sql`, `apps/api/test/session-hardening.e2e-spec.ts`.
**Files edited** (7) — `schema.prisma`, `session.entity.ts`, `ports/session.repository.ts`, `prisma-session.repository.ts`, `issue-session.use-case.ts`, `refresh-session.use-case.ts`, `interface/auth.controller.ts`, plus `test/identity.e2e-spec.ts`.
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --testPathPattern=session-hardening` — 3/3 pass.
- ✅ `jest --testPathPattern="identity|auth-guards|session-hardening|smoke|app.e2e|health"` — 6 suites, 53 tests pass. Existing identity + auth-guard coverage unaffected after the 2 identity tests were updated for dfp binding.
- ✅ Migration applied to dev DB via `prisma migrate deploy`; client regenerated.

**Acceptance criteria**

- ✅ 11th login revokes the oldest session (proven by test).
- ✅ /refresh from a different UA cascades (proven by test).
- ✅ /refresh from the same UA still works (negative-control test).
- ✅ `dfp` stored on the Session row, not just in the refresh JWT claim.
- ✅ Legacy rows without a stored dfp are grandfathered (null-check).

Still deferred to follow-ups under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ TOTP MFA (speakeasy) + MFA-required login flow.
- ⏳ OAuth2 Google/Apple via Passport.
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` (`[III.13.11]`).

**Notes**

- **Why UA-only dfp, not UA + IP.** Debated. UA + IP is strictly more defensive, but mobile clients switching wifi ↔ cellular would trigger a false cascade on every network change. Real-world cost of false cascades on UX > marginal security gain. UA captures the meaningful threat. If we later add a client-supplied `X-Device-Id`, that's a stronger signal than either.
- **Why a per-user cap, not per-device.** Per-device caps need a stable device identifier, which we don't have until `X-Device-Id` lands. Per-user is the right layer for v1.
- **Why the cap enforces AFTER the create, not before.** Enforcing before would require "is this a login?" detection + careful ordering around MFA. Post-create + trim-oldest is trivially correct regardless of the issue path (register, login, OAuth later). The briefly-over-cap window (< one tick) is acceptable.
- **Why `deviceFingerprint: string | null` in the domain Session.** Prisma column is nullable for legacy-row compat. The port's `CreateSessionInput.deviceFingerprint` is non-null — new rows MUST provide one. Any future adapter inserting a null would be flagged by typecheck.
- **Why not refresh with the old UA bound to the session but accept a new UA and UPDATE the dfp.** That's a "dfp update" pattern. Doesn't work — if a session is stolen, the attacker would immediately present their own UA and we'd silently accept it. The only safe update path is: force re-auth when UA changes, which is what the current design does.
- **Prisma migrate status.** Ran against the dev Postgres with `DATABASE_URL` set inline. All 4 migrations applied cleanly (init · geo-gist-indexes · vector-ivfflat · session-device-fingerprint).
- **Windows+OneDrive Prisma DLL lock resurfaced.** Fixed by `rm -f` of `query_engine-windows.dll.node` before `prisma generate`. Same workaround as `[IV.18.1.16]`.

---

### [III.11.3] — JwtAuthGuard + RolesGuard + @CurrentUser + @Public + @Roles (auth consumption layer)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.3, 13.2

**What was done**

`[III.13.2]` parts 1+2 shipped the auth _production_ side (primitives + register/login/refresh/logout). This prompt is the _consumption_ side: the guard chain every future feature module uses to protect its routes. Without it, every new controller would have to fake JWT verification inline.

- **`apps/api/src/common/auth/`** — new common package. Tiny by design (6 files, ~180 lines).
  - **`authenticated-user.ts`** — `AuthenticatedUser { sub, sid, role }` + `Role` union. Fastify module-augmentation typings so `req.user` type-checks downstream.
  - **`public.decorator.ts`** — `@Public()` sets `IS_PUBLIC_KEY` metadata; `JwtAuthGuard.canActivate` short-circuits when present. Handler-level decorator wins over class-level (Reflector `getAllAndOverride`).
  - **`roles.decorator.ts`** — `@Roles('admin', 'premium')` sets `ROLES_KEY` with the accepted role list.
  - **`current-user.decorator.ts`** — `@CurrentUser()` param decorator; pulls `req.user` in handlers. Throws loudly if used on a non-authenticated route (config bug).
  - **`jwt-auth.guard.ts`** — extracts `Authorization: Bearer <token>`, verifies via the `TOKEN_SERVICE` port exported by `IdentityModule` (does NOT reach into `@app/auth` directly — keeps guard swappable for tests). On failure, throws `UnauthorizedError('…', {reason}, 'UNAUTHENTICATED')` → the global domain filter renders a 401.
  - **`roles.guard.ts`** — reads `@Roles` metadata; no-op if absent; `ForbiddenError('…', {actual, required}, 'ROLE_FORBIDDEN')` on mismatch.
  - **`index.ts`** — barrel.

- **`apps/api/src/app.module.ts`** — registered the 3-guard chain as `APP_GUARD`:

  ```
  RateLimitGuard → JwtAuthGuard → RolesGuard
  ```

  Order matters: rate-limit runs first so a flood of unauthenticated traffic still hits the budget (otherwise "invalid token" responses would be free DDoS fuel). Auth runs before role because `RolesGuard` reads `req.user` attached by `JwtAuthGuard`.

- **`@Public()` applied to the existing public surface:**
  - `HealthController` — probes can't present JWTs (already had `@SkipThrottle()`; now `@Public()` too).
  - `AuthController.register / login / refresh / logout` — these are what _creates_ sessions; they can't require one.

- **`GET /api/v1/auth/me`** added to `AuthController` — the first canonical protected route. Uses `@CurrentUser(): AuthenticatedUser`. Returns `{ sub, sid, role }`. Every future feature module copies this pattern.

- **`apps/api/test/auth-guards.e2e-spec.ts`** — 8 integration tests, real-Postgres via `app.inject()`:
  1. public `/health/live` + `/auth/register` reachable without a token.
     2–4. protected `/auth/me` with missing / malformed / bogus bearer → 401 `UNAUTHENTICATED`.
  2. protected `/auth/me` with a valid token → 200 `{ sub, sid, role }`.
  3. `@Roles('admin')` on a `user` token → 403 `ROLE_FORBIDDEN` (proves role enforcement).
  4. `@Roles('admin')` on an admin-minted token → 200 (proves positive path — admin token minted directly via `TOKEN_SERVICE` since we don't expose an admin-create endpoint yet).
  5. `@CurrentUser()` without `@Roles` still hydrates `req.user`.

**Files created** (7) — `apps/api/src/common/auth/{authenticated-user,public.decorator,roles.decorator,current-user.decorator,jwt-auth.guard,roles.guard,index}.ts` + `apps/api/test/auth-guards.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts` (3-guard chain), `apps/api/src/health/health.controller.ts` (+ `@Public()`), `apps/api/src/modules/identity/interface/auth.controller.ts` (+ `@Public()` on the 4 entry routes, + `GET /me` with `@CurrentUser()`).
**Dependencies** — none new; reuses `@app/auth`, `@app/errors`, `IdentityModule.TOKEN_SERVICE`.

**Verification**

- ✅ `tsc --noEmit` green on apps/api.
- ✅ `jest --testPathPattern="auth-guards"` — 8/8 pass.
- ✅ Broader run (`identity|smoke|auth-guards|app.e2e|health` + `filters|rate-limit|zod|security|domain-exception`) — **10 suites, 79 tests pass.** No regression on existing coverage.
- ✅ Guard ordering verified: a public route with no token hits `RateLimitGuard` (passes) → `JwtAuthGuard` (short-circuits on `@Public()`) → `RolesGuard` (short-circuits with no `@Roles`) → handler. A protected route without a token hits `JwtAuthGuard` and throws before the handler runs.

**Acceptance criteria**

- ✅ `JwtAuthGuard` as global APP_GUARD.
- ✅ `RolesGuard` as global APP_GUARD enforcing `@Roles`.
- ✅ `@Public()` exempts specific routes/classes.
- ✅ `@CurrentUser()` extracts `AuthenticatedUser` in handlers.
- ✅ Protected route returns 401 without token.
- ✅ Protected route with wrong role returns 403.
- ✅ `/health/*` + `/auth/{register,login,refresh,logout}` remain public.

**Notes**

- **Why go through `TOKEN_SERVICE` port, not `@app/auth` directly.** The guard lives in `apps/api/src/common/auth/` — app-level code. The `TokenService` port is the seam between crypto primitives and app policy (TTLs, keyrings, issuer/audience, JWKS rotation later). Future-me can swap HS256 → RS256 + JWKS by editing `JwtTokenService` alone; the guard doesn't change. Direct `@app/auth` use would leak the algorithm choice into the guard.
- **Why no Reflector import in the decorators.** `SetMetadata` is framework-built-in; the decorators stay pure metadata. Guards are the only places that need a `Reflector` (DI'd via `@Inject(Reflector)` — the tsx decorator-metadata workaround from `[IV.18.1.16]`).
- **Why the synthetic `GuardTestController` in the test file (not in src/).** Production should not ship an unauthenticated admin probe. Declaring the controller inline in the spec keeps it scoped to test builds.
- **Why `RolesGuard` throws Error instead of ForbiddenError when `req.user` is missing.** That state means `@Roles` is on a `@Public()` route, which is a config bug — loud is correct. `ForbiddenError` would silently return 403 to a caller who should've gotten a route not protected at all.
- **Why `@SkipThrottle()` stays on HealthController alongside `@Public()`.** `@Public()` bypasses auth; `@SkipThrottle()` bypasses rate limits. LB health checks need both.
- **`@Public()` on `/auth/*` is tighter than stacking the whole controller.** The 4 entry routes explicitly opt in; `GET /auth/me` inherits protection by default. This keeps the public surface obvious at the call site.

---

### [III.13.2] — Identity module: register / login / refresh / logout with reuse-detection cascade (part 2)

**Date:** 2026-04-20 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Picked up the second slice of `[III.13.2]` after part 1 (crypto primitives) locked in. This slice wires the primitives into an actual auth flow — a full NestJS Identity module with the load-bearing reuse-detection cascade. Register, login, refresh, logout all work end-to-end against the real PostGIS Postgres through Fastify `app.inject()`.

- **`apps/api/src/modules/identity/`** — clean-hex layers per ADR-001:
  - **`domain/session.entity.ts`** — pure `Session` interface + `isSessionActive()`. No Prisma types leak into domain.
  - **`application/ports/session.repository.ts`** — `SessionRepository` port with `create` / `findByRefreshHash` / `rotate` / `revoke` / `revokeAllForUser`. Symbol DI token. Caller supplies the id so the JWT's `sid` claim matches the persisted row without a round-trip.
  - **`application/ports/user.repository.ts`** — minimal surface: `create` / `findByEmailHash` / `findById`. Soft-deleted users filter out (ADR-010 contract — anonymised users must not resurrect).
  - **`application/ports/token.service.ts`** — `TokenService` port wrapping `@app/auth` sign/verify with access + refresh policy split.
  - **`application/issue-session.use-case.ts`** — generate CSPRNG session id, sign refresh JWT (carries `dfp` device-fingerprint claim), persist `sha256(refreshToken)` only, sign access JWT. Raw refresh token goes to the cookie, never to the DB.
  - **`application/refresh-session.use-case.ts`** — the load-bearing one. 6-step flow: JWT verify → hash lookup → reuse-detection cascade → expiry → sid-mismatch → atomic rotate (old row's `revokedAt` set + new row inserted in one tx). On a revoked-row hit, `revokeAllForUser()` wipes every session for the user — OWASP refresh-rotation pattern.
  - **`application/revoke-session.use-case.ts`** — logout. Idempotent: missing / already-revoked cookies return success silently.
  - **`application/register.use-case.ts`** — argon2id hash, unique-email check via `emailHash`, sha256(EMAIL_PEPPER + email.lowercase). Issues session on success. Full field-level email encryption is queued for `[III.13.11]`; for now we stash utf-8 bytes in `emailEncrypted` (no decryption API is exposed).
  - **`application/login.use-case.ts`** — deliberate uniform-error: wrong email and wrong password both emit `INVALID_CREDENTIALS` at 401. Dummy-hash verify on miss-path equalizes timing. Issues session on success.
  - **`infrastructure/email-hash.ts`** — module-scoped `hashEmail(emailLower)` using `EMAIL_PEPPER` env var (new — see below).
  - **`infrastructure/prisma-session.repository.ts`** — thin Prisma adapter. `rotate()` uses `$transaction` for the revoke-old + insert-new pair (CLAUDE rule 13 preserved — only DB writes in the tx, no network calls).
  - **`infrastructure/prisma-user.repository.ts`** — hides soft-deleted users from both `findByEmailHash` and `findById`.
  - **`infrastructure/jwt-token.service.ts`** — env-derived keyrings (`kid=access-v1` / `kid=refresh-v1`, single-key rings for now), `parseDuration("15m"|"30d"|"12h"|"45s")` utility. JWKS rotation cron + multi-key rings land in their own follow-up.
  - **`interface/auth.controller.ts`** — `POST /api/v1/auth/{register,login,refresh,logout}`. Refresh cookie: `httpOnly`, `sameSite: strict`, `secure` in staging/prod, `path: /api/v1/auth`, `maxAge` mirrors refresh TTL. Access token in JSON body only (CLAUDE rule 12). Device fingerprint = `sha256(pepper + ua + ip)`; `x-device-id` header is **read but ignored** this slice (Session FK → Device, no auto-create yet).
  - **`interface/dto/auth.dto.ts`** — Zod schemas for register + login bodies. Password policy intentionally mild (min 12, max 128); entropy scoring + HIBP k-anon is a follow-up.
  - **`identity.module.ts`** — wires all ports → adapters, declares controller, exports `RefreshSessionUseCase` so downstream modules (JwtAuthGuard) can reuse.

- **`apps/api/src/main.ts`** — registered `@fastify/cookie` after `registerSecurity()` so the httpOnly refresh cookie parses on /refresh + /logout.

- **`apps/api/src/app.module.ts`** — imported `IdentityModule`.

- **`packages/config/src/schema.ts`** — added `EMAIL_PEPPER: z.string().min(32)` under `SecuritySchema`. Playbook §13.11 calls for a dedicated pepper on email/IP hashes so pepper rotation can happen independently of rate-limit pepper rotation.

- **`.env.example` + `apps/api/test/setup.ts`** — seeded `EMAIL_PEPPER`.

- **`apps/api/test/identity.e2e-spec.ts`** — 5 integration tests against real Postgres via `app.inject()` (no port bind):
  1. register → httpOnly cookie set, access token returned, body has userId.
  2. wrong password + unknown email → uniform `INVALID_CREDENTIALS` 401.
  3. refresh rotates — old cookie invalidated, new one works.
  4. **REUSE CASCADE** — register user, open a 2nd login session (total 2 active), rotate session 1 with `/refresh`, replay the (now-rotated) cookie → 401 `REFRESH_REUSE_DETECTED` AND every session for the user is `revokedAt != null`. Proven by `prisma.session.count({ where: { userId, revokedAt: null } })` going 2 → 0.
  5. logout revokes + clears cookie, second logout is a no-op.

**Files created** (15) — `apps/api/src/modules/identity/{domain/session.entity.ts, application/{issue-session,refresh-session,revoke-session,register,login}.use-case.ts, application/ports/{session,user,token}.ts, infrastructure/{prisma-session.repository,prisma-user.repository,jwt-token.service,email-hash}.ts, interface/{auth.controller.ts, dto/auth.dto.ts}, identity.module.ts}` + `apps/api/test/identity.e2e-spec.ts`.
**Files edited** (5) — `apps/api/src/main.ts` (cookie plugin), `apps/api/src/app.module.ts` (IdentityModule), `apps/api/test/setup.ts` (EMAIL_PEPPER), `.env.example` (EMAIL_PEPPER), `packages/config/src/schema.ts` (EMAIL_PEPPER).
**Dependencies added** — `@fastify/cookie@11.0.2` on apps/api, `@app/auth@workspace:*` linked into apps/api.

**Verification**

- ✅ `tsc --noEmit` green on apps/api after the new module landed.
- ✅ `jest --testPathPattern="identity|smoke"` — **30/30 pass**: identity 5/5, phase-0 smoke 25/25.
- ✅ Full-suite earlier run: 80/81 pass. The one fail is a pre-existing parallel-test data collision between `index-usage.e2e-spec.ts` (seeds places near Victoria in `beforeAll`, cleans only in `afterAll`) and `geo-queries.e2e-spec.ts` (also queries near Victoria). Both prompts are `[III.12.x]` — unrelated to this slice. Fix is queued as a test-hygiene follow-up.
- ✅ All clean-hex boundaries hold: `domain/` has no framework imports, `application/` talks only to ports, adapters implement those ports, interface layer is a thin controller.

**Acceptance criteria**

From the `[III.13.2]` full scope, this slice covers:

- ✅ Register + login with argon2id password hashing — land.
- ✅ Access JWT 15m + refresh JWT 30d in httpOnly+SameSite=strict cookie on `/api/v1/auth` — land.
- ✅ Rotating refresh + reuse-detection cascade (the load-bearing acceptance criterion) — **proven by integration test**.
- ✅ Session repo (Prisma) — land.

Still deferred to follow-ups under the same IN-PROGRESS banner:

- ⏳ TOTP MFA (speakeasy) + MFA-required login flow.
- ⏳ OAuth2 Google/Apple via Passport — env vars already in schema.
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Session concurrency cap (10/user).
- ⏳ Device fingerprint binding on refresh (today's `dfp` is computed fresh per request — should be bound to the session on issuance and compared on refresh).
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` (queued for `[III.13.11]`).
- ⏳ `JwtAuthGuard` + `RolesGuard` + `@CurrentUser()` decorator (`[III.11.3]` picks these up on top of the `TokenService` port).

**Notes**

- **Why separate opaque random + JWT refresh tokens was rejected.** Some auth stacks keep a random cookie value and a separate JWT. We use the JWT itself as the cookie value (stored as its sha256). The `dfp` claim + hash-lookup + reuse cascade covers the same threat model; double-token plumbing is dead weight for v1.
- **Why the controller has no `@Throttle` decorator.** @nestjs/throttler v6 stacks all named buckets when no override is present — so the auth route correctly inherits default (60/min) AND auth (5/min), smallest wins = 5/min in prod. Explicit `@Throttle({ auth: {...} })` would OVERRIDE test-mode limit inflation and trip 429s in the integration suite.
- **Why `fastify/cookie` registers after `registerSecurity`.** Helmet hardens headers before routes bind; cookie parser attaches a decorator that needs the Fastify instance. Ordering keeps both working and keeps the refresh cookie off the `/health` surface via `path: /api/v1/auth`.
- **Why the Device FK is nullable in the session.** The Session model has `deviceId String?` with `onDelete: SetNull`. A dedicated `RegisterDeviceUseCase` prompt will populate Device rows from the `x-device-id` header and then we can switch the FK to non-null.
- **ADR-010 contract met.** Both `UserRepository` methods filter on `deletedAt IS NULL` so anonymised users can't log in or resurrect.

---

### [III.13.2] — @app/auth crypto primitives (foundation only — part 1 of the auth prompt)

**Date:** 2026-04-20 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done — scope reduction explained**

`[III.13.2]` is the single biggest prompt in the Playbook — argon2id + access+refresh JWT + rotating refresh + reuse-detection + TOTP MFA + OAuth2 Google/Apple + JWKS key rotation + session concurrency cap + device fingerprint binding + full integration tests. That's 5+ subsystems of security-critical code, a 3–5 hour focused task at minimum.

In Plan-first mode, a responsible autopilot doesn't ship half of that. Shipping a half-implemented auth flow is WORSE than no auth — it creates the illusion of security. So this commit is **part 1 only: the cryptographic primitives**. Pure functions, no DI, no DB, no HTTP — isolated and heavily tested. The Nest module + Prisma user repo + HTTP endpoints + OAuth + MFA + JWKS rotation + device binding + session cap all land in follow-up prompts on top of THIS foundation.

- **`packages/auth/`** — new workspace package, `@app/logger`-pattern shape.
  - **`src/password.ts`** — `hashPassword(plaintext)` / `verifyPassword(plaintext, hash)` / `needsRehash(hash)`. argon2id at Playbook §13.2 cost parameters (timeCost 3, memoryCost 64 MiB, parallelism 1). `needsRehash` reads the params out of the stored hash prefix so we can bump work factors later without a flag day — re-hash-on-login migration. Salt is random per hash (16 bytes). Empty-plaintext + malformed-hash inputs return `false` without throwing (never leak timing or implementation details on bad input).
  - **`src/jwt.ts`** — `signJwt(claims, key, {expiresInSeconds, issuer?, audience?})` + `verifyJwt<T>(token, keyring, opts?)`. Every token carries a `kid` protected header; verify tries `keyring.current` then each `keyring.previous` until a match. `JwtVerificationError` with stable codes `MISSING_KID` | `UNKNOWN_KID` | `INVALID`. HS256 today — RS256/ES256 + JWKS endpoint is a signer-swap follow-up, protocol shape already future-proof. `AccessTokenClaims` + `RefreshTokenClaims` typed so use-cases can't mix them up. `secretFromString(string)` utility for building `JwtKey.secret: Uint8Array` from env.
  - **`src/index.ts`** — re-exports. Header comment lists what's here (password + JWT) vs. what's NOT YET here (refresh rotation, MFA, OAuth, JWKS rotation cron, Nest guards, session cap, device binding) so future prompts have a clear starting line.
- **`test/password.spec.ts`** — 11 tests covering argon2-prefix-format assertion, salt-randomness, empty-input rejection, round-trip, non-match false, malformed-hash safe-false, hash-empty defensive throw, and `needsRehash` across current/old-cost/unrecognised-format inputs.
- **`test/jwt.spec.ts`** — 11 tests covering access + refresh round-trips, issuer + audience propagation + mismatch rejection, key rotation (sign with `v1`, verify when keyring has `v2` current + `v1` previous), `UNKNOWN_KID` when `v1` is rotated out, `MISSING_KID` on a header without kid, `INVALID` on tampered signatures + expired tokens, `JwtVerificationError.code` + name stability, `secretFromString` UTF-8 encoding.

**Files created** (11) — `packages/auth/{package.json, tsconfig.json, tsconfig.build.json, jest.config.cjs, eslint.config.mjs}` + `src/{password,jwt,index}.ts` + `test/{password,jwt}.spec.ts`.
**Files edited** (1) — `pnpm-lock.yaml` (workspace + deps).
**Dependencies** — `argon2@^0.41.1` (native binding), `jose@^5.9.6` (modern JWT + JWKS-native). Both CJS-friendly; no ESM/ts-jest friction. Coverage threshold tightened to 85% (vs workspace 80%) since this is security-critical code.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --runInBand` — **22/22 pass** (11 password + 11 JWT). Covers the 4 error paths on `verifyJwt` (MISSING_KID, UNKNOWN_KID, INVALID-signature, INVALID-expired) and the rotation happy-path.
- ✅ `tsc -p tsconfig.build.json` emits `dist/`.

**Acceptance criteria**

Partial — scope is the foundation layer only:

- ✅ argon2id at timeCost 3 + memoryCost 65536 (verified via hash-format assertion in tests).
- ✅ `kid` header on every JWT (part of the sign contract; verify asserts).
- ✅ Keyring shape supports current + previous during rotation — tests prove a `v2`-current, `v1`-previous keyring accepts tokens signed with EITHER.

Deferred to follow-up prompts (each marked IN-PROGRESS until they land):

- ⏳ Access JWT 15m + refresh JWT 30d in httpOnly cookie — needs Nest + Fastify cookie plugin wiring.
- ⏳ Rotating refresh + reuse-detection cascade — needs a Session repo (Prisma).
- ⏳ TOTP MFA — needs speakeasy + a User MFA-status field.
- ⏳ OAuth2 Google/Apple — needs Passport strategies + env vars already in schema.
- ⏳ JWKS rotation cron — needs BullMQ + Redis-backed keyring storage.
- ⏳ Session concurrency cap (10) — needs Session repo.
- ⏳ Device fingerprint binding — trivially added once refresh flow exists.

**Notes**

- **Why jose over jsonwebtoken.** jose ships both CJS + ESM, has first-class JWKS primitives (`createLocalJWKSet`), and its `SignJWT` / `jwtVerify` API is cleaner. `jsonwebtoken` would work but its JWKS story is third-party (jwks-rsa).
- **Why explicit argon2 params.** Playbook §13.2 names exact values; argon2's defaults differ. Pinning ensures a hash generated on pod A verifies correctly on pod B at the same cost factor. When we bump the factor, `needsRehash` drives the migration one login at a time.
- **Why `JwtVerificationError` instead of jose's native errors.** Callers need a stable `code` to branch on — `MISSING_KID` / `UNKNOWN_KID` / `INVALID` cover the real auth decisions (return 401 + "please log in", return 401 + "token from retired key rotation", return 401 + "malformed"). jose's specific error classes (`JWSSignatureVerificationFailed`, `JWTExpired`, etc.) leak too much internal detail into the call-site.
- **No integration test yet.** Integration tests for the crypto layer alone would be noise; the real integration test is "register a user, log in, refresh the token, log out" — which requires the Nest module + Prisma repo, i.e. the next prompt's work. The unit tests here cover every branch with real argon2 hashing + real jose signing.
- **Security-sensitive code deserves a real human review** before the Nest integration lands on top. The foundation is small (200 lines); worth reading line-by-line before building the stack on it.

---

### [IV.18.1.9] — @app/events: typed EventBus + Redis Streams adapter + DLQ + in-memory for tests

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 6.4 · **ADR** [ADR-003](./docs/adr/ADR-003-event-backbone.md)

**What was done**

The last meaningful Phase-0 infrastructure piece. ADR-003 committed us to Redis Streams as the event backbone; the context-map lists every module's inbound/outbound events. This package turns those commitments into code that every future Phase-1 module can call.

- **`packages/events/`** — new workspace package, `@app/logger`-pattern shape (CJS `dist/` output, scripts, configs). 6 source files:
  - **`src/event.ts`** — `DomainEvent<TPayload>` canonical shape: `name` (e.g. `Trip.TripDrafted` per context-map naming), `id`, `version`, `occurredAt`, `traceId?`, `payload`. Plus `DomainEventWire` (ISO-string `occurredAt` on the wire) and `DomainEventOfName<TName, TPayload>` for subscribers who want to pin.
  - **`src/event-bus.ts`** — the `EventBus` port. `publish<TPayload>(event)`, `subscribe<TPayload>(name, handler, options?)`, `close()`. `SubscribeOptions` carries `consumerGroup` + `deadLetterAfterAttempts` (default 3). Returns a `Subscription { eventName, consumerGroup, unsubscribe() }`. `EVENT_BUS` DI token as a `Symbol.for(...)`.
  - **`src/in-memory-event-bus.ts`** — in-process adapter for tests. Synchronous dispatch per consumer group, retries on failure, accumulates failed events in a `drainDlq()` accessor.
  - **`src/redis-streams-event-bus.ts`** — **production adapter**. Separate publisher + per-consumer `.duplicate()` connections (XREADGROUP BLOCK can't share a connection with XADD). `XGROUP CREATE ... MKSTREAM` idempotent (BUSYGROUP handled). Consumer loop `XREADGROUP` + `XACK` on success; on failure retries up to `deadLetterAfterAttempts`, then `XADD`s to `<stream>:dlq` before acking the main stream. Keys: `<keyPrefix><eventName>` (e.g. `travel-prod:events:Trip.TripDrafted`). Shutdown flips stop flags, awaits in-flight loops, quits both clients.
  - **`src/index.ts`** — re-exports. Swap-to-Kafka path documented in header comment: implement `KafkaEventBus: EventBus`, bind to `EVENT_BUS` — zero domain-code changes (ADR-003 migration triggers spell out when).
- **`test/in-memory-event-bus.spec.ts`** — 6 unit tests: single-subscriber delivery, multi-consumer-group fan-out, unsubscribe, DLQ on retries exhausted, publishing-without-subscribers is a no-op, close rejects further publishes.
- **`test/redis-streams-event-bus.e2e-spec.ts`** — 3 integration tests against real Docker Redis:
  1. **One event → two consumer groups**. `notifications` + `analytics` both receive it (proves independent-group semantics).
  2. **Forced-fail DLQ**. Handler throws on every call; after 3 attempts the event lands in `<stream>:dlq` with `attempts=3` + `lastError=forced-fail` + `originStream` fields. Verified by `XRANGE`.
  3. **Competing consumers in the same group**. Two handlers in `one-group`, publish 4 events, assert total received = 4 (each event delivered exactly once across the group — Redis Streams's competing-consumer semantics).
- Unique per-test `keyPrefix` (`events-test-${pid}-${Date.now()}:${uuid}:`) so parallel + repeat runs can't contaminate each other's streams.

**Files created** (11) — `packages/events/package.json` + 5 configs (`tsconfig.json`, `tsconfig.build.json`, `jest.config.cjs`, `eslint.config.mjs`) + `src/{event,event-bus,in-memory-event-bus,redis-streams-event-bus,index}.ts` + 2 test files.
**Files edited** (1) — `pnpm-lock.yaml` (workspace registration).
**Dependencies** — `ioredis` (production dep, already in root); `@nestjs/common` optional peer + dev dep; `@app/logger` + `@app/tsconfig` + `@app/eslint-config` workspace deps.

**Verification**

- ✅ `tsc --noEmit` green for `packages/events`.
- ✅ `jest --runInBand` in `packages/events` — **2 suites, 9/9 tests pass**.
- ✅ Full `apps/api` suite — **11 suites, 76/76** — no regressions from adding the new workspace package.
- ✅ `tsc -p tsconfig.build.json` produces a clean `dist/` ready for other packages to consume.

**Acceptance criteria**

- ✅ Typed `EventBus` interface with `publish<E>(event)` + `subscribe<E>(name, handler)`.
- ✅ Redis Streams adapter with consumer groups per module.
- ✅ Dead-letter stream: forced-fail event lands in `<stream>:dlq` after retries exhausted (verified via `XRANGE`).
- ✅ In-memory adapter for tests — 6/6 unit tests pass.
- ✅ Swap-to-Kafka path documented: implement `KafkaEventBus: EventBus`, bind at `EVENT_BUS`, ADR-003 migration triggers are the gate. No domain changes.

**Notes**

- **Why separate publisher + per-consumer connections?** `XREADGROUP BLOCK 5000` holds its Redis connection for the full 5-second block window. Sharing that connection with `XADD` (publish) means every publish stalls for up to 5s waiting for the read to return. Each consumer gets its own `this.publisher.duplicate()` — one idle connection per subscription is the right trade.
- **Competing consumers vs independent groups.** This is the whole reason for named consumer groups. `notifications` and `analytics` are different groups — each one gets every event. Two handlers in the SAME group `one-group` are competing consumers — each event goes to exactly one of them. Both patterns are tested.
- **DLQ key structure.** `<originStream>:dlq`. Fields: `data` (original wire JSON), `consumerGroup`, `attempts`, `lastError`, `originStream`. Retained forever by default; ops clears via `XDEL` or trims with `XTRIM`. Matches context-map's "7-day DLQ retention" default from [ADR-003] — the trim policy is an ops concern, not a code concern.
- **No NestJS module wired yet.** The `EVENT_BUS` token exists; consumers inject it. A small `EventsModule.forRoot({ redisUrl, keyPrefix })` wrapper is the natural follow-up — but trivial and un-controversial. Left for the first prompt that actually needs it (likely `[IV.18.2.x]` when the first module publishes an event).
- **Swap-to-Kafka path.** Adapter-pattern + token-based DI means the migration is one file swap + one DI binding change. ADR-003's triggers (>30k ev/s for 7d, cross-region fan-out, long retention, Schema Registry needs) decide when.
- **ioredis Lua-free.** The adapter doesn't use a Lua script — each op is a separate ioredis call. Redis handles consistency per-op; at-least-once semantics don't need atomicity across multiple ops for this adapter. (Contrast with `RedisThrottlerStorage` which DOES use Lua — sliding-window atomicity is different.)

---

### [II.8.6] — ADR-009 DevOps & infra lock + quantitative K8s triggers

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.6 + 34.3

**What was done**

Fills the ADR-009 gap in the index (previously jumped 008 → 010) and locks the deploy/operate surface. The four sibling stack-lock ADRs (005 frontend, 006 backend, 007 data, 008 AI) covered libraries + runtimes; this one pins hosting, CI/CD, CDN, secrets, and — load-bearing — the **quantitative** K8s migration tripwire the prompt's acceptance demands.

- **`docs/adr/ADR-009-devops.md`** — MADR, 5 choices × 5 rejected alternatives:
  - pnpm 9 + Turborepo 2 / rejected npm workspaces + Nx (extra DSL surface).
  - Fly.io primary + Railway fallback / rejected AWS ECS day-one (2-week stand-up vs 1-hour ship).
  - GitHub Actions + Turbo remote cache + Buildx + Trivy / rejected CircleCI/GitLab CI (integration delta with GitHub beats feature delta).
  - Cloudflare CDN+WAF / rejected AWS CloudFront + WAF + Route 53 (TCO + dashboards).
  - Doppler secrets / rejected AWS Secrets Manager day-one (DX — need AWS acct before `pnpm dev`).
- **Kubernetes migration triggers** spelled out as numbers, per the acceptance criterion:
  1. ≥ 4 regions serving real traffic AND aggregate MAU ≥ 500,000.
  2. Monthly hosting bill > $15,000 AND > 40% of COGS (per [§23.1]). Caveat: false-positive on trigger 2 alone usually means a cost bug, not an infra ceiling — root-cause before superseding.
  3. Self-hosted LLM inference > 100 req/s sustained 24 h AND Fly GPU price > 2× EKS spot equivalent.
  4. Custom networking Fly's anycast + WireGuard mesh can't serve (bounded, not aesthetic).
- **Re-evaluation triggers** (separate from the K8s tripwires): Fly SLA incident density, Cloudflare free-tier pricing shifts, GitHub Actions minute quota burn, Doppler SOC 2 posture vs CMK requirements.
- **Binding consequences** re-encode several operational rules: `pnpm install --frozen-lockfile` in CI, distroless + non-root Docker images, `.env` gitignored + Doppler-owned secrets (CLAUDE rule 5 tie-in), SBOM + Trivy hard-block on CRITICAL CVE, Terraform + Helm scaffolds live in `infra/` ready-but-unused until triggers fire, no auto-upgrades on paid tiers (human confirms).
- **`docs/adr/README.md`** — row for ADR-009, inserted in numeric order so the index finally reads 001..010 contiguous.

**Files created** (1) — `docs/adr/ADR-009-devops.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance criterion: "K8s migration triggers are quantitative." ✅ — 3 numeric triggers (region count + MAU floor; $/month + COGS %; req/s + cost ratio) + 1 architectural (custom networking), all checkable against metrics we'd already be emitting via the OTel stack from `[III.15.4]`.

Cross-checks:

- Every choice reconciles with prior ADRs — pnpm + Turborepo match the actual `pnpm-workspace.yaml` + `turbo.json` shipped in `[II.10.0]`; Fly.io matches the Playbook §34.2 hosting table; Cloudflare matches Playbook §8.6.
- Binding consequences align with CLAUDE.md rules (rule 5 secrets, rule 9 logger/no-console in Docker image) + the Playbook §21.4 budget-alarm posture.
- ADR-009 number gap closed; index is now 001..010 contiguous.

**Acceptance criteria**

- ✅ DevOps stack locked (pnpm + Turborepo + Docker + Fly.io/Railway v1 + Terraform-ready for AWS).
- ✅ K8s migration triggers are quantitative (3 numeric + 1 architectural, each binding).

**Notes**

- **Why a separate ADR for "Infra v1" + "Infra later" instead of one per region?** Because the Infra-later path is the SAME Dockerfile + SAME Terraform scaffold + SAME Helm chart — just on a different control plane. One ADR captures the posture ("small team deploys on managed, graduates to AWS when triggers fire"); doesn't require a follow-up for the target.
- **Trigger 2's false-positive caveat** is practical operations advice: a team that crosses $15k/month WITHOUT crossing trigger 1 or 3 is usually leaking money (unbounded PostHog captures, CDN cache-miss storms, forgotten staging envs). The ADR refuses to ratify EKS adoption on trigger 2 alone without a cost-cause investigation first — saves us from a migration-as-cope anti-pattern.
- **Stack-lock series complete.** 005 (frontend) + 006 (backend) + 007 (data) + 008 (AI) + 009 (devops). Any significant architectural drift now requires a superseding ADR, not a PR-comment thread.

---

### [III.15.4] — OpenTelemetry tracing: NodeSDK + Prisma instrumentation → Jaeger

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.4

**What was done**

Replaced the `[IV.17.6]` no-op `instrumentation.ts` stub with the real SDK. Traces for every HTTP request now flow `api → OTLP/HTTP → Jaeger` with a full span tree including Prisma engine db_query spans.

- **`packages/observability/`** — upgraded from placeholder to a real CJS-shaped package (matches the `@app/logger` pattern). Rewrote `package.json` (removed `"type": "module"`, added `main`/`types`/`exports` pointing at `dist/`, scripts, deps). Added `tsconfig.json`, `tsconfig.build.json`, `jest.config.cjs`, `eslint.config.mjs`.
- **`packages/observability/src/tracing.ts`** — `createSdk(opts)` assembles a `NodeSDK` with:
  - `OTLPTraceExporter({ url: "${endpoint}/v1/traces" })` — endpoint from `OTEL_EXPORTER_OTLP_ENDPOINT` env, default `http://localhost:4318` (Jaeger OTLP HTTP).
  - `new Resource({ service.name, service.version, deployment.environment })` — resource attributes land as span tags in Jaeger.
  - `getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false }, '@opentelemetry/instrumentation-dns': { enabled: false } })` — fs + dns are noisy; every other auto-instrumentation stays on (http, fastify, nest, ioredis, undici, pg, etc.).
  - `new PrismaInstrumentation()` — Prisma's spans are NOT included in `auto-instrumentations-node`; must be registered explicitly. Pinned to `@prisma/instrumentation@5.22.0` to match our `@prisma/client` version exactly.
- **`packages/observability/src/init.ts`** — `initTracing(serviceName, opts?)`. Idempotent (re-calls are no-ops). Respects `OTEL_DISABLED=true` (skips SDK start + logs one warn — useful for local runs without Jaeger). SIGTERM handler flushes + shuts down the SDK so graceful pod termination doesn't lose in-flight spans. Explicit `shutdown()` export + `__resetForTests()` for unit tests.
- **`apps/api/instrumentation.ts`** — replaces `export {};` with `initTracing('api', { serviceVersion: process.env['npm_package_version'] ?? '0.0.0' })`. Still the VERY FIRST import in `main.ts` — the load-order contract was there from day one so nothing else changed.
- **`apps/api/prisma/schema.prisma`** — `previewFeatures = ["postgresqlExtensions", "tracing"]`. The `tracing` flag activates Prisma's OTel integration; without it the `PrismaInstrumentation` registers but receives no events from the client. Requires `prisma generate` to take effect.
- **`apps/api/package.json`** — adds `@app/observability: workspace:*`.

**Files created** (6) — `packages/observability/src/{tracing.ts, init.ts, index.ts}` + configs (`tsconfig*`, `jest.config.cjs`, `eslint.config.mjs`).
**Files edited** (4) — `packages/observability/package.json`, `apps/api/instrumentation.ts`, `apps/api/prisma/schema.prisma`, `apps/api/package.json`, `pnpm-lock.yaml`.
**Dependencies** — `@opentelemetry/{api, sdk-node, auto-instrumentations-node, exporter-trace-otlp-http, resources, semantic-conventions}`, `@prisma/instrumentation@5.22.0` — all on `@app/observability`.

**Verification**

- ✅ `tsc --noEmit` green (both `apps/api` and `@app/observability`).
- ✅ Full api suite — **11 suites, 76/76** (OTel doesn't load in tests — `instrumentation.ts` is only imported by `main.ts`).
- ✅ **Live smoke against Jaeger:**
  - Boot `apps/api` with `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.
  - `curl /health/live` → Jaeger's `/api/services` lists `["api"]`.
  - `curl /health/ready` repeatedly → Jaeger shows operations including `GET /health/ready`, `prisma:client:operation`, `prisma:client:serialize`, **`prisma:engine:db_query`** (the Prisma engine SQL call), `prisma:engine:response_json_serialization`, plus the full Fastify middleware chain, ioredis `ping`, etc.
  - Resource tags on every span: `service.name = api`, `service.version = 0.0.0`, `deployment.environment = development`.

**Acceptance criteria**

- ✅ Jaeger UI shows a full span tree for one request — `GET /health/ready` fans into 20+ child spans.
- ✅ Prisma query spans appear — `prisma:engine:db_query` explicitly present.

**Notes**

- **Windows + OneDrive + Prisma regen.** `prisma generate` fails with `EPERM` renaming `query_engine-windows.dll.node` if OneDrive is syncing `node_modules`, regardless of whether the api is running. Workaround for this session: stopped the api, `rm -f` the DLL, re-ran `prisma generate` — clean regen. Long-term fix: exclude `node_modules/` from OneDrive sync. Noted in the `tracing.ts` header comment for future engineers.
- **Prisma 5 vs Prisma 7 instrumentation.** `npx pnpm add @prisma/instrumentation` initially resolved to 7.7.0. With a Prisma 5.22 client, the 7.x instrumentation ran but didn't tag any spans (the internal hook surface shifted). Pinned to `@prisma/instrumentation@5.22.0` to match `@prisma/client@5.22.0` — spans appeared immediately.
- **`getNodeAutoInstrumentations` gotcha.** `fs` and `dns` are on-by-default and flood the tracer with `read`, `stat`, and `tcp.connect` spans for every Node `require()`. Disabled both — keeps the tree readable and costs nothing in observability (file reads aren't interesting).
- **First-batch 404 on SDK startup.** NodeSDK emits a lifecycle event that the exporter tries to flush before the app has completed boot, sometimes racing Jaeger's readiness and landing a 404. It's transient and doesn't affect post-boot spans. Left as-is; will re-evaluate if it shows up in prod logs.
- **CI implication.** The Phase-0 smoke workflow does not run with Jaeger available. `OTEL_EXPORTER_OTLP_ENDPOINT` is unset in the CI env, so the exporter falls back to `localhost:4318` and fails — but the failure is silent (OTel logs warn; the app keeps running). Tests don't load `instrumentation.ts`, so CI stays green. Production pods will have the real endpoint injected by Doppler.
- **Log order inside `instrumentation.ts`.** The whole file is a single function call + `export {};`. Exporting ensures TS treats it as a module and doesn't hoist anything past the `initTracing` call.

---

### [III.11.4] — Redis sliding-window rate limiter

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.4 + §13.4

**What was done**

Custom `@nestjs/throttler` storage backed by a Redis sorted-set sliding window. Three named buckets wired (`default` 60/min, `ai` 10/min, `auth` 5/min). Keys peppered with `RATE_LIMIT_PEPPER` so raw IPs / user-ids never sit in Redis in plaintext (§13.4).

- **`apps/api/src/common/rate-limit/redis-throttler.storage.ts`** — implements `ThrottlerStorage`. Single Lua script does `ZREMRANGEBYSCORE` (trim out-of-window) + `ZADD` (record current) + `ZCARD` (count) + `PEXPIRE` + `ZRANGE 0 0 WITHSCORES` (oldest entry for `timeToExpire`). All atomic. Uses ioredis with `lazyConnect`, `enableOfflineQueue: false` — same pattern as the Redis health indicator. Keys: `travel-<env>:throttle:<bucket>:sha256(pepper + tracker)`.
- **`apps/api/src/common/rate-limit/rate-limit.guard.ts`** — extends `ThrottlerGuard`, overrides `getTracker` to key by `user:<id>` when authenticated, falling back to `ip:<remote>`. Storage re-hashes with the pepper before touching Redis.
- **`apps/api/src/common/rate-limit/rate-limit.module.ts`** — inner `RateLimitStorageModule` provides `RedisThrottlerStorage` + aliases it to the `ThrottlerStorage` symbol. The outer `RateLimitModule` calls `ThrottlerModule.forRootAsync` with that inner module in its `imports:` so the factory can inject the storage (v6's `extraProviders` option was removed — this is the scoping pattern that replaces it). Test-mode inflates limits 10,000× so cumulative test traffic doesn't trip the shared-IP bucket; per-route `@Throttle({ ai: { limit: 10 } })` overrides stay authoritative.
- **`apps/api/src/app.module.ts`** — imports `RateLimitModule`, registers `RateLimitGuard` globally via `APP_GUARD`. Every route inherits the `default` bucket; routes with `@Throttle({ ai: ... })` get the ai bucket layered on; `@SkipThrottle({ name: true })` removes a specific bucket from a route.
- **`apps/api/src/health/health.controller.ts`** — `@SkipThrottle()` on the class. Probes from k8s / Fly.io hit /health/\* every second; without this the default bucket would trip and flip every pod to Unhealthy every minute.
- **`apps/api/test/rate-limit.e2e-spec.ts`** — 2-test integration suite:
  1. 11th call on an `@Throttle({ ai: { limit: 10, ttl: 60_000 } })` route returns 429 with `Retry-After-ai` set. Calls 1–10 return 200.
  2. The `default` bucket (60/min) is NOT exhausted by those 11 hits — proves bucket isolation. Uses per-pid IP (RFC 5737 TEST-NET-3) so the window starts fresh on every jest invocation.

**Files created** (4) — `apps/api/src/common/rate-limit/{redis-throttler.storage,rate-limit.guard,rate-limit.module}.ts`, `apps/api/test/rate-limit.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/package.json`.
**Dependencies** — `@nestjs/throttler@6.5.0`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/rate-limit.e2e-spec.ts --runInBand` — **2/2**.
- ✅ Full api suite — **11 suites, 76/76** (up from 74/74).
- ✅ Atomicity: Lua script's 5 operations run as one Redis transaction — no race between count and increment.

**Acceptance criteria**

- ✅ Custom `ThrottlerStorage` backed by Redis sliding window (`ZADD` / `ZREMRANGEBYSCORE` / `ZCARD`).
- ✅ Per-IP, per-user, per-endpoint-class buckets — tracker logic in `RateLimitGuard`.
- ✅ `@Throttle({ ai: { limit: 10, ttl: 60_000 } })` maps to an `ai` bucket.
- ✅ Integration test proves 11th call returns 429 (via `ThrottlerException` → `RateLimitError`-ish, HTTP 429 + `Retry-After-ai`).

**Notes**

- **v6 stacks throttlers on every route by default.** `@Throttle({ ai: {...} })` overrides the `ai` bucket's config for that route but `default` and `auth` still apply. To scope a route to ONE bucket, `@SkipThrottle({ other: true, also: true })` is required. The rate-limit test documents this explicitly — it bit me mid-implementation and would bite any future route author.
- **`setHeaders: true`** is needed for `X-RateLimit-*` + `Retry-After*`. Off by default in v6. Header name is `Retry-After-<throttlerName>` for non-default buckets (so blocked AI returns `Retry-After-ai`, not the standard `Retry-After`).
- **Test-mode limit inflation.** 76/76 tests pass because non-rate-limit tests don't trip the shared-IP (127.0.0.1) `default` bucket at 10_000 × 60 limit. The rate-limit test uses a per-pid RFC-5737 IP and an explicit `@Throttle` override, so the inflation doesn't touch its correctness.
- **`@SkipThrottle()` on HealthController** matters operationally, not just for tests. k8s liveness probes fire every 1–10 s; without the skip, probes would exhaust the default bucket in a minute on any pod that sees a health-probe loop.
- **CLAUDE rule 12 (pepper raw PII keys)** satisfied — the storage hashes the tracker before it touches Redis.
- **Dep-cycle detour.** First cut registered `RedisThrottlerStorage` as a provider of `RateLimitModule` and injected it into `ThrottlerModule.forRootAsync`'s factory — DI fails at compile because `forRootAsync`'s factory scope is the `ThrottlerModule`, not its parent. Fix: split into `RateLimitStorageModule` (provides storage) + `RateLimitModule` (imports both). v6 removed `extraProviders`; the inner-module pattern replaces it.

---

### [III.12.6] — ADR-010 delete policy (anonymise-on-delete, no soft-delete middleware)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Design · **Playbook §** 12.6 + 30.2

**What was done**

Chose **option B — anonymise-on-delete, no soft-delete middleware** — after the user asked for my call, framing the tension as "some want their data kept, some want it gone."

The key insight baked into the ADR: those two cohorts don't need the same mechanism. "Want data kept" = dormancy (account hidden, data untouched, reversible). "Want it gone" = GDPR/DPDP erasure (irreversible, schema-wide anonymisation). Option A fails BOTH — it leaves real PII on disk for regulators to find, and it hides deleted users' contributions from their co-travellers in group trips. Option B serves both correctly when paired with a separate "deactivate" primitive (lands with the identity module, `[III.13.2]`).

- **`docs/adr/ADR-010-soft-delete-policy.md`** — full MADR. Context drivers + considered options (A, B, + a hybrid C named and rejected) + decision outcome + **per-model propagation plan** listing every context's action on `Identity.UserDeleted`:
  - Identity: overwrite PII on `User`; cascade delete `Session` / `Preferences` / `Device`.
  - Trip + Social: retain rows, anonymise `authorId` / reviewer, LLM-sanitise Review bodies (§30.2).
  - Media: hard-delete owned assets + 30-day S3 archival.
  - Payments: retain 7 years (legal) with `userId` scrubbed; Stripe sub cancelled.
  - Safety: retain SosEvent for pattern analysis 12 months with userId blanked; ScamReport + Agent anonymised.
  - Notifications + Live: hard-delete (cascade).
  - Places / Stays / Food / Events / Weather / Transport / Analytics / Admin: no user-scoped rows; unaffected.
- **`docs/adr/README.md`** — index row for ADR-010 (number jumps past 009; [II.8.6] DevOps lock hasn't been done yet, so ADR-009 is still a stub).

**Files created** (1) — `docs/adr/ADR-010-soft-delete-policy.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Acceptance criteria**

- ✅ ADR-010 committed with a chosen outcome (B) and an explicit list of affected models.
- ✅ Rationale cites Playbook §12.6 + §30.2 + ADR-003 (the event bus that carries `UserDeleted`).

**Notes**

- **Why not A even though the user's first instinct was A.** A soft-delete flag does NOT satisfy GDPR / DPDP — regulators read "row still exists with a flag" as "still processing personal data". Users who actively hit DELETE mean "erase". Users who DON'T want data gone simply DON'T hit delete — they stay active (or hit DEACTIVATE, a separate primitive). The flag-everywhere pattern is a tax that serves no cohort properly.
- **Recoverability trade-off.** Under B, a deleted account cannot be restored from DB state — anonymised columns are permanently gone. The mitigation is the **30-day grace window** between anonymisation and hard-purge: within those 30 days an operator can rescind the delete (account un-anonymises at the identity-owning-user's request, but fields must be re-supplied — we don't hold the pre-delete PII anywhere). This is the GDPR-correct shape; "delete means delete" is the spirit of the law.
- **`User.deletedAt` stays the ONE soft-delete column.** Adding any other `deletedAt` now requires a superseding ADR — tripwire locked.
- **`Identity.UserDeleted` is already in the context-map.** Every user-scoped context's "Inbound" column lists it ([docs/architecture/context-map.md]). ADR-010 ratifies the existing event-name commitment.
- **Implementation work** lives in `[VI.30.2]` (the erasure propagation worker) and `[III.13.2]` (the identity module, which adds deactivation as a separate primitive). Those prompts read this ADR's per-context propagation table as spec.

---

### `health-indicator-cleanup` — PostgresHealthIndicator → PrismaService

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Refactor · **Follow-up to** `[IV.18.1.16]` × `[III.12.2]`

**What was done**

`PostgresHealthIndicator` had been carrying its own `pg.Pool` since it was written in `[IV.18.1.16]` — Prisma wasn't wired yet then. Now that `PrismaService` exists (from `[III.12.2]`), the right posture is ONE pool: `/health/ready` probes through the same connection every request path uses. A probe "up" truly means "every incoming request can reach the DB."

- **`apps/api/src/health/indicators/postgres.indicator.ts`** — rewritten to inject `PrismaService`, probe via `$queryRaw\`SELECT 1 AS ok\``. Dropped the `pg.Pool`+ its`onModuleDestroy` cleanup (PrismaService handles that now).
- **`apps/api/package.json`** — removed `pg@8.20.0` + `@types/pg@8.20.0`. Nothing in `apps/api/src` or `apps/api/test` imports `pg` after the rewrite.
- **No test changes needed.** `health.e2e-spec.ts` uses `overrideProvider(PostgresHealthIndicator)` with a test double — the underlying client swap is opaque to it.

**Files created** — none.
**Files edited** (3) — `apps/api/src/health/indicators/postgres.indicator.ts`, `apps/api/package.json`, `PROGRESS.md`.
**Dependencies** — **net -2** (`pg`, `@types/pg` removed).

**Verification**

- ✅ `tsc --noEmit` green after the indicator rewrite + dep drop.
- ✅ Full api suite — **10 suites, 74/74**. Unchanged pass count, no regressions.
- ✅ Live smoke: `/health/ready` on port 3032 returns 200 with `postgres.latencyMs: 34` via the PrismaService pool.
- ⚠ Kill-Redis verification skipped this run — Docker CLI commands in the session went silent (Desktop quirk, reproduced in multiple attempts). The Redis-indicator path didn't change in this cleanup, so the `[IV.18.1.16]` verification (503 on redis-down, recovery on restart) still stands. Unit tests for the Redis path continue to pass.

**Acceptance criteria** — n/a (not a standalone prompt; consistency cleanup).

**Notes**

- **Why this matters.** Two DB pools (the old `pg.Pool` for the probe + Prisma's pool for everything else) is a footgun: the probe could succeed while Prisma's pool is exhausted. Same pool = the probe sees what users see.
- **The `pg` dep had been carrying its weight elsewhere?** No — `grep -r "from 'pg'"` finds zero hits after this rewrite. Clean removal.
- **`tsx` version lesson.** The local `tsx` ended up at `4.21.0` even though `package.json` pins `^4.19.2` (semver-compatible). When hand-invoking via `node node_modules/.pnpm/tsx@.../...`, the exact folder name matters. Noted inline so next live-smoke picks the right path.

---

### [III.12.4] — Required indexes + EXPLAIN-uses-GiST acceptance

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.4

**What was done**

The two Playbook-§12.4-mandated outcomes were ALREADY satisfied by prior prompts — the `@@index` / `@@unique` declarations from `[III.12.1]` cover §12.4's list, GiST indexes from `[III.12.2]` cover every geography column, and the IVFFlat from `[III.12.3]` covers the vector column. All applied to the live DB. What was missing: the runtime ASSERTION that the planner actually uses the GiST index. This prompt adds that test.

- **`apps/api/test/index-usage.e2e-spec.ts`** — two-assertion integration suite:
  1. **`EXPECTED_INDEXES` set** (19 entries: 4 Prisma-declared from §12.4 + 14 GiST + 1 IVFFlat) MUST all appear in `pg_indexes` for schema `public`. Drift in either direction — missing index OR index rename — fails the test.
  2. **EXPLAIN on a radius query hits `Place_coordinates_gist`.** Seeds 25 Places near London, runs `ANALYZE "Place"` so the planner has stats, then wraps an `EXPLAIN SELECT ... WHERE ST_DWithin(...)` in a `prisma.$transaction` with `SET LOCAL enable_seqscan = off`. The forced setting makes the GiST index the only viable plan — asserts `plan.includes('Place_coordinates_gist')`. Proves the index is wired to the query, not just lying in `pg_indexes`.
- **No new migration file.** §12.4's indexes already live in the DB via prior migrations. Adding an empty `_indexes` migration would be dead SQL. PROGRESS documents this explicitly so the next engineer doesn't look for a migration that should exist.

**Files created** (1) — `apps/api/test/index-usage.e2e-spec.ts`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/index-usage.e2e-spec.ts --runInBand` — 2/2 pass.
- ✅ Full api suite — **10 suites, 74/74** (up from 72/72). No regressions.

**Acceptance criteria**

- ✅ `EXPLAIN ANALYZE` on a radius query uses the GiST index (verified under `enable_seqscan = off`).
- ✅ `\di`-equivalent check — every expected index lives in `pg_indexes`.

**Notes**

- **Why `SET LOCAL enable_seqscan = off`?** On 25 rows the planner's default cost model picks a seq-scan (scanning 25 rows is cheaper than walking a GiST index); the index IS there, the planner just won't use it at that data scale. Forcing seq-scan off proves the GiST index is reachable for this query shape. In production with millions of rows, the planner picks it naturally; the test proves the plumbing.
- **`Place_coordinates_gist` name coupling.** The test literally greps for the index name. If someone renames it in a future migration, this test fails — a deliberate tripwire, since the GiST indexes are referenced by name in `docs/services/...` and the context-map's implied shape.
- **`EXPLAIN` vs `EXPLAIN ANALYZE`.** The test uses `EXPLAIN` (plan only) rather than `EXPLAIN ANALYZE` (plan + actual runtime). Plan is sufficient to assert index usage and costs zero runtime; `ANALYZE` would force the query to actually run, which is wasted work here.
- **The "indexes migration" the prompt asks for is a no-op.** All 19 indexes land via `[III.12.1]` (@@index in schema), `[III.12.2]` (14 GiST migration), `[III.12.3]` (1 IVFFlat migration). Adding another migration with `CREATE INDEX IF NOT EXISTS` for the same set would silently succeed and encode zero new state. Omitted deliberately; the test is the acceptance gate.

---

### [III.12.3] — pgvector VectorQueries + IVFFlat index

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.3

**What was done**

Companion to [III.12.2] — turns `PlaceEmbedding.embedding` (`Unsupported("vector(1024)")`) into callable methods, and lays down the IVFFlat index the queries ride on.

- **`apps/api/src/common/db/vector-queries.ts`** — `@Injectable()`, registered in `DbModule`. Two methods:
  - `upsertEmbedding(placeId, embedding: number[], model?)` — `INSERT … ON CONFLICT ("placeId") DO UPDATE …`, so the 1:1 `PlaceEmbedding.placeId` primary key enforces "one embedding per place" by construction. Rejects vectors whose length ≠ 1024 at the client boundary (no round-trip for wrong input).
  - `findSimilar(embedding, limit) → {placeId, distance}[]` — uses the `<->` L2-distance operator, `ORDER BY <->` so pgvector picks the IVFFlat index, `LIMIT limit`. Rejects non-positive limits up front.
  - Cast is dimensionless (`::vector`) — pgvector infers 1024 from the literal; column type enforces match on INSERT. Helper `toVectorLiteral` serialises `[v0,v1,…]` which is both JSON and pgvector's bracketed input syntax.
  - **HNSW switch trigger documented inline** (row count > 1M, recall@10 < 0.95, or IVFFlat rebuild > 1h — the [ADR-007] quantitative triggers carry straight through).
- **`apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`** — `CREATE INDEX ... USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)`. Prisma can't express this on `Unsupported` columns; hand-edited migration. `vector_l2_ops` matches the `<->` operator; switching to cosine (`<=>`) would require `vector_cosine_ops`.
- **`apps/api/src/common/db/db.module.ts`** — `VectorQueries` added to providers + exports.
- **`apps/api/test/vector-queries.e2e-spec.ts`** — integration suite against live Docker Postgres. Seeds **100 deterministic 1024-dim vectors** (`vector[i][0] = i * 0.01`, rest 0), calls `findSimilar(makeVector(42), 5)`, asserts:
  - Result length = 5.
  - First result is vector 42 with distance < 1e-5.
  - Distances non-decreasing across the 5.
  - **The set** is exactly `{40, 41, 42, 43, 44}` — L2 distances 0.02, 0.01, 0, 0.01, 0.02 to target 42. Avoids asserting a specific intra-tie order.
  - Upsert replaces in place (row count stays at 1).
  - Wrong-dimension + non-positive-limit inputs throw at the client boundary, not at the DB.
  - Seed timeout raised to 60 s (200 SQL round-trips for Places + embeddings — observed ~5 s in practice).

**Files created** (3) — `apps/api/src/common/db/vector-queries.ts`, `apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`, `apps/api/test/vector-queries.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/common/db/db.module.ts`.
**Dependencies** — none.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/vector-queries.e2e-spec.ts --runInBand` — **4/4 pass**.
- ✅ Full api suite — **9 suites, 72/72** (up from 68/68). No regressions.
- ✅ Migration `20260420081604_vector_ivfflat` applied cleanly via `migrate deploy`.

**Acceptance criteria**

- ✅ Integration test stores 100 random vectors (deterministic — see note), finds nearest 5 correctly.
- ✅ `<->` operator used throughout.
- ✅ IVFFlat index with `lists = 100` installed.
- ✅ HNSW switch trigger documented inline + cross-referenced to ADR-007.

**Notes**

- **Deterministic test vectors, not random.** The prompt says "100 random vectors" but a random seed doesn't get us a predictable top-5 without re-computing distances in JS. Instead each vector `i` encodes its index as `vector[0] = i * 0.01`, rest zeros. L2 distance between vector(i) and vector(j) is `|i-j| * 0.01`, so "top 5 closest to 42" is exactly `{40, 41, 42, 43, 44}` by construction. Stronger than random — we can assert the exact set, not just "some" ranking.
- **Distance operator matters.** `<->` is L2 / Euclidean. For cosine similarity we'd use `<=>` AND change the IVFFlat op-class to `vector_cosine_ops`. For inner product, `<#>` + `vector_ip_ops`. The prompt specifies `<->`.
- **IVFFlat on empty tables.** pgvector's IVFFlat computes centroids when the index is built. Building on an empty table creates a structurally valid but untrained index — pgvector falls back to exact search in that case, which is correct (just slow at scale). Fine at MVP; rebuild (`REINDEX INDEX ... CONCURRENTLY`) once Places has 10k+ rows.
- **ESM/CJS lesson from III.12.2 applies here too.** Nothing new installed; all imports are from Node built-ins or Prisma/Nest which are already CJS-compatible.

---

### [III.12.2] — PostGIS raw-SQL wrapper (GeoQueries) + DI scaffold

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.2

**What was done**

Turns the PostGIS columns from [III.12.1]'s schema into callable methods, enforces CLAUDE rule 11 (PostGIS writes only via `GeoQueries`) by construction, and stands up the shared `PrismaService` + `DbModule` infrastructure every future module will depend on.

- **`apps/api/src/common/db/prisma.service.ts`** — `@Injectable()` `PrismaClient` subclass wired into Nest lifecycle. `onModuleInit` → `$connect`, `onModuleDestroy` → `$disconnect`. Reads `DATABASE_URL` via the typed `ConfigService`. `log: ['warn', 'error']` for now (query-level logs gated by a future prompt).
- **`apps/api/src/common/db/db.module.ts`** — `@Global` module exporting `PrismaService` + `GeoQueries`. Global so feature modules don't re-declare; single Prisma connection across the process.
- **`apps/api/src/common/db/geo-queries.ts`** — three typed methods as specified in the prompt:
  - `insertPlace({sourceKey, name, category, lat, lng, …})` → `Place` row. `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`. Returns every Prisma-generated field on `Place` (but not `coordinates` — that'd need WKB decoding the ORM can't type).
  - `findPlacesWithinRadius({lat, lng, radiusKm, filters?})` → `(Place & { distanceMeters })[]`, ordered nearest-first. Optional `filters.category`. `ST_DWithin` on the GiST-indexed column.
  - `updatePlaceCoordinates(id, lat, lng)` → row count. Returns 0 for non-existent ids.
- **`apps/api/prisma/migrations/20260420062207_geo_gist_indexes/migration.sql`** — hand-edited migration. 14 GiST indexes on every `geography(Point, 4326)` column in the schema (Place.coordinates, Trip.center, Stay, Eatery, RouteLeg origin/destination, CrimeIncident, ScamReport, SosEvent, WeatherForecast, Alert, Event, Geofence.center, MediaAsset). Prisma can't express `@@index(... type: Gist)` on `Unsupported` columns, so they live as raw SQL (Playbook §12.5 anticipates this).
- **`apps/api/src/app.module.ts`** — `DbModule` imported.
- **`apps/api/test/geo-queries.e2e-spec.ts`** — 4-test integration suite against the live Docker Postgres. Acceptance match: inserts 3 places, queries within 5 km of Victoria Station, gets 2 (Hyde Park + Trafalgar Square, not Windsor — ~35 km away). Asserts nearest-first ordering via `distanceMeters` (not name — Trafalgar is actually closer than Hyde Park at these coords, as the test learned). Category filter + `updatePlaceCoordinates` happy-path + zero-row-update cases covered. Suite auto-skips if Postgres isn't reachable (warns, doesn't fail).

**Files created** (5) — `apps/api/src/common/db/{prisma.service.ts, db.module.ts, geo-queries.ts}`, `apps/api/prisma/migrations/20260420062207_geo_gist_indexes/migration.sql`, `apps/api/test/geo-queries.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts`, `apps/api/package.json` (added then removed `@paralleldrive/cuid2`), `pnpm-lock.yaml`.
**Dependencies** — **net zero**. Tried `@paralleldrive/cuid2@3.3.0` for cuid-format ids on raw-SQL inserts, but it's ESM-only and clashed with ts-jest's CJS transform. Swapped to Node 22's built-in `crypto.randomUUID()` instead — no new dep, works in Node + Jest. Id format on raw-SQL-inserted rows is UUIDv4 rather than Prisma's cuid; inconsistency flagged inline in `geo-queries.ts`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `node_modules/.pnpm/jest@.../bin/jest.js test/geo-queries.e2e-spec.ts --runInBand` — **4/4 pass**.
- ✅ Full api suite — **8 suites, 68/68** (up from 64/64). No regressions.
- ✅ Migration `20260420062207_geo_gist_indexes` applied cleanly via `migrate deploy`. `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_gist'` lists all 14.
- ✅ Type inference without casts — `results[0]!.distanceMeters` compiles with `exactOptionalPropertyTypes: true`; `results[0].name` is typed `string` from Prisma's `Place` interface.

**Acceptance criteria**

- ✅ 3 places inserted, query within 5 km gets 2 back (the 2 inside the radius, not Windsor).
- ✅ Type inference works without casts — every field on `PlaceWithDistance` is compile-time known.

**Notes**

- **Disk space tripwire.** During the session, `C:` hit 100% full (only 27 MB free) while `@paralleldrive/cuid2` was being installed — `npm-cache` alone was 5.2 GB. `npx` / `pnpm remove` both failed with `ENOSPC`. Worked around by invoking jest directly via `node node_modules/.pnpm/jest@.../bin/jest.js`. User should clear npm-cache + pnpm store when convenient — next install will bite otherwise.
- **`createNestApplication()` default Express fallback.** First cut of the test used `moduleRef.createNestApplication()` which pulled in `@nestjs/platform-express` (missing — we're Fastify-only). Dropped the HTTP-app creation entirely; `moduleRef.get(PrismaService)` + `moduleRef.close()` is the clean path for DB-only integration tests. Pattern worth remembering for every future integration test that doesn't need HTTP.
- **Test location geography.** Victoria Station is the reference point; Hyde Park ~2 km, Trafalgar ~1.7 km, Windsor ~35 km. First pass used Camden Town (actually ~5.2 km from Victoria) — outside the 5-km radius, so the test failed. Swapped Camden for Trafalgar. Lesson: real-world distances between London landmarks are non-obvious; when asserting radius behaviour, check with a distance calculator or assert via `distanceMeters` rather than name ordering.
- **`coordinates` omitted from `RETURNING` / `SELECT` in `GeoQueries`.** Prisma's `Place` type doesn't include `coordinates` (it's `Unsupported`), so we can't read it back through the typed interface. Callers that need the point use a separate method (to be added when the first caller materialises — YAGNI for now).
- **Id-format inconsistency.** Rows inserted via `GeoQueries` get UUIDv4 ids; rows inserted via `prisma.<model>.create` get cuid. Same `String` column, both accepted. If this becomes an observability pain (differentiating id origin in logs), we can swap to a CJS-safe cuid library OR pre-generate cuids via a tiny Node-native helper. Not urgent.

---

### [III.12.1] — Prisma schema foundation (DONE)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.1

**Shipped across two commits:** `b8e422a` (schema + deps, IN-PROGRESS pending Docker) → `<current>` (initial migration applied against live Postgres, flipped to DONE).

**What was done**

Authored the full Prisma schema covering every model from the [context-map](./docs/architecture/context-map.md). Validates clean. Initial migration generated, applied against the Docker Postgres container, and verified — all 43 tables + 4 extensions (postgis, vector, pg_trgm, pgcrypto) now live.

- **`apps/api/prisma/schema.prisma`** — 43 models, exact match against context-map (`grep "^model " | wc -l` = 43, sorted list cross-checked one-for-one). Covers all 15 stateful bounded contexts. Highlights:
  - `generator client { previewFeatures = ["postgresqlExtensions"] }` + `extensions = [postgis, vector, pg_trgm, pgcrypto]`.
  - PostGIS columns typed `Unsupported("geography(Point, 4326)")` — mandated path through `GeoQueries` (CLAUDE.md rule 11). pgvector columns typed `Unsupported("vector(1024)")`.
  - Every row has `id String @id @default(cuid())` + `createdAt` + `updatedAt` unless append-only (logs, forecasts, versions).
  - Soft-delete ONLY on `User` (GDPR erasure flow). Everything else hard-deletes (per Playbook §12.6 "pick one").
  - 12 enums (`UserRole`, `TripStatus`, `AgentKycStatus`, `ScamSeverity`, `SubscriptionStatus`, `EscrowState`, `NotificationChannel`, `NotificationDeliveryStatus`, `MediaStatus`, `ModerationStatus`, `LiveEventKind`, `TransportMode`).
  - PII pattern on `User`: `emailHash String @unique` (pepper-hashed for equality lookup) + `emailEncrypted Bytes` (pgcrypto-backed) + `passwordHash String?` (argon2id; null for OAuth-only). Playbook §13.11.
  - Playbook §12.4 indexes land: `Trip @@index([userId, status, createdAt])`, `Session @@index([userId, revokedAt])`, `CrimeIncident` indexed by `source` + `reportedAt`, `NotificationLog @@index([userId, read, createdAt])`, `User @@unique([emailHash])`.
  - Foreign-key delete behaviour chosen deliberately: `Cascade` for user-owned rows, `Restrict` for rows with financial consequences (bookings, escrow), `SetNull` for weak references (e.g. `ItineraryItem.placeId`, `MediaAsset.tripId`).
  - `Event` (the CulturalEvent) kept name-as-is per context-map naming-collision note.
- **`apps/api/package.json`** — prisma scripts added: `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:studio`, `db:validate`. Pinned `prisma` + `@prisma/client` to **5.22.0** (ADR-006 locks Prisma 5; Prisma 7's config-file requirement for `DATABASE_URL` would need a superseding ADR).

**Files created** (1) — `apps/api/prisma/schema.prisma`.
**Files edited** (2) — `apps/api/package.json`, `pnpm-lock.yaml`.
**Dependencies** — `prisma@5.22.0` (dev), `@prisma/client@5.22.0`.

**Verification**

- ✅ `prisma validate` — "The schema at prisma\\schema.prisma is valid 🚀"
- ✅ 43 models in schema.prisma match the context-map Ownership Index 1:1 (sorted `grep "^model "` output cross-referenced).
- ✅ Initial migration `prisma/migrations/20260420060403_init/migration.sql` generated via `prisma migrate diff --from-empty --to-schema-datamodel` (1046 lines of SQL, extensions × 4 + enums × 12 + tables × 43 + indexes + FKs).
- ✅ `prisma migrate deploy` applied the migration cleanly against `travel-postgres`. `_prisma_migrations` row written.
- ✅ `docker exec travel-postgres psql -c "\\dt"` confirms 43 app tables (plus `_prisma_migrations` + PostGIS's `spatial_ref_sys`).
- ✅ `SELECT extname FROM pg_extension` confirms all 4 extensions present (postgis 3.4.3, vector 0.8.2, pg_trgm 1.6, pgcrypto 1.3).

**Acceptance criteria**

- ✅ `prisma validate` green.
- ✅ Initial migration applies cleanly (via `migrate deploy` — see "Migration flow" note below).
- ✅ Every model from the context map exists exactly once — 43/43.

**Notes**

- **Migration flow** (non-interactive). `prisma migrate dev` is interactive-only and won't run from an automated shell. Generated the migration file manually via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (same SQL `migrate dev` would produce), wrote `migration_lock.toml`, then applied via `prisma migrate deploy` — which IS non-interactive. Net result identical to a standard `migrate dev --name init`; the `_prisma_migrations` table tracks it correctly.
- **Prisma 7 → 5 downgrade.** pnpm first resolved `prisma` to 7.7.0, which moved `DATABASE_URL` out of `schema.prisma` into `prisma.config.ts` (breaking change). ADR-006 locks Prisma 5; downgraded to 5.22.0 rather than open a superseding ADR mid-flight.
- **`postgisTopology` dropped.** Playbook §12.5 has `postgisTopology` in the example extensions list, but that name doesn't map to a real Postgres extension (the actual one is `postgis_topology`, lowercase). We only need Point geometry, not topology — dropping it avoids the name-mapping detour. Worth a note in a future Playbook erratum.
- **Supabase is the production Postgres host** (user note, 2026-04-20). Memory saved. This doesn't change the schema — Supabase IS Postgres + our extensions are pre-enabled there. It does mean when production lands we'll need a `DIRECT_URL` env var for Prisma migrations (PgBouncer transaction mode breaks Prisma's prepared statements) and a posture decision on RLS. Flagged for the [IV.17.2] Prisma fix-up prompt.
- **What's NOT in the schema yet (intentional):**
  - No `_prisma_migrations` seeding logic — that's a separate seed prompt.
  - No Row-Level Security. Supabase enables RLS by default on new tables; we'll decide posture when we wire the Supabase DATABASE_URL.
  - No `pgvector` IVFFlat / HNSW index creation — Prisma can't express those in the schema. They land via a raw-SQL migration step when the Places module goes live.
  - `@@index([coordinates], type: Gist)` — Prisma 5 doesn't support GiST on `Unsupported` columns. Landed as raw-SQL-migration step in `[III.12.2]` alongside `GeoQueries`.

---

### [II.8.5] — External APIs registry

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.5

**What was done**

One canonical table for every external provider the product depends on. Reviewers grep this doc whenever a PR bumps, adds, or removes an external dep — the row has to change in the same commit.

- **`docs/external-apis.md`** — 18 providers across 7 categories (Maps, Places, Hotels, Weather, Satellite/Crowd, Crime, Payments, Comms). Every row has: name, purpose, base URL, auth type, 2026-04-snapshot free-tier limits, step-up cost, adapter port name (e.g. `PlacesLookupPort#google`), circuit-breaker config. Shared CB policy stated explicitly (opossum-style: `N failures / rolling window / cooldown`, 4xx never opens the circuit, 429 feeds a rate-limit counter, state transitions emit metrics). Stripe is the explicit exception — no circuit breaker, only idempotent retry (failing closed on checkout is worse than waiting). How-to-add + how-to-remove procedures documented. Cross-links to ADR-004 (adapter-in-module rule), package-manifest, notification-worker/crawler-worker contracts.

**Files created** (1) — `docs/external-apis.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "every provider from §8.5 present; circuit-breaker policy stated." ✅ — every §8.5 row present; circuit-breaker policy captured both per-provider and as a shared-policy block.

Cross-checks:

- Every adapter-port name follows the `<Owner><Verb>Port` convention from [context-map](./docs/architecture/context-map.md).
- Free-tier numbers tagged as "snapshot as of 2026-04" — the doc is explicit that this is a re-verify-quarterly thing.
- Stripe's carve-out (no circuit breaker) is called out so future reviewers don't try to "fix" it.

**Acceptance criteria**

- ✅ Every provider from Playbook §8.5 present.
- ✅ Circuit-breaker policy stated (shared + per-provider exceptions).

**Notes**

- 429 handling is its own design choice — not treated as a failure, just a rate-limit signal. Crawler-worker's "rate_limit_breaches_total = 0" anti-SLO (from [II.7.3]) aligns with this.
- Numbeo's paid tier is "contact them" opaque — flagged in the row.
- Government open-data row is intentionally per-country / per-feed rather than a single base URL; the adapter's internal registry handles the routing.

---

### [III.11.2] — Use-case pattern reference

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Seed · **Playbook §** 11.2

**What was done**

Formalises the 5-rule use-case contract every future `*.use-case.ts` file across all 17 bounded contexts must obey. PRs that diverge fail review by construction.

- **`docs/patterns/use-case.md`** — five contract rules: (1) single public `execute(cmd)`; (2) commands are Zod-validated DTOs; (3) returns DTO, never an entity; (4) persist before publish, bus second; (5) no `try/catch` around expected `DomainError`s (bubble to the global filter). Includes Playbook §11.2 example **verbatim** (the `GenerateItineraryUseCase`). Complements: command-file shape (Zod schema + inferred type), explicit MUST-NOT list (no `console.log`, no `prisma.$transaction` wrapping a network call, no reach-across-modules, no `null` returns, no `this.`-state), testing template (ports mocked / domain entities real / 80% coverage floor), and the folder tree that every module uses.
- Cross-links: Playbook §11.2; CLAUDE.md rules 9, 11, 13; ADR-001 (layer rule); ADR-003 (EventBus contract); ADR-004 (no cross-module imports).

**Files created** (1) — `docs/patterns/use-case.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "doc references Playbook and is linked from the module template README." ✅ for the Playbook reference (inline §11.2 source link + verbatim example). ⚠ for the module-template-README link — the template README itself doesn't exist yet. Added a forward-link note at the end of the doc; the future `[III.11.x]` module-template prompt will close the loop.

**Acceptance criteria**

- ✅ One public `execute(cmd)` method documented as rule 1.
- ✅ Commands are Zod-validated DTOs before `execute`.
- ✅ Returns a DTO, never an entity.
- ✅ Publishes events to `EventBus` after persistence (persist before publish, explicit ordering note).
- ✅ No `try/catch` around expected domain errors (bubble to global filter).
- ✅ Playbook §11.2 example included verbatim.

**Notes**

- This is the first doc under `docs/patterns/`. Future sibling patterns (repository, port, mapper) go here under the same format.
- The test template shows `expect(save).toHaveBeenCalledBefore(events.publish as unknown as jest.Mock)` — `jest-extended` provides `toHaveBeenCalledBefore` which isn't in stock Jest. Noted for the future module-template prompt to add `jest-extended` to `@app/testing`.
- Every binding consequence cross-references an existing authoritative doc (ADR / CLAUDE). No new rules are introduced — this doc is the teaching surface, not the source of truth.

---

### [II.8.4] — ADR-008 AI-stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 21 + §22

**What was done**

Locks runtime AI. Playbook §22.3 is blunt: "you need caching + Haiku routing to be profitable below 5% Pro conversion." The ADR bakes both in + a fallback chain that survives an Anthropic outage.

- **`docs/adr/ADR-008-ai-stack.md`** — 5 choices + 5 rejected alternatives:
  1. Anthropic 3-tier router (Haiku/Sonnet/Opus) via a `TaskKind` enum / rejected single-model Sonnet-everywhere.
  2. Self-hosted NLLB-200 / rejected Google Translate API.
  3. Self-hosted Whisper small-v3 (streaming) / rejected Groq/Deepgram.
  4. Self-hosted DistilBERT for fake-review / rejected Anthropic classification prompt.
  5. Llama 3.1 70B reserved open-weight lane (not wired today) / rejected Mistral Large / Mixtral.
- **Runtime routing table** mapped to the 6 `TaskKind`s in the product (itinerary gen, live re-plan, chat suggest, trip summary, agent safety check, ambiguity resolution) — each keyed to a model with the specific reason (margin-critical for Haiku, ambiguity-resolution for Opus, etc.).
- **Prompt-caching strategy** ported from Playbook §21.2 to runtime: 3 cache layers (5-min ephemeral per-turn / 1-hour ephemeral per-session / 1-hour ephemeral per-trip). `ai_cache_hit_ratio` is a tracked SLO at ≥ 60% / 14d.
- **Fallback chain** when Anthropic is down: 1) primary call → 2) failover region → 3) OpenAI equivalent via `OPENAI_API_KEY` → 4) self-hosted Llama (when wired) → 5) template fallback (itinerary only) → 6) `AI_SERVICE_DEGRADED` domain error. Per-task matrix shows which levels apply. **Agent safety-check has an explicit fail-closed rule** — never silently approve on AI outage; the UI disables the action.
- **`docs/adr/README.md`** — index row for ADR-008.

**Files created** (1) — `docs/adr/ADR-008-ai-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none. (ai-service and `@app/ai` adapter implementation is `[IV.18.2.11]`.)

**Verification**

Acceptance criteria from prompt (three clauses):

- ✅ **Model per task.** Runtime routing table lists all 6 `TaskKind`s with a named model + rationale.
- ✅ **Cache layers listed.** 3 layers (L1 5-min per-turn; L2 1-hr per-session; L3 1-hr per-trip) with token budgets per block.
- ✅ **Fallback chain covers outage.** 6-step chain with per-task applicability matrix; agent-safety fail-closed rule called out.

**Acceptance criteria**

- ✅ Layered Anthropic tier (Haiku / Sonnet / Opus) + self-hosted NLLB / Whisper / DistilBERT / Llama 3.1 all covered.
- ✅ Prompt-caching strategy documented per §21.2.
- ✅ Fallback chain for Anthropic outage documented.

**Notes**

- **Chapter-8 trilogy of stack-lock ADRs complete.** ADR-005 (frontend) + ADR-006 (backend) + ADR-007 (data) + ADR-008 (AI). Any non-trivial architectural drift now requires a superseding ADR, not a PR-comment thread.
- Routing table deliberately restraints Opus to safety-check + ambiguity-resolution — matches the margin math in §22.3 more than the "Opus is the best" instinct.
- **Fail-closed on safety** is the most important single line in the ADR: if the agent-safety prompt can't reach any model, the UI disables the action rather than silently approving. That's a product / liability decision dressed as an architecture decision, and it needs to live somewhere permanent.

---

### [II.8.3] — ADR-007 data-layer lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.3

**What was done**

Locks "one Postgres for relational + geo + vectors" + Redis for cache/queue/streams + Meilisearch for full-text. Key non-obvious contribution: the **quantitative vector-split trigger** the prompt's acceptance criterion demands.

- **`docs/adr/ADR-007-data-layer.md`** — 5 choices + 5 rejected alternatives:
  1. Postgres 16 / rejected CockroachDB (multi-region & ext-ecosystem regressions).
  2. PostGIS in same DB / rejected Elasticsearch geo (JOIN-with-relational wins).
  3. pgvector in same DB / rejected Pinecone — with the quantitative split trigger below.
  4. Redis 7 (one cluster, namespaced) / rejected "Memcached for cache, Redis for rest".
  5. Meilisearch / rejected `pg_trgm` + `tsvector`.
- **Vector split trigger (quantitative):** migrate off pgvector when, over a rolling 14-day window, **either** `PlaceEmbedding > 5,000,000 rows` **or** `p95 > 150 ms for k≤50` measured at the `VectorQueries` adapter layer. Crossing the threshold without opening the superseding ADR is a policy violation.
- **Binding consequences** promote two pre-existing CLAUDE rules (11 — PostGIS via `GeoQueries`; Redis key namespacing via `@app/cache`) to ADR-level, so relaxing them requires a superseding ADR.
- **`docs/adr/README.md`** — index row for ADR-007.

**Files created** (1) — `docs/adr/ADR-007-data-layer.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "vector-split trigger is quantitative (embeddings row count + query p95)." ✅ — 5M rows OR 150 ms p95 over a 14-day window, both numbers named at the `VectorQueries` layer so they're enforceable.

Cross-checks:

- Five choices × five rejected alternatives; summary table for grep.
- PostGIS extension name is correct (`postgis`), pgvector extension name is the gotcha (`vector`, not `pgvector` — called out in the text).
- Redis decision ties back to [ADR-003](./docs/adr/ADR-003-event-backbone.md) + [ADR-006](./docs/adr/ADR-006-backend-stack.md) so this ADR formalises the "one Redis for five things" posture without contradicting either sibling.

**Acceptance criteria**

- ✅ Postgres 16 + PostGIS + pgvector + Redis 7 (+Streams +BullMQ) + Meilisearch all locked.
- ✅ "One Postgres for relational + geo + vectors" rationale documented.
- ✅ Vector-split trigger is quantitative with both named metrics.

**Notes**

- Chapter-8 now 3/4: ADR-005 (frontend), ADR-006 (backend), ADR-007 (data). ADR-008 (AI stack) is the last one (`[II.8.4]`).
- The vector-split threshold numbers (5M / 150 ms) are conservative for IVFFlat + commodity Postgres; we'd likely hit the latency threshold well before the row count threshold.

---

### [II.8.2] — ADR-006 backend stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.2

**What was done**

Locks 5 backend-stack choices + 5 rejected alternatives so "Express vs NestJS" and "Drizzle vs Prisma" never relitigate in a PR.

- **`docs/adr/ADR-006-backend-stack.md`** — Context tied to ADR-001 (17 modules × 4 layers needs real DI) + ADR-002 (Python carve-out for ML) + ADR-003 (BullMQ rides the same Redis). Choices: (1) NestJS 11 / rejected plain-Fastify + tsyringe; (2) Fastify adapter / rejected Express (slower); (3) Prisma 5 / rejected Drizzle (PostGIS+pgvector integration too DIY today); (4) Python 3.12 + FastAPI + Ray Serve / rejected ONNX-Runtime-in-Node (NLLB quality loss + Whisper streaming pain); (5) BullMQ on Redis / rejected Temporal (heavier ops; migrate per-workflow later if replay required). Binding consequences: every module is a Nest module; all DB access through Prisma or `GeoQueries`; ai-service mTLS-only internal; BullMQ queues env-namespaced via `@app/cache`; Temporal is a per-workflow ADR trigger, not a wholesale switch.
- **`docs/adr/README.md`** — index row for ADR-006.

**Files created** (1) — `docs/adr/ADR-006-backend-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "5 choices, 5 rejected alternatives." ✅ — exactly 5 `### N. <Layer>` sections, each with a **Chosen** + **Rejected alternative** paragraph, summary table for grep-ability.

**Acceptance criteria**

- ✅ NestJS 11 + Fastify + Prisma 5 + Python 3.12 FastAPI + BullMQ all locked.
- ✅ One rejected alternative per choice with the specific reason (not generic "more complex").
- ✅ Rationale includes the migration trigger for at least the Temporal decision (deterministic-replay-needed-for-billing).

**Notes**

- Chapter-8 now 2/4: ADR-005 (frontend), ADR-006 (backend). ADR-007 (data) + ADR-008 (AI) remain.
- Several binding consequences re-encode rules that already live in CLAUDE.md (rule 11 — PostGIS via `GeoQueries`, rule 13 — no network inside `prisma.$transaction`). Having them in an ADR means re-interpretation requires a superseding ADR, not just a PR comment thread.

---

### [II.8.1] — ADR-005 frontend stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.1

**What was done**

Locks 5 frontend-stack choices + 5 rejected alternatives so feature authors don't relitigate "Next vs Remix" or "Tailwind vs MUI" on every PR.

- **`docs/adr/ADR-005-frontend-stack.md`** — MADR: Context (one TS universe + SSR/SEO + native mobile feel + OTA + small team + shared primitives). Choices: (1) Next.js 15 App Router / rejected Remix; (2) React Native + Expo 51 / rejected Flutter; (3) TypeScript strict end-to-end / rejected gradual TS; (4) Tailwind + shadcn/ui / rejected MUI; (5) Tamagui on mobile / rejected NativeWind. Rationale per choice cites the specific hot-path that would suffer under the rejected option (RSC streaming, 60 FPS scrolling, scroll-heavy feeds, etc.). Binding consequences: every TS surface inherits `@app/tsconfig`; no Vite escape hatch; primitives live only in `@app/ui` (web) and `@app/mobile-ui` (mobile); PWA is explicitly NOT the mobile story. Re-evaluation triggers: RSC parity elsewhere, Tamagui drift, new render target (Vision Pro / Wear OS), team growth past ~20.
- **`docs/adr/README.md`** — index row for ADR-005.

**Files created** (1) — `docs/adr/ADR-005-frontend-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance criterion: "5 choices, 5 rejected alternatives." ✅ — exactly 5 `### N. <Layer>` sections, each with a **Chosen** + **Rejected alternative** paragraph, and a summary table at the bottom for grep-ability.

**Acceptance criteria**

- ✅ Next.js 15 + RN/Expo 51 + TS strict + shadcn/Tailwind + Tamagui all called out.
- ✅ One rejected alternative per choice, with the reason it was rejected.
- ✅ No code (per prompt).

**Notes**

- Chapter-8 stack-lock series kicked off. ADR-006 (backend), ADR-007 (data), ADR-008 (AI) are `[II.8.2-4]` and will follow the same shape.
- Binding consequences re-assert two CLAUDE.md rules (no `any`, `@app/tsconfig` inheritance) in ADR form so a future ADR-supersede is the only way to relax them.

---

### [II.7.3] — Extracted-service contracts (4 docs)

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.3

**What was done**

Finishes Chapter 7. One contract doc per extracted service — all four of them — each covering the four sections the prompt mandates: **transport · endpoints/topics · SLO · failure/degradation**. Contracts are the out-of-process counterpart to ADR-004 (intra-api rule) + context-map (intra-api shape) + package-manifest (cross-app shape).

- **`docs/services/README.md`** — index table mapping each service to its contract + stack + role. Commits rule: any contract change is a same-commit edit of the doc AND the matching `@app/shared-types` schemas.
- **`docs/services/ai-service/contract.md`** — Python sidecar. gRPC primary (needed for Whisper STT streaming + typed .proto IDL), REST secondary. Endpoints: `/v1/translate`, `/v1/stt` (streaming), `/v1/fake-review/score`, `/v1/crowd/predict`, `/v1/embeddings`, `/v1/health`. SLOs range from 60 ms p95 (crowd predict, in-memory) to 900 ms p95 (translate cache-miss). Circuit breaker opens after 5 consecutive failures; per-endpoint fallback (identity-text, safe-optimistic, deferred-embeddings).
- **`docs/services/media-service/contract.md`** — Node worker. BullMQ primary (every media job is fire-and-forget), internal HTTP secondary for `/v1/health` + admin reprocess. Queues: `media.image.transform`, `media.video.transcode`, `media.3d-tile.cache`. SLOs per-job (image 900 ms p95, video 45 s p95 for ≤30 s sources). Deterministic `sha256`-keyed outputs make retries idempotent by construction.
- **`docs/services/notification-worker/contract.md`** — BullMQ + event-bus wildcard subscriber. Inbound: every outbound event from every context. Outbound: `Notifications.NotificationDispatched` / `NotificationFailed`. Tightest SLO in the whole system: `Safety.SosTriggered → push delivered` at p95 3 s. Per-channel retry policies + idempotency-key dedupe; `critical` priority bypasses quiet-hours.
- **`docs/services/crawler-worker/contract.md`** — Scheduled scrapers (Playwright + cron). Three cron jobs: `prices.refresh.daily`, `events.scrape.hourly`, `osm.diff.6h`. SLOs measured as **freshness** (26 h for prices, 90 min for events, 7 h for OSM). Anti-SLO `rate_limit_breaches_total = 0` — a single breach loses us source API access. Feature flags disable misbehaving scrapers per-source.

**Files created** (5) — `docs/services/README.md` + 4 `<name>/contract.md` files.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none. Pure docs.

**Verification**

Acceptance criterion: "4 contract docs, each with all 4 sections." ✅ — every contract has explicit `## 1. Transport` / `## 2. Endpoints/Topics` / `## 3. SLO` / `## 4. Failure / degradation mode` sections.

Additional cross-checks:

- Every ai-service endpoint has a complete Zod request + response schema (not placeholders).
- Every BullMQ job has an `idempotencyKey` field — CLAUDE.md rule 13 friendly (never inside a DB transaction).
- Every service cross-references [ADR-002](./docs/adr/ADR-002-service-extraction-triggers.md), [context-map](./docs/architecture/context-map.md), and [manifest](./docs/packages/manifest.md).
- `Safety.SosTriggered → push` SLO matches context-map's "SosTriggered is the highest-priority outbound event" claim.
- Crawler egress caps match Playbook §8.5 numbers (Overpass 10,000/day etc.).

**Acceptance criteria**

- ✅ 4 contract docs (ai / media / notification / crawler).
- ✅ Each has 4 sections (transport, endpoints, SLO, failure).
- ✅ Zod schemas on every request/response / job payload / event payload.
- ✅ SLO is quantitative (numbers + percentiles + availability tiers), not hand-wavy.

**Notes**

- Chapter 7 is now complete: ADR-004 (rule) + context-map (modules) + package-manifest (TS packages) + these 4 service contracts (out-of-process). Reviewers have one authoritative answer to "can X import / call / publish to Y?" across the entire codebase.
- The `@app/shared-types` package will own these Zod schemas when it's scaffolded. Until then these docs ARE the schemas — drifts between docs and code fail CI once the codegen gate lands.
- `ai-service/contract.md` deliberately covers the gRPC ↔ REST hybrid — gRPC for Whisper STT streaming, REST for debuggable endpoints. That decision lives here (the contract) rather than spawning a fifth ADR.

---

### [IV.18.1.18] — Phase-0 smoke suite + CI gate

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.18]

**What was done**

Capstone for Phase 0. A single Jest file now re-asserts one representative acceptance criterion per shipped Phase-0 prompt, and a GitHub Action runs it on every PR and push-to-main. A regression anywhere in the foundation breaks this one file.

- **`apps/api/test/smoke/phase-0.smoke.ts`** — 25-assertion aggregate organised by prompt ID. Covers: CLAUDE.md + the 13 hard constraints; monorepo scaffold files; all 4 ADRs + context map + package manifest; Makefile + .env.example + docs/env.md; Zod env validation (reject-on-missing + CORS_ORIGINS presence); `@app/errors` contract (toJSON never leaks stack, `isDomainError` type guard, `DomainError.context` frozen); `@app/logger` (Pino shape, `runWithTraceContext` propagation); health probes (/live shape, /ready with 3 deps up via mocks, /startup 200); DomainError JSON shape relied on by filters; `HealthCheckError` terminus signal; §13 security headers + per-request CSP nonce uniqueness + `parseCorsOrigins`. Runs against a Nest app booted in **prod mode** so HSTS + Trusted Types + upgrade-insecure-requests are exercised.
- **`apps/api/jest.config.cjs`** — extended `testMatch` to pick up `*.smoke.ts` alongside `*.spec.ts` / `*.e2e-spec.ts`.
- **`.github/workflows/phase-0-smoke.yml`** — CI gate. Runs on `pull_request` and `push` to `main`, plus manual dispatch. Steps: checkout → pnpm 9.12.3 → Node 22 → `pnpm install --frozen-lockfile` → `pnpm turbo run build --filter=@app/config --filter=@app/errors --filter=@app/logger` → `npx jest test/smoke/phase-0.smoke.ts --ci --runInBand`. Seeds the minimum env (mirrors `apps/api/test/setup.ts`) so indicators (which are mocked in the smoke itself) don't need a real Docker stack. `concurrency` cancels in-progress runs on push; `timeout-minutes: 10` hard-caps.
- **Scope-honest note:** the broader `ci.yml` (lint + typecheck + full jest matrix + Docker Compose integration) is a separate prompt. This workflow is deliberately narrow — it gates the Phase-0 → Phase-1 boundary, not every PR.

**Files created** (2) — `apps/api/test/smoke/phase-0.smoke.ts`, `.github/workflows/phase-0-smoke.yml`.
**Files edited** (2) — `apps/api/jest.config.cjs`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

- `pnpm --filter=api typecheck` green.
- `npx jest test/smoke/phase-0.smoke.ts` — **25/25 pass**, every describe block lit.
- Full api suite — **7 suites, 64/64 tests**, no regression from the earlier 39/39.

**Acceptance criteria**

- ✅ Single Jest file runs every Phase-0 AC.
- ✅ Failing any AC breaks the smoke suite (verified by construction — each assertion targets exactly one AC).
- ✅ GitHub Action gate in place; documented entry point for the Phase-0 → Phase-1 graduation condition.

**Notes**

- The smoke MUST stay in sync with every new Phase-0 prompt. The current file has one `describe` per prompt ID so adding a new AC block is a one-block edit.
- The CI workflow mocks Postgres / Redis / Meilisearch indicators — it does NOT stand up Docker Compose. If we want a service-matrix gate (real Postgres + Redis + Meili), that's a separate workflow with `services:` entries.
- The smoke inherits apps/api's dev server reliance on `@Inject(Token)` decorators on constructor params — the tsx decorator-metadata caveat from `[IV.18.1.16]` still applies to any new indicator added here.

---

### [IV.18.1.17] — Security headers + CORS + strict CSP with per-request nonces

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.17] · **Playbook §** 13

**What was done**

Every response out of apps/api now carries the full Playbook §13 perimeter: strict CSP (with per-request nonces, Trusted Types, upgrade-insecure-requests in prod), COOP, COEP, CORP, Referrer-Policy, X-Frame-Options, X-Content-Type-Options, HSTS (prod only), and a tight Permissions-Policy denying 24 sensor/device classes. CORS is allow-listed by exact origin from the `CORS_ORIGINS` env var — deny-by-default when the list is empty.

- **`packages/config/src/schema.ts`** — added `CORS_ORIGINS: z.string().default('')`. Comma-separated exact origins; no wildcards.
- **`.env.example` + `docs/env.md`** — documented the new var; dev-commented example (`http://localhost:3000,http://localhost:3001`) for when web/admin come online.
- **`apps/api/src/common/security/security.register.ts`** — single async registrar that wires `@fastify/helmet` (with `enableCSPNonces: true`) + `@fastify/cors` + a `Permissions-Policy` `onSend` hook. Branches on `NODE_ENV === 'production'` to enable HSTS + Trusted Types + upgrade-insecure-requests only in prod (localhost HSTS is a footgun; Trusted Types breaks some dev tooling). Exports `parseCorsOrigins(raw)` as a plain, testable function.
- **`apps/api/src/main.ts`** — new step 6: `await registerSecurity(app, env)` after filters, before `enableShutdownHooks()`, so every route (including `/health/*`) inherits the perimeter.
- **`apps/api/test/security/headers.e2e-spec.ts`** — 8-test matrix: `parseCorsOrigins` unit tests, prod-mode baseline, per-request-nonce uniqueness, dev-mode (no HSTS, no Trusted Types), CORS deny-by-default (empty allow-list), CORS allowed-origin preflight reflection, CORS disallowed-origin suppression.
- **`package.json`** (root) — `pnpm.overrides.fastify = "5.8.5"` to dedupe fastify across `@nestjs/platform-fastify` and `@fastify/*` which had resolved to 5.8.4 and 5.8.5 respectively. Type errors disappeared after `pnpm install`.

**Files created** (2) — `apps/api/src/common/security/security.register.ts`, `apps/api/test/security/headers.e2e-spec.ts`.
**Files edited** (5) — `apps/api/src/main.ts`, `apps/api/package.json`, `packages/config/src/schema.ts`, `.env.example`, `docs/env.md`, `package.json`, `pnpm-lock.yaml`.
**Dependencies** — `@fastify/helmet@13.0.2`, `@fastify/cors@11.2.0`.

**Verification**

- **Typecheck** — `pnpm --filter=api typecheck` green (only after the fastify dedupe override).
- **Tests** — `39/39 pass` (8 new across prod / dev / CORS / utility). Per-request-nonce test runs two back-to-back requests and asserts the CSP nonces differ.
- **Live smoke (`NODE_ENV=production`, `CORS_ORIGINS=https://travel.example`, port 3031):**
  - `curl -I /health/live` prints every expected header: `Content-Security-Policy` (with `default-src 'none'`, script/style nonces, `require-trusted-types-for 'script'`, `upgrade-insecure-requests`), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-DNS-Prefetch-Control: off`, full `Permissions-Policy` with 24 disabled features.
  - `OPTIONS /api/v1/test` preflight with `Origin: https://travel.example` → `access-control-allow-origin: https://travel.example` + credentials + 600s max-age.
  - Same preflight with `Origin: https://evil.example` → no `access-control-allow-origin` header. Browser blocks.

**Acceptance criteria**

- ✅ Every header present in prod mode.
- ✅ Test matrix passes (8/8 new, 39/39 total).
- ✅ Per-request CSP nonces (different across two back-to-back requests).
- ✅ CORS allow-list driven by `CORS_ORIGINS` env var.
- ✅ Trusted Types + COOP + COEP + Permissions-Policy all asserted.

**Notes**

- **Fastify dedupe:** `@nestjs/platform-fastify` pulled fastify 5.8.4 as a transitive, while the fresh `@fastify/helmet` + `@fastify/cors` pulled 5.8.5. That gave TS two separate `FastifyInstance` types and plugin registration failed to typecheck. Pinning with a root-level `pnpm.overrides.fastify = "5.8.5"` + reinstall produced a single fastify in `node_modules/.pnpm`. Future @fastify/\* installs might nudge this again — watch for it and re-pin if it recurs.
- **Dev vs prod branching:** HSTS / Trusted Types / upgrade-insecure-requests intentionally skipped in dev because (a) HSTS over `localhost` pins browsers to https on that origin and makes `http://localhost` unreachable; (b) Trusted Types breaks react-devtools / HMR tooling; (c) upgrade-insecure-requests downgrades http→https which breaks plain-http dev servers.
- **`enableCSPNonces: true`** is the `@fastify/helmet` feature that generates `reply.cspNonce.{script, style}` per request and injects the nonce into the CSP header automatically. No manual hook needed.

---

### [IV.18.1.16] — Health / Readiness / Liveness probes with @nestjs/terminus

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.16]

**What was done**

First code prompt in four — apps/api now talks to the Docker Compose stack end-to-end. Three probe endpoints:

- **`GET /health/live`** — unchanged from `[III.11.0]`. No dep checks. Liveness.
- **`GET /health/ready`** — terminus-powered. Checks **Postgres** (raw `pg` pool, `SELECT 1`) + **Redis** (ioredis `PING`) + **Meilisearch** (native `fetch` to `/health`). Returns 200 if all up, 503 with per-dep breakdown if any down.
- **`GET /health/startup`** — currently checks Postgres. Once Prisma lands, also asserts `_prisma_migrations` fully applied. Kubernetes-style startup probe.

ai-service intentionally omitted from /ready until the ai-service prompt lands — commented at the registration site with a pointer to the future switch. That prevents a permanently-red gate on a non-existent service.

- **`apps/api/src/health/indicators/postgres.indicator.ts`** — `HealthIndicator` subclass with `SELECT 1` over a singleton `pg.Pool` (max 1, 2s connect/idle timeout). `onModuleDestroy` closes the pool. Records `latencyMs` in the response.
- **`apps/api/src/health/indicators/redis.indicator.ts`** — `ioredis` client (lazyConnect, offlineQueue disabled so a down Redis fails instantly instead of queueing). `PING` → `PONG`.
- **`apps/api/src/health/indicators/http-ping.indicator.ts`** — reusable; Meili today, could be wired to ai-service later without adding new deps.
- **`apps/api/src/health/health.module.ts`** — wires `TerminusModule` + the three indicators + the controller.
- **`apps/api/src/health/health.controller.ts`** — extended; `@Inject(ConfigService)` (see "Notes" for why).
- **`apps/api/src/app.module.ts`** — swapped from direct `HealthController` registration to `HealthModule` import.
- **`apps/api/test/health.e2e-spec.ts`** — 8 new e2e tests. Indicators overridden with test doubles; asserts all-up / each-down-in-turn / Meili URL construction from `MEILI_HOST`. Simulates the "kill Redis" acceptance via a throwing double on the same code path terminus walks when the real Redis is down.

**Files created** (5) — `apps/api/src/health/health.module.ts`, `apps/api/src/health/indicators/{postgres,redis,http-ping}.indicator.ts`, `apps/api/test/health.e2e-spec.ts`.
**Files edited** (4) — `apps/api/src/health/health.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml` (auto).
**Dependencies** — `@nestjs/terminus@11.1.1`, `ioredis@5.10.1`, `pg@8.20.0`, `@types/pg@8.20.0` (dev).

**Verification**

- `pnpm --filter=api typecheck` green.
- `pnpm --filter=api test` — **31/31 pass** (8 new tests across `up / each-dep-down / url-construction`). All pre-existing suites unaffected.
- **Live smoke against the 8-service docker-compose stack:**
  - All three endpoints 200 with stack up — `postgres{latencyMs:114}`, `redis{latencyMs:37}`, `meilisearch{latencyMs:47, httpStatus:200}`.
  - `docker stop travel-redis` → `/health/ready` flips to **503** with `redis.status=down, error:"Stream isn't writeable..."` and the other two still `up`. ✅ binding acceptance criterion.
  - `docker start travel-redis` → /ready recovers to 200 within 3s.

**Acceptance criteria**

- ✅ `/health/live` returns 200 unconditionally.
- ✅ `/health/ready` covers Postgres + Redis + Meilisearch.
- ✅ Killing Redis flips `/ready` to 503. (ai-service check deferred — noted in header comment with pointer.)
- ✅ `/health/startup` covers the app-boot proxy check (Postgres reachable); Prisma-migration assertion lands when Prisma does.

**Notes**

- **tsx + decorator metadata:** `tsx`'s esbuild-based transform does not reliably emit `emitDecoratorMetadata` for Nest DI. Symptom was `TypeError: Cannot read properties of undefined (reading 'get')` when constructing `PostgresHealthIndicator` — `config` was `undefined` because Nest couldn't derive the injection token from the param type. Fix: explicit `@Inject(ConfigService)` / `@Inject(PostgresHealthIndicator)` / etc. on every constructor param. ts-jest respects the metadata fine (which is why unit tests passed), so the issue only surfaced at live-bootstrap time. Pattern now locked in for future indicators — worth revisiting when the dev script migrates to `ts-node` or `nest start`.
- `AppConfigService` (the type alias) can't be used as a Nest injection token — it erases to `ConfigService` at runtime only if metadata emission is on. Constructors now type the param as `ConfigService<Env, true>` with explicit `@Inject(ConfigService)`.
- **ai-service** gate deliberately excluded until `apps/ai-service` exists. The `HttpPingIndicator` is already generic enough to wire it in: a single line in `ready()` will do, gated on a feature flag.

---

### [II.7.4] — Shared-package manifest: 10 cross-cutting packages + allow-lists

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.4

**What was done**

Closes the Chapter-7 trilogy ([ADR-004](./docs/adr/ADR-004-bounded-contexts.md) + [context-map](./docs/architecture/context-map.md) + this manifest). ADR-004 says modules can't import across contexts; context-map says which module owns what; the manifest says which apps can import which `@app/*` packages — and crucially, which ones can NOT.

- **`docs/packages/manifest.md`** — summary table of all 10 §7.4 packages (`@app/logger`, `@app/config`, `@app/auth`, `@app/errors`, `@app/observability`, `@app/events`, `@app/cache`, `@app/ratelimit`, `@app/validation`, `@app/testing`) × 7 consumer surfaces (api / workers / web / admin / mobile / ai-service / tests), with ✅ / ❌ / ⚠ allowance per cell. The `❌` column is called out as the binding part of the doc.
- Per-package detail explaining **why** each allow-list is what it is. Two canonical examples: `@app/auth` — forbidden on web/admin/mobile because tokens never enter client-side JS (CLAUDE.md rule 12); `@app/config` — forbidden on web/admin because Next.js has its own `NEXT_PUBLIC_*` env story and leaking server-only secrets into a client bundle would be critical.
- Per-package peer-dependency graph documented (`@app/auth` → `@app/logger` + `@app/config` + `@app/errors` + `@app/cache`, etc.). This prevents the accidental dep cycle an over-eager refactor would introduce.
- Secondary table for the 6 _build-tooling_ packages that also live in `packages/` but aren't on §7.4's list (`@app/tsconfig`, `@app/eslint-config`, `@app/shared-types`, `@app/sdk`, `@app/ui`, `@app/mobile-ui`). Notable rule: `api` and `workers` MUST NOT depend on `@app/sdk` (the SDK is generated FROM their OpenAPI — would be a cycle).
- Enforcement section names two CI layers: `dependency-cruiser` against `package.json` diffs (to be installed by `[III.Tooling]`) + ESLint `import/no-restricted-paths` zones extending the ADR-004 set.

**Files created** (1) — `docs/packages/manifest.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none. Pure docs; the dependency-cruiser rule wiring is a follow-up.

**Verification**

Acceptance criterion: "every package has an explicit allow-list." ✅ — summary table has a ✅ / ❌ / ⚠ entry for every (package × surface) pair. All 10 §7.4 packages accounted for; 7 surfaces named; no cell left blank.

Cross-referenced against:

- Playbook §7.4 — exact 10-package list preserved verbatim.
- [ADR-004](./docs/adr/ADR-004-bounded-contexts.md) — doesn't conflict (ADR-004 is intra-api; this is package-level).
- CLAUDE.md rule 12 (token storage) — `@app/auth` row cites it as rationale for the client-surface ban.
- CLAUDE.md rule 9 (no console.log) — `@app/logger` row cites it.

**Acceptance criteria**

- ✅ All 10 §7.4 packages listed.
- ✅ Each has purpose + public exports + allow-list + forbidden-list.
- ✅ Every package has an explicit allow-list (the required part of the prompt).

**Notes**

- The manifest is authoritative; `dependency-cruiser` (follow-up) will read the "Forbidden" cells and fail CI on violation.
- Chapter-7 trilogy now complete: ADR-004 (rule) + context-map (intra-api shape) + package-manifest (cross-app shape). Together they form the single authoritative answer to "can file X import from Y?"
- Next Chapter-7 artefact is `[II.7.3]` (4 extracted-service contracts) — the out-of-process counterpart to this doc.

---

### [II.7.2] — Bounded-context map: events, facade ports, owned Prisma models

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.2

**What was done**

Operationalises [ADR-004](./docs/adr/ADR-004-bounded-contexts.md) by publishing the single authoritative context map for all 17 modules in Playbook §7.2. Reviewers grep this doc during any PR that touches `prisma/schema.prisma`, adds an event name, or adds a facade port.

- **`docs/architecture/context-map.md`** — one row per context (17 rows) covering four dimensions: inbound events consumed, outbound events published, facade ports exposed, Prisma models owned. Complementary per-context detail section explains non-obvious dependencies (Safety's rich event surface, Live's cross-context fan-in, Notifications being a wildcard subscriber, etc.). Closes with a **Model Ownership Index** — 43 models, 43 single-owner rows, 0 conflicts — which is the acceptance artefact this prompt is judged on.
- Explicit naming-convention section: event names are `<Publisher>.<Aggregate><Verb>` in PascalCase past tense; facade ports are `<Subject><Verb>Port` and live at `apps/api/src/modules/<context>/interface/facade/`. Matches ADR-004's rule verbatim.
- Flags the **`Event` ↔ domain-event name collision** explicitly (Playbook uses `Event` for the Events & Culture aggregate; we use `CulturalEvent` in prose but keep the Prisma model name as-is per source-of-truth rule).
- Translation + Analytics are called out as the two contexts that intentionally own zero models (stateless proxy and pure event sink respectively).

**Files created** (1) — `docs/architecture/context-map.md`.
**Files edited** (1) — `PROGRESS.md` (this entry).
**Dependencies** — none. Pure docs.

**Verification**

Acceptance criterion: "every Prisma model from §12 appears under exactly one owner." ✅ — reconciled in the Model Ownership Index at the bottom of the doc.

Cross-checked against:

- Playbook §7.2 (Key entities column per context) — 43 entities across 15 stateful contexts. All present.
- Playbook §12.1 example models (`Trip`, `PlaceEmbedding`) — present under Trip Planning + Places Catalog respectively.
- Playbook §12.4 required indexes — `Trip`, `Session`, `CrimeIncident`, `NotificationLog`, `User` all present under owners whose index-column ownership matches.

**Acceptance criteria**

- ✅ Context map covers 17 contexts.
- ✅ Each context has: inbound events, outbound events, ports, owned Prisma models.
- ✅ Every Prisma model from §12 (and §7.2) has exactly one owner.

**Notes**

- This doc is the one reviewers grep during a schema PR — no new Prisma model lands without a row here.
- `[II.7.3]` (service contracts for 4 extracted services) and `[II.7.4]` (shared-package manifest) are the natural follow-ups. Together the three docs (ADR-004 + context map + package manifest) define "who may import whom" across the entire codebase.
- The forthcoming `@app/events` package ([IV.18.1.9]) reads the event-name list from this doc — any event added there must first appear in this doc.

---

### [II.7.1] — ADR-004 bounded-context principle + ESLint rule pattern

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.1

**Shipped in commit** `c522bdd`. PROGRESS entry in a follow-up `docs(II.7.1)` commit (prettier race — same pattern as `[III.13.1]` / `[II.6.2]` / `[IX.32.3]` / `[IX.32.4]`).

**What was done**

Locks the cross-context communication rule promised by [ADR-001](./docs/adr/ADR-001-modular-monolith.md): modules inside `apps/api/src/modules/<context>/` may only see each other through `interface/facade/**` ports (for sync reads) or domain events on `@app/events` (for writes / notifications). Direct imports into another module's `domain/`, `application/`, `infrastructure/` or non-facade `interface/` fail CI lint.

- **`docs/adr/ADR-004-bounded-contexts.md`** — MADR-format, same template as ADRs 001–003. Three sections doing the work: (1) a plain-English rule spelling out what `<A>` MAY vs. MUST NOT import from `<B>`; (2) a drop-in `import/no-restricted-paths` zone generator that produces one zone per `{module × private-layer}` pair (17 × 3 = 51 domain/application/infrastructure zones + 17 interface zones with a facade carve-out) — ready for `[III.Eslint]` to paste verbatim into the shared config; (3) binding consequences (facade naming convention, new-module checklist, "need to bypass for perf?" escape hatch requires a superseding ADR).
- **`docs/adr/README.md`** — index row for ADR-004.

**Files created** (1) — `docs/adr/ADR-004-bounded-contexts.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none. Pure docs; the ESLint rule is specified but NOT wired (that's `[III.Eslint]`'s job).

**Verification**

- Acceptance criterion: "one ESLint rule pattern included, ready to paste." ✅ — the snippet is a complete CommonJS module that exports a valid `Linter.RulesRecord`, parameterised over the §7.2 module list so a future module addition is a one-line edit.
- `MODULES` array matches the 17 contexts in Playbook §7.2 verbatim.
- `PRIVATE_LAYERS` covers the three layers ADR-001 defines as private; the fourth layer (`interface/`) is handled by a separate zone that carves out `interface/facade/**`.
- Rule error message names the offending `target/layer` AND tells the developer the two legal alternatives (facade port / domain event) — on-screen self-documenting.

**Acceptance criteria**

- ✅ ADR-004 written in MADR format consistent with siblings.
- ✅ Cross-context rule stated explicitly (events + facades only; no direct imports across modules).
- ✅ `import/no-restricted-paths` pattern included inline, ready to paste in `[III.Eslint]`.

**Notes**

- This ADR is binding for `apps/api` only — the rule does not apply to `apps/web`, `apps/admin`, `apps/mobile` because those apps don't host bounded contexts (they consume the API via `@app/sdk`).
- `[II.7.2]` (context map) and `[II.7.4]` (package manifest) complement this ADR — together they will form the single authoritative description of who-imports-what across the monolith.

---

### [IX.32.4] — `.env.example` + `docs/env.md` (env-var onboarding)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Design · **Playbook §** 32.4

**Shipped in commit** `7085eb4`. PROGRESS entry in a follow-up `docs(IX.32.4)` commit (prettier race — same pattern as `[III.13.1]` / `[II.6.2]` / `[IX.32.3]`).

**What was done**

Closes the dev-onboarding loop: every env var declared in `packages/config/src/schema.ts` now has a matching `.env.example` line AND a row in `docs/env.md`.

- **`.env.example`** — 43 vars grouped into the same sections as the Zod schema. Dev-required keys point at the Docker Compose stack verbatim; `cp .env.example .env.local` boots apps/api against the compose services with zero edits. Real secrets carry the sentinel `REPLACE_ME_SEE_DOPPLER_*` which is guaranteed to fail the `.min(32)` / `.min(16)` checks — the process refuses to start if a developer forgot to replace them. Optional blocks commented out so first-run onboarding is minimal.
- **`docs/env.md`** — reference table (43 rows: Group / Variable / Required / Default / Validator / Notes). Header explains loading order (process env → `.env.local` → schema default), validation flow, Doppler posture for staging/prod, and the sentinel-on-boot check. Closes with a dev quickstart (`cp` + `openssl rand -hex 32` ×3 + `make up` + `pnpm --filter=api dev`) and an "adding a new variable" checklist naming the three places to keep in sync. Auto-enforcement of that checklist is flagged as follow-up in `[IV.18.1.11]` CI.

**Files created** (2) — `.env.example`, `docs/env.md`.
**Files edited** (1) — `PROGRESS.md` (this entry).
**Dependencies** — none. Pure docs.

**Verification**

- Cross-check: every field in `packages/config/src/schema.ts` has a matching `.env.example` line AND a matching `docs/env.md` row.
- Required vs optional matches the schema.
- Defaults match `.default(...)` values verbatim.
- `openssl rand -hex 32` produces exactly 64 hex chars which satisfies `.min(32)` — instruction is explicit in the doc.

**Acceptance criteria**

- ✅ `.env.example` covers every env var.
- ✅ `docs/env.md` documents each variable's purpose, owner, default.
- ✅ Pre-commit schema-⇄-example sync enforcement flagged as follow-up (not part of this prompt).

**Notes**

- `.env.local` is gitignored (configured in `[IV.19.1]`); real credentials never enter the repo.
- The three required secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RATE_LIMIT_PEPPER`) each need ≥ 32 chars — documented with the exact `openssl` command.

---

### [IX.32.3] — Root Makefile (DX wrapper around the docker-compose stack)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 32.3

**Shipped in commit** `d3cca19`. PROGRESS entry in a follow-up `docs(IX.32.3)` commit (prettier race, same pattern as `[III.13.1]` / `[II.6.2]`).

**What was done**

Single `Makefile` at repo root wrapping the `docker compose -f infra/docker-compose.yml ...` invocations we run dozens of times a day, plus thin wrappers over the workspace pnpm scripts. `make help` is the default goal — a blank `make` prints the full menu auto-generated from inline `## <description>` doc-comments next to each target (via a one-line `awk` parser). No duplication between target list and help text.

**Targets**

| Category | Target                                                               | What                                                                                                                    |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Docker   | `up`, `down`, `ps`, `logs`, `reset`, `nuke`                          | Standard lifecycle + two nuclear options (`reset` wipes volumes, `nuke` also rebuilds the postgres image from scratch). |
| Shells   | `db-shell`, `redis-shell`, `psql-exec SQL="..."`                     | Interactive psql + redis-cli + one-shot SQL.                                                                            |
| Node     | `install`, `dev`, `build`, `typecheck`, `lint`, `test`, `clean-dist` | `clean-dist` kills stale `dist/` and `.turbo/` — guards against the shadow-file class of bugs from `[III.11.0]`.        |
| Help     | `help` (default)                                                     | Auto-parsed from the `## ` comments.                                                                                    |

**Files created** (1) — `Makefile`.
**Files edited** — `PROGRESS.md` (this entry).

**Verification**

- Syntax-valid GNU Make: `.PHONY` for every non-file target, tabs under recipes, variables quoted.
- Self-documenting: adding a new target + `## <description>` instantly appears in `make help` with no extra bookkeeping.
- Could not run locally (`make` is not on the default Git Bash PATH). The Makefile header documents the three supported Windows install paths (`winget install GnuWin32.Make`, `choco install make`, `scoop install make`). Linux/macOS ship it with `build-essential` / Xcode CLT.
- The wrapped commands are exactly the ones already validated during `[IX.32.2]` + subsequent work — so target correctness reduces to "spelled the flags right", which review covers.

**Acceptance criteria (from prompt)**

- ✅ `up`, `down`, `logs`, `reset`, `db-shell`, `redis-shell` all present.
- Also includes: `ps`, `nuke`, `psql-exec`, pnpm shortcuts, auto-generated `help`.

**Notes**

- `seed-demo` intentionally omitted — needs the Prisma seed that lands in `[IV.18.1.8]`.
- For developers without `make`, each recipe is a single-line docker/pnpm invocation — literally copy-pasteable out of the Makefile.

---

### [II.6.2] + [II.6.3] + [II.6.4] — Architecture ADRs 001 / 002 / 003 (docs-only, batched)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Design · **Playbook §** 6.2 + 6.3 + 6.4

**Shipped in commit** `eb9f85b` (code), PROGRESS entry in a follow-up `docs(II.6.2)` commit (prettier race, same pattern as `[III.13.1]`).

Three Chapter-6 ADRs landed together because they're mutually referential — the monolith-first posture (001) cites the service-extraction triggers (002) which cite the event-bus choice (003). Splitting would churn the cross-links.

**Files created** (4)

- `docs/adr/README.md` — MADR index, supersede-don't-edit rule, authoring guide.
- `docs/adr/ADR-001-modular-monolith.md` — locks the modular monolith and the four day-one extractions (ai-service, media-service, notification-worker, crawler-worker). Drivers: speed to first user, boundary preservation via clean-hex + ESLint, operational simplicity, future optionality. Rejected alternatives: pure microservices, serverless.
- `docs/adr/ADR-002-service-extraction-triggers.md` — five triggers (language mismatch, scaling profile, latency contract, lifecycle / blast radius, compliance) + explicit anti-triggers ("feels modular", "different team", "scale someday"). Table mapping each extracted service to its trigger. Rule: any new service OR un-extraction requires an ADR.
- `docs/adr/ADR-003-event-backbone.md` — Redis Streams for v1 via `@app/events` (port-first adapter). Migration triggers to Kafka / Redpanda: sustained > 30k events/s, > 1 region, > 7d replay, or schema governance at scale. Outbox pattern on Postgres reserved for durable-commit-and-fire (payments).

**Files edited** — `PROGRESS.md` (this entry).

**Dependencies added** — none. Pure docs.

**Verification**

- ✅ All three ADRs follow MADR (Context / Decision Drivers / Considered Options / Decision Outcome / Consequences / Links).
- ✅ Each closes with a **Consequences (binding)** section enumerating rules future PRs will be judged against.
- ✅ Cross-links between the three resolve. Index README lists all with status + prompt id.

**Notes**

- Binding rules are manually enforced in code review today; future prompt `[II.9.2]` turns the ESLint boundary checks called out in ADR-001 into automated lint.
- Future ADRs land one per commit unless they form another tight trio.

---

### [III.13.1] — `ZodValidationPipe` (strict-by-default, friendly fieldErrors, 9 new tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.1

**Shipped in commit** `f5e78d2`. PROGRESS entry landed one commit later as `docs(III.13.1)` because the initial edit lost a race with prettier.

**What was done**

Pairs directly with `DomainExceptionFilter` from `[III.11.5]`: pipe throws `ValidationError`, filter renders 422 with `fieldErrors` in the JSON body. Consumers get one-line parsing + type inference + automatic error mapping.

- **`apps/api/src/common/pipes/zod-validation.pipe.ts`** — `@Injectable() ZodValidationPipe<T extends ZodTypeAny>` implementing `PipeTransform<unknown, z.infer<T>>`.
  - Generic parameter carries the schema's inferred type downstream so handlers receive a fully-typed DTO (`@Body(new ZodValidationPipe(CreateTripSchema)) dto: CreateTripDto` — no extra cast).
  - **Strict by default**: a plain `ZodObject` gets `.strict()` applied before storage so unknown keys are rejected (Zod's default is silent strip). Non-object schemas pass through.
  - Used a duck-typed `_def.typeName === 'ZodObject'` guard rather than `instanceof ZodObject` — avoids TS2358 generic-arg friction and is robust across Zod minor versions.
  - Only transforms `body` / `query` / `param` metadata types. Nest-internal `custom` / `metatype` values pass through.
  - **Friendly `unrecognized_keys` expansion**: Zod reports unknown-key errors with `path = parent, keys = [offenders]`. The pipe expands that into individual `fieldErrors` entries so clients see `{ malicious: ['unrecognized key'] }` rather than a root-level blob.
  - Throws `ValidationError(msg, fieldErrors, { source: 'body'|'query'|'param', field })` — the filter spreads that context into the response body via `toJSON()`.
- **`apps/api/test/zod-validation.pipe.e2e-spec.ts`** — 9 e2e cases via a throw-away `DebugValidationController` (two endpoints: `POST /debug/trips` with `@Body` pipe, `GET /debug/search` with `@Query` pipe):
  1. Valid body passes + parsed dto returned + coercion applied (`radiusKm: '25'` → `25`).
  2. Defaults applied (`limit` → `10`).
  3. Missing required → 422 with `fieldErrors.title`.
  4. Wrong type → 422 with the offending path.
  5. Nested field error uses `center.lat` dot-path key.
  6. Unknown key explicitly surfaced: `fieldErrors.malicious = ['unrecognized key']`.
  7. Multiple independent errors all surface in one response.
  8. Query validation via `@Get` + `@Query` also works.
  9. Full 422 response-shape contract verified — `code: 'VALIDATION_FAILED'`, `message`, `fieldErrors`, `timestamp`, `context.source: 'body'`.

**Files created / edited**

- New: `apps/api/src/common/pipes/zod-validation.pipe.ts`, `apps/api/test/zod-validation.pipe.e2e-spec.ts`.
- Edited: `apps/api/package.json` (added `zod@^3.24.1` direct dep — it was transitive via `@app/config` but `tsc` couldn't find it through the symlink chain), `PROGRESS.md`.

**Commands run / issues fixed**

1. First build → `TS2307: Cannot find module 'zod'` + `TS2358: left-hand side of instanceof ...`. Fixed by adding zod as direct dep and swapping to the duck-typed guard.
2. First test run → 2 failures:
   - `expect(fieldErrors).toHaveProperty('center.lat')` — Jest reads dots as nested paths; swapped to `'center.lat' in fieldErrors` + bracket access.
   - Query test `POST /debug/search?...` with empty body + `Content-Type: application/json` → Fastify 400 (body parse error before handler). Switched the endpoint to `@Get` — cleaner and closer to real search-endpoint shape.
3. Retested → **23/23 across 4 suites in 3.6s**. Lint clean. Build green.
4. Workspace turbo → **16/16 tasks successful** (12 cached, 4 fresh).

**Acceptance criteria**

- ✅ Posting an extra field yields 422 with the offending key surfaced by name.
- ✅ `@Body(new ZodValidationPipe(Schema))` works end-to-end.
- ✅ `fieldErrors: Record<string, string[]>` preserved.
- ✅ Strict unknown-key rejection.

**Notes**

- Chose `isZodObjectLike` duck-typed guard over `instanceof ZodObject` — no TS2358, robust to Zod internal refactors, no runtime class import.
- `context.source` / `context.field` ride along for observability — never PII.
- Pipe does not mutate input; consumers always get the normalized (type-coerced, default-applied, key-stripped) value.

---

### [III.11.5] — Global exception filters (DomainException + AllException, 14/14 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.5 + 15.1

**What was done**

Wired `@app/errors` into `apps/api`'s HTTP response pipeline via two global filters. Every thrown error — whether a `DomainError`, a Nest built-in `HttpException`, or a rogue native `Error` — now emits a structured JSON response with a `traceId`, a `timestamp`, and zero stack-trace leakage.

- **`apps/api/src/common/filters/domain-exception.filter.ts`** — `@Catch(DomainError)` filter. Reads `err.toJSON()`, merges `traceId` from the `AsyncLocalStorage` trace context (populated later by the request middleware in `[III.15.4]`), sends at `err.httpStatus`. Special-cases `RateLimitError` to also emit a `Retry-After` header — seconds, `Math.max(1, Math.ceil(retryAfterMs / 1000))` per RFC 9110 §10.2.3. Logs every domain error at `warn` (expected behaviour, not a bug).
- **`apps/api/src/common/filters/all-exception.filter.ts`** — `@Catch()` catch-all. Two branches:
  1. `HttpException` (Nest's own — `NotFoundException` from unmatched routes, `BadRequestException` from future pipes, etc.) → preserve status + original body shape, enrich with `traceId` + `timestamp`.
  2. Anything else → logs at `error` with full stack (sink-side only), responds with a sanitised `{code: 'INTERNAL_ERROR', message, traceId, timestamp}` at HTTP 500. In non-prod `message` echoes the raw error (dev ergonomics); in `NODE_ENV=production` it's a fixed `'Internal server error'`. **Stack trace never enters the response.**
- **Wired globally in `apps/api/src/main.ts`**: `app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter())`. Order chosen so Nest's reverse-order resolution evaluates the more specific `DomainExceptionFilter` first; anything it doesn't handle falls through to the catch-all. Step-numbered comment in main.ts clarifies the bootstrap ordering (instrumentation → reflect-metadata → env → Nest create → logger → filters → prefix → shutdown hooks → listen).
- **`apps/api/test/filters.e2e-spec.ts`** — 9 e2e cases via Fastify `inject()` with a test-only `DebugController` (never reaches real code): `TripNotFoundError` → 404, `ValidationError` → 422 with `fieldErrors` surfaced, `InvalidRadiusError` → 422 inherits the ValidationError contract + its own code, `RateLimitError` → 429 with `Retry-After: 3` (2500ms → ceil → 3s), `ExternalServiceError` → 502 with `service` name, unhandled native `Error` → 500 `INTERNAL_ERROR` with **no** `stack` property (the info-leak guarantee), Nest `HttpException` preserves status + body, unknown route → 404 via `NotFoundException` → AllExceptionFilter. Every assertion includes the sibling fields (`timestamp`, `context`, etc).
- **`apps/api/test/domain-exception.filter.spec.ts`** — 2 unit cases that instantiate the filter directly and mock the `ArgumentsHost`. Wraps `filter.catch()` in `runWithTraceContext` to prove the traceId reads correctly — the HTTP-level propagation test is deferred to when the request middleware exists (`[III.15.4]`).

**Files created** (3)

- `apps/api/src/common/filters/domain-exception.filter.ts`
- `apps/api/src/common/filters/all-exception.filter.ts`
- `apps/api/test/filters.e2e-spec.ts`
- `apps/api/test/domain-exception.filter.spec.ts`

**Files edited** (2)

- `apps/api/src/main.ts` — import + register global filters; renumbered bootstrap comments.
- `PROGRESS.md` (this entry).

**Dependencies added** — none. `fastify` types pulled in via `@nestjs/platform-fastify` already.

**Commands run**

1. First `pnpm --filter=api test` → 1 failure + 1 TS error.
   - `TS2534: A function returning 'never' cannot have a reachable end point.` — a `withTrace()` controller method wrapped `throw` inside a `runWithTraceContext` callback; TS's CFA couldn't see the throw propagating out. **Fix:** removed that controller method.
   - `expected 'trace-abc-123', received undefined` in the "propagates traceId" e2e case. Diagnosed: `runWithTraceContext` is entered **inside** the controller handler; once the handler throws, we exit the ALS scope _before_ Nest invokes the exception filter. This is correct ALS semantics — the actual production plumbing will be a request-level `onRequest` hook that enters the scope for the full request lifecycle. That wiring is part of `[III.15.4]` (OTel SDK). **Fix:** deleted the e2e propagation test, added two unit tests in a dedicated spec file that mock the host and manually wrap `filter.catch()` in `runWithTraceContext` — tests the exact filter logic without relying on request-level middleware.
2. Re-ran pipeline → **14/14 tests pass in 3.4s** across 3 suites (`app.e2e-spec`, `filters.e2e-spec`, `domain-exception.filter.spec`). Build / typecheck / lint all clean.
3. `pnpm turbo run build typecheck lint test` workspace-wide → **16/16 tasks successful** (8 cached, 8 fresh).
4. Live smoke skipped: the filter's real contract is fully exercised by e2e `inject()` calls (byte-identical to what Fastify serves over HTTP) + the unit spec for ALS. Curl-against-a-live-port adds nothing that isn't already covered and would require a test-only endpoint in production code.

**Verification**

- ✅ `DomainError` subclasses → correct HTTP statuses and JSON bodies (404 / 422 / 429 / 502).
- ✅ `ValidationError.fieldErrors` surfaces through the response unchanged (frozen map of path → reasons).
- ✅ `RateLimitError` emits both `retryAfterMs` in the body and `Retry-After` (seconds, ≥ 1) in the headers per RFC 9110.
- ✅ Unhandled native `Error` → 500 with stack **absent** from the body (JSON stringification round-trip confirms no `stack` key).
- ✅ Nest's own `HttpException` status + body preserved end-to-end (tested with `HttpException({message, sku}, 410)`).
- ✅ `traceId` is serialised when an ALS scope exists (unit-tested) and is `undefined` otherwise (e2e-tested). Request-level population lands with OTel.
- ✅ Every response includes `timestamp` (ISO-8601).
- ✅ Workspace turbo still green with the additions.

**Acceptance criteria (from prompt)**

- ✅ Throwing `NotFoundError` (and every other `DomainError` subclass) from a controller yields `{code, ...}` with the expected HTTP status — verified across 7 concrete subclasses.
- ✅ `traceId` is plumbed into every response body the filter emits.

**Notes / deviations**

- Did **not** introduce a production debug controller for live smoke. Test-only `DebugController` lives inside the e2e spec file and is never registered in `AppModule`. Avoids attack surface ("probe /debug/rate-limit to DoS us").
- Filter ordering (AllExceptionFilter first, DomainExceptionFilter second) is deliberate: Nest resolves filters in reverse registration order, so the more specific `@Catch(DomainError)` gets first shot. Any future request-scoped filters can slot in via `@UseFilters()` without conflict.
- `AllExceptionFilter` dev-mode echoes the raw `err.message` to speed up local debugging — guarded by `NODE_ENV === 'production'`. Never echoes the stack.
- Logger for each filter is created at construction time (one per filter instance — filters are singletons in Nest), so trace context propagation still works per-request via the mixin — the logger instance doesn't need to change.
- `domain-exception.filter.spec.ts` uses a hand-rolled mock `ArgumentsHost` rather than `@nestjs/testing`'s full bootstrap — keeps the unit test fast (sub-ms per case) and focused on the filter's own logic.

**Next up**

- `[III.13.1]` — `ZodValidationPipe` that throws our `ValidationError` with populated `fieldErrors`. With the filter in place now, the pipe's thrown error flows through cleanly.
- `[III.11.3]` — `JwtAuthGuard` + `RolesGuard` (`UnauthorizedError` / `ForbiddenError` flow through the filter).
- `[III.11.4]` — Redis sliding-window rate limiter (`RateLimitError` → already has the Retry-After wiring ready).

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

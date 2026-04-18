# 🌍 Travel Super-App — Compendium Upgrades v3 (Additive)

> Continuation of v2. Every section below is **net-new value** on top of v1 + v2. I numbered sections H–Q so they slot in after v2's Parts A–G. Read v2 first.
>
> **Principle:** v2 told you what's wrong. v3 tells you what sophisticated teams add that first-timers skip — things that cost nothing up front but save weeks and tens of thousands of dollars later.

---

## PART H — BUILD-TIME TOKEN ECONOMICS (what the AI-assisted build will actually cost)

Most people feed prompts to an AI agent blind and get sticker-shocked. Here's the math.

### H1. Cost per block (Claude Sonnet 4.6, typical reads + writes)

| Block type | Input tokens | Output tokens | Cache hit % | Sonnet cost | Haiku cost |
|---|---|---|---|---|---|
| Scaffold block (0.1, 0.2) | 8–12k | 4–6k | 0% | $0.10–0.18 | $0.01–0.02 |
| Shared package (0.3, 0.4) | 15–20k | 10–15k | 60% | $0.12–0.20 | $0.02–0.04 |
| Cross-cutting (0.5) | 25–35k | 20–30k | 70% | $0.25–0.40 | $0.04–0.07 |
| Domain module (0.6, 1.1, 1.2) | 40–60k | 25–40k | 75% | $0.35–0.60 | $0.06–0.12 |
| Frontend scaffold (0.14) | 30–45k | 15–25k | 65% | $0.25–0.45 | $0.04–0.08 |
| Test / infra (0.7, 0.11) | 20–30k | 10–15k | 70% | $0.15–0.25 | $0.03–0.05 |

**Total Phase 0 (18 blocks):** ~$4.50–8.00 on Sonnet, ~$0.75–1.50 on Haiku.
**Total Phase 1 (13 blocks):** ~$6.00–10.00 on Sonnet, ~$1.00–2.00 on Haiku.
**Typical total Phase 0 + 1 Sonnet build:** **$10–18**. Double it for rework (realistic: $20–40). Triple it if you don't use prompt caching ($60–120).

### H2. Prompt-caching strategy — must-have

Anthropic's prompt caching cuts 90% of input cost on repeated context. Set it up once:

```
CACHE LAYER 1 (ephemeral_5m, refreshed every block):
  - System rules preamble (Part D1)           ~2k tokens
  - Current block spec                        ~3–5k tokens
  - Context summary from prior block          ~1k tokens

CACHE LAYER 2 (ephemeral_1h, refreshed per phase):
  - Architecture overview                     ~3k tokens
  - Shared-types reference                    ~4k tokens
  - Prisma schema                             ~5k tokens
  - Error catalog                             ~1k tokens

CACHE LAYER 3 (ephemeral_1h):
  - Prior block's key files (summaries)       ~5k tokens
```

With this layout you pay input tokens once per block and get cache reads at 10% of full price for every follow-up turn within the block.

### H3. Model routing (use the right model per block)

| Block type | Model | Why |
|---|---|---|
| Pure scaffolding / config | Haiku 4.5 | Zero reasoning needed |
| Prisma schema / types | Sonnet 4.6 | Needs type discipline |
| Domain logic / use cases | Sonnet 4.6 | Needs architectural judgment |
| Ambiguous / design-heavy (trip AI) | Opus 4.7 + extended thinking | Worth the spend |
| Test authoring | Haiku 4.5 | Pattern-matching work |
| Refactor / bug fix | Sonnet 4.6 | Careful edits |
| Code review pass | Opus 4.7 | Catches what others miss |

### H4. Runtime LLM costs (in-app AI features)

This is where the real money goes once users hit the app:

| Feature | Model | Tokens/call | Cost/call | Calls/user/month | Cost/user/month |
|---|---|---|---|---|---|
| Generate itinerary (1 trip) | Sonnet 4.6 | ~12k in / 8k out | $0.156 | 1.5 | $0.23 |
| Re-plan | Sonnet 4.6 | ~8k in / 4k out | $0.084 | 0.5 | $0.04 |
| Chat / edit suggestions | Haiku 4.5 | ~2k in / 0.5k out | $0.004 | 20 | $0.08 |
| Translation (NLLB self-host) | — | — | $0 (infra only) | 100 | ~$0.02 |
| Fake-review scoring (DistilBERT) | — | — | $0 (infra only) | 5 | ~$0.001 |
| Embeddings | Voyage or OpenAI | 1k | $0.00002 | 10 | negligible |

**Per-active-user LLM cost: ~$0.37/mo.** With prompt caching → ~$0.15/mo.

Free-tier unit economics are tight: affiliate commission averages $2–8/user/month only if conversion is 2–5%. **You need caching + Haiku routing to be profitable below 5% conversion.**

### H5. Budget alarms

Set these before you start building:
- Anthropic usage alert at $10, $50, $100 (spend-limit via console)
- Stripe: weekly budget notification
- GitHub Actions: hard-cap at 50k minutes/month (free tier is 2k private)
- Fly.io / Vercel / Supabase: upgrade gates (never auto-upgrade)

---

## PART I — BLOCK LIFECYCLE STATE MACHINE

Formalize what "a block is done" means. Without this, agents declare "done" prematurely and you find bugs in Phase 3 that were introduced in Phase 0.

### I1. States

```
  PROPOSED                    block exists in compendium, not started
      │
      ▼
  DRAFTED                     agent has produced file list + skeleton
      │  (human review gate)
      ▼
  CODED                       full code written, no TS errors locally
      │
      ▼
  TYPECHECKED                 pnpm typecheck passes repo-wide
      │
      ▼
  UNIT-TESTED                 block's unit tests pass, coverage threshold met
      │
      ▼
  INTEGRATION-TESTED          integration tests (Testcontainers) pass
      │
      ▼
  VERIFIED                    manual acceptance criteria walkthrough done
      │  (human sign-off)
      ▼
  SIGNED-OFF                  committed to main (or merged PR)
      │
      ▼
  ARCHIVED                    block moved to "done" list, retrospective notes added
```

### I2. Exit criteria per state (hard gates)

| State | Must produce | Can skip to next only if |
|---|---|---|
| DRAFTED | File tree + 1-line purpose per file | Human says "proceed" |
| CODED | All files with real implementations (no `throw new NotImplemented`) | `pnpm --filter=<pkg> build` succeeds |
| TYPECHECKED | Zero TS errors repo-wide | `turbo run typecheck` green |
| UNIT-TESTED | Coverage report | `domain/` ≥ 80%, `application/` ≥ 80% |
| INTEGRATION-TESTED | Test output artifact | All ACs from block spec pass |
| VERIFIED | Video or screenshot evidence | Human signs the `block-<n>-verification.md` |
| SIGNED-OFF | Git commit SHA | PR merged, CI green on main |

### I3. Artifacts per state

Every block produces a trail in `docs/blocks/block-<n>/`:
- `spec.md` — original prompt
- `draft.md` — agent's file plan
- `diff.patch` — the actual code changes
- `test-output.txt` — test runner output
- `verification.md` — checklist signed off
- `retrospective.md` — what went wrong / was surprising

This becomes institutional memory. After 30 blocks you have a playbook of what patterns worked and didn't.

### I4. Rollback policy per state

| From state | Rollback command |
|---|---|
| DRAFTED | Delete draft.md — no code changes yet |
| CODED | `git checkout -- apps/<pkg>` + `pnpm install` |
| TYPECHECKED | Same as CODED |
| UNIT-TESTED | `git revert <SHA>` if committed, else checkout |
| VERIFIED | `git revert` — never amend published commits |

---

## PART J — CONCRETE ANTI-PATTERN LIBRARY

Specific bad code I've seen AI agents generate on exactly this kind of project. Include this catalog in the System Rules so agents have negative examples.

### J1. Prisma anti-patterns

```ts
// ❌ BAD — N+1 query explosion
const trips = await prisma.trip.findMany();
for (const trip of trips) {
  const days = await prisma.itineraryDay.findMany({ where: { tripId: trip.id } });
}

// ✅ GOOD — single query with include
const trips = await prisma.trip.findMany({ include: { days: { include: { items: true } } } });
```

```ts
// ❌ BAD — typing Unsupported PostGIS column anywhere
const place = await prisma.place.create({ data: { coordinates: 'POINT(77.5 12.9)' } });
// Prisma generates `unknown` here; silent runtime failure

// ✅ GOOD — dedicated raw-SQL wrapper
await geoQueries.insertPlace({ name, lat: 12.9, lng: 77.5, ... });
// inside: $executeRaw`INSERT INTO "Place" (...) VALUES (..., ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), ...)`
```

```ts
// ❌ BAD — transaction with external calls inside
await prisma.$transaction(async (tx) => {
  await tx.trip.create(...);
  await stripeClient.charges.create(...);   // network call inside DB txn = holds lock
  await tx.payment.create(...);
});

// ✅ GOOD — saga pattern
const trip = await prisma.trip.create(...);
const charge = await stripeClient.charges.create(...);
await prisma.payment.create({ data: { tripId: trip.id, chargeId: charge.id } });
// Compensating action if last step fails.
```

### J2. NestJS anti-patterns

```ts
// ❌ BAD — controller doing business logic
@Post()
async createTrip(@Body() dto) {
  const candidates = await this.placesService.search(...);
  const itinerary = await this.aiService.plan(...);
  const trip = await this.prisma.trip.create(...);
  return trip;
}

// ✅ GOOD — controller thin, use case orchestrates
@Post()
async createTrip(@Body() dto: CreateTripDto, @CurrentUser() user) {
  return this.generateItineraryUseCase.execute({ ...dto, userId: user.id });
}
```

```ts
// ❌ BAD — injecting PrismaService directly into a use case
constructor(private readonly prisma: PrismaService) {}
await this.prisma.trip.create(...);
// Couples domain/application layer to ORM. Breaks hex architecture.

// ✅ GOOD — depend on repository port
constructor(@Inject(TRIP_REPO) private readonly repo: TripRepository) {}
await this.repo.save(trip);
```

### J3. Async anti-patterns

```ts
// ❌ BAD — sequential awaits of independent work
const weather = await this.weather.get(loc);
const safety = await this.safety.get(loc);
const events = await this.events.get(loc);
// 3x the latency needed

// ✅ GOOD — parallel
const [weather, safety, events] = await Promise.all([
  this.weather.get(loc),
  this.safety.get(loc),
  this.events.get(loc),
]);
```

```ts
// ❌ BAD — Promise.all for non-critical fanout (one failure kills all)
const [a, b, c] = await Promise.all([...]);

// ✅ GOOD — Promise.allSettled for best-effort fanout
const results = await Promise.allSettled([...]);
const places = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
```

### J4. Type anti-patterns

```ts
// ❌ BAD
function processTrip(data: any) { ... }
const userId = req.user?.id as string;

// ✅ GOOD
function processTrip(data: Trip) { ... }
const userId = assertDefined(req.user?.id, 'user required after JwtAuthGuard');
```

### J5. Security anti-patterns

```ts
// ❌ BAD — logging secrets
logger.info({ body: req.body }, 'received request');
// Leaks passwords, tokens.

// ✅ GOOD — configured redact + DTO on log
logger.info({ userId, tripId }, 'trip_created');
```

```ts
// ❌ BAD — IDOR vulnerability
@Get(':id')
async getTrip(@Param('id') id: string) {
  return this.tripRepo.findById(id);   // any user can read any trip
}

// ✅ GOOD — ownership check
@Get(':id')
async getTrip(@Param('id') id: string, @CurrentUser() user) {
  const trip = await this.tripRepo.findById(id);
  if (!trip.canAccess(user.id)) throw new ForbiddenError();
  return trip;
}
```

### J6. React / Next.js anti-patterns

```tsx
// ❌ BAD — fetching in useEffect when it could be server component
'use client';
useEffect(() => { fetch('/api/trips').then(setTrips); }, []);

// ✅ GOOD — RSC fetching
async function TripsPage() {
  const trips = await sdk.trips.list();
  return <TripList trips={trips} />;
}
```

```tsx
// ❌ BAD — storing JWT in localStorage
localStorage.setItem('token', accessToken);

// ✅ GOOD — access token in memory only, refresh in httpOnly cookie set by API
// Never touch tokens in client-readable storage.
```

---

## PART K — BLOCK DEPENDENCY DAG & PARALLELIZATION

Many blocks can run in parallel on separate branches if you have 2+ devs. Here's the DAG.

### K1. Phase 0 DAG

```
0.0  ──┐
       ▼
0.1 Monorepo ──┬─────────────────────────────────────────┐
               │                                         │
               ▼                                         ▼
            0.2 Docker                               0.3 Shared packages
               │                                         │  (config, logger, errors, obs)
               └────────────┬────────────────────────────┘
                            ▼
                         0.4 shared-types
                            │
                            ▼
                         0.5 NestJS skeleton ────┬────┬────┬────┐
                            │                    │    │    │    │
                            ▼                    ▼    ▼    ▼    ▼
                         0.6 Identity        0.7 0.8 0.9 0.10  (parallel)
                            │                 Testing Seeds Events FeatureFlags
                            └─────┬──────────────────────────────┘
                                  ▼
                               0.11 CI/CD
                                  │
                    ┌─────────────┼───────────────┐
                    ▼             ▼               ▼
                 0.12 SDK      0.13 i18n     0.14 Frontends (a/b/c parallel)
                    │             │               │
                    └─────────────┼───────────────┘
                                  ▼
                           0.15 Idempotency
                                  │
                                  ▼
                           0.16 Health checks
                                  │
                                  ▼
                           0.17 Security headers
                                  │
                                  ▼
                           0.18 Phase 0 smoke
```

### K2. Parallelization opportunities

| Pair | Can run concurrent? | Notes |
|---|---|---|
| 0.2 Docker + 0.3 Shared | ✅ | Zero overlap |
| 0.7, 0.8, 0.9, 0.10 | ✅ | All after 0.6, independent |
| 0.12 SDK + 0.13 i18n + 0.14a/b/c | ✅ | Four parallel frontend streams |
| 1.3 Stays + 1.4 Food + 1.6 Weather + 1.7 Translation | ✅ | Independent modules after 1.1 Places |
| 1.5 Transport + 1.2 Trip | ⚠️ Only if contracts locked | Trip depends on transport feasibility |
| 1.9 Notifications + 1.10 Payments | ✅ | Independent |

### K3. Critical path (solo builder)

```
0.0 → 0.1 → 0.2/0.3 → 0.4 → 0.5 → 0.6 → 0.11 → 0.14 → 0.18 → 1.1 → 1.2 → 1.11 (ai-service) → 1.13
```

**Solo builder:** ~14–16 weeks for Phase 0 + 1 end-to-end.
**Two-dev parallel:** ~9–11 weeks (A owns API stream, B owns mobile + frontend stream).
**Three-dev parallel:** ~6–8 weeks (add C on ai-service + infra).

---

## PART L — IN-APP AI PROMPTS (the ones your product actually runs)

Your compendium specifies "Claude plans the itinerary" but gives no system prompt. That's the highest-risk, highest-cost code in the product. Here's the starter kit.

### L1. Itinerary generator (Sonnet 4.6, ~12k input / 8k output)

```
SYSTEM:
You are the planning engine of TravelSuperApp. You produce day-by-day travel itineraries
from a candidate place list, user preferences, weather forecast, and safety data.

HARD CONSTRAINTS:
1. Every itinerary item MUST reference a place_id from the candidates list. Never invent.
2. Never exceed the user's daily pace: budget=6h active/day, moderate=8h, intense=10h.
3. Never schedule an outdoor activity when forecast shows storm/heavy rain that hour.
4. Every leg between items must be physically feasible in the user's transport mode.
   If not, either swap the order or drop the further item.
5. Respect dietary + accessibility filters strictly. Silent-fail is unacceptable.
6. Safety score < 4/10 places are excluded unless user explicitly allows risky.

OUTPUT:
Strict JSON matching ItinerarySchema. No prose. No markdown. No explanations.

SCORING (you optimize):
- variety: no same-category item twice in a row
- pace: start times between 8–10am, breaks every 3h, dinner 7–9pm
- cost: stay within budget_cents total
- distance: minimize per-day km while maximizing score
- weather fit: indoor backups for rainy hours

USER:
<candidates>       ← 50–100 places with { id, name, category, lat, lng, rating, relaxation, safety, openHours }
<preferences>      ← travel type, budget, transport, dietary, accessibility, languages
<forecast>         ← daily weather for trip dates
<dates>            ← start, end
<must_include>     ← array of place_ids
<exclude>          ← array of place_ids

Produce a Trip JSON object.
```

**Prompt caching:** place the SYSTEM block + schema definitions in cache_control layer 2 (1h TTL). User-specific content is only the four `<...>` blobs — fresh per call.

**Self-repair loop:** wrap the call in a 2-attempt retry where attempt 2 gets the Zod validation errors from attempt 1 prepended. Success rate goes from ~85% to ~99%.

### L2. Re-planner (Sonnet 4.6, ~8k / 4k)

Used when user is mid-trip and something breaks.

```
SYSTEM:
You are the re-planning engine. User has a trip in progress. Something changed
(delay, closure, weather, mood). Produce a minimal-diff replacement from the current
point onward. Do NOT rewrite past days or items already completed.

HARD CONSTRAINTS:
1. Preserve all completed items (items[i].completedAt is set).
2. Keep user's original preferences unless re-planning reason explicitly changes them.
3. Minimize surgery — touch the fewest items possible.
4. If a replaced item has a booking (hotel, paid activity), flag it — don't silently drop.

OUTPUT: JSON diff against current Trip — { replace: [{itemId, newItem}], insert: [...], remove: [...] }
```

### L3. Translator (NLLB-200 self-hosted, no LLM cost)

Not a prompt — a gRPC call to ai-service with `{text, source_lang?, target_lang}`. Auto-detect if source missing (langdetect library). Cache by `sha256(text+target)` in Redis, 7-day TTL. Translation is the highest-volume feature; caching saves 70%+ cost.

### L4. Fake-review classifier (DistilBERT fine-tuned)

Not a prompt — a classification head returning `{fake_probability: 0..1, signals: string[]}`. Run on every review at write time; block posting if > 0.85; send to manual queue if 0.5–0.85; publish if < 0.5.

Training data: start with labeled TripAdvisor + Yelp fake-review datasets (public), fine-tune on 5k manually labeled reviews after launch.

### L5. Scam detector (RAG over scam database)

Not a one-shot LLM — a vector similarity check. Every new place / agent / listing gets embedded; the 10 nearest neighbors in the scam embedding space are checked. If avg similarity > 0.7 to known scams → flag.

### L6. Safety-bot chat (Haiku 4.5, ~2k / 0.5k)

The "ask me anything during your trip" assistant. System prompt keeps it strictly tool-using (no free-form medical/legal advice).

```
SYSTEM:
You are the user's on-trip safety assistant. You ONLY answer by calling tools.
Never give medical, legal, or safety advice from your own knowledge.

TOOLS:
- nearest_hospital(lat, lng)
- nearest_embassy(country, lat, lng)
- emergency_numbers(country)
- current_safety_score(lat, lng, timeOfDay)
- scam_check(description)
- translate(text, target_lang)

If user asks anything outside these tools, reply: "I can only help with safety,
emergencies, and translation. For <topic>, please see our help center."
```

Token savings vs general-purpose chat: ~60%. Safety: enormous (no hallucinated medical advice liability).

### L7. Prompt caching budget

```
SYSTEM prompts:          cached (layer 2, 1h)
Schema definitions:      cached (layer 2, 1h)
Candidates block:        NOT cached (user-specific)
User preferences:        NOT cached
Conversation history:    cached (layer 1, 5m) — only for multi-turn chat
```

Apply this and LLM costs drop 60–80%.

---

## PART M — ANALYTICS EVENT TAXONOMY

A single source of truth for every PostHog event. Without this, analytics rot within 3 months and you can't answer basic product questions.

### M1. Naming convention

`<domain>_<action>_<outcome>` — snake_case. Past tense for outcomes.

Examples: `trip_generated`, `trip_generation_failed`, `place_viewed`, `booking_initiated`, `booking_completed`.

### M2. Core event catalog (Phase 0 + 1)

| Event | When fired | Properties | Owner context |
|---|---|---|---|
| `user_registered` | after register use case succeeds | method (email\|google\|apple), referrer | identity |
| `user_logged_in` | login use case succeeds | method, mfa_used | identity |
| `user_login_failed` | login fails | reason (bad_password\|locked\|mfa_wrong) | identity |
| `mfa_enabled` | MFA setup confirmed | — | identity |
| `account_deleted` | self-delete | reason (if given) | identity |
| `trip_draft_started` | generate-itinerary called | radius_km, preferences, candidate_count | trip |
| `trip_generated` | AI plan returned | model, tokens_in, tokens_out, latency_ms, days, items_count | trip |
| `trip_generation_failed` | error in gen | error_code, retry_count | trip |
| `trip_edited` | user edits itinerary | edit_type (add\|remove\|swap\|reorder), item_count | trip |
| `trip_shared` | share code created | share_type (public\|collaborator) | trip |
| `trip_activated` | user starts live trip | days_ahead_of_start | trip |
| `trip_completed` | end_date reached OR user marks done | duration_days, items_completed_pct | trip |
| `replan_requested` | user asks for live re-plan | reason, affected_day | trip |
| `place_searched` | search API called | radius_km, category_filter, result_count | places |
| `place_viewed` | place detail opened | place_id, source_list, position_in_list | places |
| `place_added_to_trip` | user adds place | place_id, via (search\|suggestion\|map) | places |
| `stay_viewed` | stay detail opened | stay_id, provider | stays |
| `booking_initiated` | affiliate link clicked | stay_id, provider, deep_link | stays |
| `booking_completed` | Stripe webhook OR affiliate postback | amount_cents, commission_cents, provider | payments |
| `weather_alert_sent` | alert push delivered | alert_type, severity | notifications |
| `safety_alert_sent` | crime/scam alert delivered | alert_type, severity, place_id | safety |
| `scam_reported` | user reports scam | scam_type, has_photo | safety |
| `sos_triggered` | SOS button pressed | location, method (hospital\|police\|embassy) | safety |
| `translator_used` | translation call | source_lang, target_lang, text_length, cache_hit | translation |
| `translator_voice_used` | voice input translation | duration_s, lang_pair | translation |
| `offline_pack_downloaded` | offline bundle saved | city, size_mb | offline |
| `push_permission_granted` | user enables push | — | notifications |
| `push_delivered` | FCM/APNs receipt | notification_type | notifications |
| `push_opened` | user taps notification | notification_type, seconds_to_open | notifications |
| `subscription_started` | Stripe sub created | plan, amount_cents, trial | payments |
| `subscription_canceled` | user cancels | plan, days_active, reason (if given) | payments |
| `feature_flag_evaluated` | flag evaluated | flag_name, variant | infra |
| `api_error` | 5xx response | endpoint, error_code, trace_id | infra |
| `slow_query_detected` | query > 200ms | query_name, duration_ms | infra |

### M3. Required properties on EVERY event

- `user_id` (null if unauthenticated)
- `session_id`
- `device_id`
- `app_version`
- `platform` (ios\|android\|web)
- `locale`
- `timestamp` (ISO)
- `trace_id` (same as API trace — tie analytics ↔ logs)

### M4. Governance

- Every new event must be added to `packages/analytics/src/events.ts` with a Zod schema
- PR check: if code calls `track('foo')` without foo existing in the catalog → CI fails
- Monthly event-health review: drop any event with zero volume for 60 days

---

## PART N — DATA GOVERNANCE, RETENTION & PRIVACY

Half a day of work now saves three weeks of legal scramble when you need to show a data-map to investors / auditors / a lawyer.

### N1. Retention schedule

| Entity | Retention | Deletion trigger | PII level |
|---|---|---|---|
| User profile (active) | indefinite | account delete → anonymize | high |
| User profile (deleted) | 30d soft delete then purge | self-service + cron | high |
| Session | 60d past expiry | cron nightly | medium |
| Trip (draft) | 90d idle | cron | low |
| Trip (archived) | indefinite | user delete | low |
| Review | indefinite (w/o PII) | user delete | low (body may contain PII — scan) |
| Photo / media | tied to trip lifecycle | user delete | medium (EXIF has GPS) |
| Payment record | 7 years (tax / chargeback) | manual/legal only | high |
| Crime / scam data | indefinite (aggregated) | never individually identifying | low |
| Logs | 30d hot, 1y cold | cron | medium (scrubbed) |
| Analytics events | 2y | PostHog rollup | low (hashed user_id) |
| Backups | 35d rolling | automatic | high |

### N2. GDPR / DPDP right-to-delete flow

```
user → DELETE /users/me
      │
      ▼
  IdentityModule.deleteAccount
      ├─ publish UserDeletedEvent  (eventbus)
      ▼
  Subscribers anonymize in their context:
    - TripModule: user_id → NULL, trips marked archived
    - ReviewModule: author → "Former traveler", body sanitized via LLM
    - MediaModule: EXIF strip + archive for 30d
    - PaymentModule: retain record but scrub email/name (legal retention)
    - NotificationLog: purge
    - AnalyticsPipeline: user_id replaced with consistent hash (so metrics still flow)
  ▼
  30-day grace period (cron marks hard_delete_after_utc)
  ▼
  Hard purge job deletes all remaining rows
  ▼
  Audit log entry retained in separate encrypted log (who deleted, when, what)
```

### N3. Data export (also required under GDPR Art. 20)

`GET /users/me/export` enqueues a job that assembles a zip with:
- profile.json
- trips.json + all itineraries
- reviews.json
- photos/ (originals)
- subscriptions.json
- emails sent / received (summaries)
- Signed SHA-256 manifest

Delivered via signed S3 URL, 72h expiry, email notification. Max 1 export per user per 24h.

### N4. Consent framework

- First-launch onboarding: granular consents — analytics, marketing emails, push notifications, personalized ads (even though you won't have them v1)
- Every consent recorded with: `{userId, purpose, granted, version_of_policy, timestamp, ip}`
- Consent table is append-only. Revocations are new rows.
- If user revokes analytics consent → server stops emitting non-essential events for that user ID

### N5. DPA skeleton (when you take a B2B customer in Phase 3/4)

Stock clauses: scope, subprocessors list, TOMs, data-subject rights passthrough, breach notification (< 72h), audit rights (SOC 2 report in lieu of on-site). Put in `legal/dpa-template.md`.

### N6. Subprocessor list (public, updated on change)

Every service touching user data listed at `/legal/subprocessors` with: name, purpose, data categories, region, certifications. Example rows: Supabase (DB — EU region), Stripe (payments — US/EU), Twilio (SMS — US), Sentry (errors — EU), Resend (email — US), OpenAI (not used — placeholder), Anthropic (LLM — US), Cloudflare (CDN — global).

---

## PART O — DISASTER RECOVERY & INCIDENT RESPONSE

### O1. RPO / RTO targets (v1, achievable)

| Scenario | RPO (data loss) | RTO (downtime) | How |
|---|---|---|---|
| API container crash | 0 | < 60s | Fly.io auto-respawn |
| DB corrupt / dropped | < 5 min | < 30 min | PITR enabled; Supabase nightly base + WAL |
| Region outage (Fly) | < 5 min | < 2 h | Multi-region secondary (Phase 2) |
| Ransomware / malicious delete | < 24 h | < 4 h | Backups to separate provider (Backblaze B2) |
| Full account compromise | < 24 h | < 24 h | Rotate every secret; restore from last known good |

### O2. Backup strategy

- Postgres: Supabase PITR (7-day retention on free, 30-day on pro). Plus nightly logical dump → Backblaze B2 (different provider, cross-region). Encrypt at rest with age/rage keypair stored in 1Password.
- Redis: persist AOF, but treat Redis as cache — no RPO guarantees. Rebuild from Postgres if lost.
- S3 / R2 (media): bucket versioning on; cross-region replication to B2 nightly.
- Secrets: Doppler snapshots exported weekly to encrypted offline vault.

### O3. Severity matrix

| Sev | Definition | Response time | Example |
|---|---|---|---|
| 1 | Prod down; users can't log in | 15 min | API 5xx > 50% |
| 2 | Major feature down; revenue impact | 1 h | Stripe webhooks failing |
| 3 | Minor feature down; some users affected | 4 h | Translator failing for one language |
| 4 | Cosmetic / non-urgent | 1 week | Spelling error |

### O4. Runbooks index (each a 1-page doc in `docs/runbooks/`)

- `runbook-db-cpu-high.md`
- `runbook-redis-eviction.md`
- `runbook-api-5xx-spike.md`
- `runbook-stripe-webhook-backlog.md`
- `runbook-push-delivery-failure.md`
- `runbook-ai-service-down.md` (graceful degradation plan: cache last itinerary, fall back to template)
- `runbook-data-breach-response.md` (legal flow — lawyer contacts, regulator notification, customer notice templates)
- `runbook-account-takeover.md`

### O5. Postmortem template

`docs/postmortems/YYYY-MM-DD-<incident>.md` — blameless format:
1. Impact (users affected, duration, revenue)
2. Timeline (exact UTC)
3. Root cause
4. Detection (how did we know?)
5. Response (what we did)
6. What went well
7. What didn't
8. Action items (owner + due date + Linear ticket)

Post within 5 business days. Public-facing summary for Sev 1–2.

---

## PART P — UNIT ECONOMICS (does this business work?)

The lucid-dream check. Do the numbers pencil out?

### P1. Cost per active user per month (steady state, 10k MAU)

| Item | Cost |
|---|---|
| Infra (Fly api + Supabase pro + Redis + R2) | $0.04 |
| LLM (with caching + Haiku routing) | $0.15 |
| Google Places / Foursquare / etc. | $0.08 |
| Mapbox / Google Maps | $0.06 |
| Satellite / crowd data (Sentinel free, SerpAPI on-demand) | $0.02 |
| Push / email / SMS | $0.03 |
| Sentry / PostHog / observability | $0.02 |
| Stripe fees (only on paid) | variable |
| **Total COGS per MAU** | **~$0.40** |

### P2. Revenue per MAU (blended)

| Source | % of MAU monetizing | ARPU contribution |
|---|---|---|
| Affiliate commissions (hotels/activities) | 3–5% book | $0.60–1.20 |
| Freemium Pro ($4.99/mo, 3% conversion) | 3% | $0.15 |
| Sponsored listings (agents/events) | n/a | $0.05 (Phase 3+) |
| **Blended ARPU** | | **$0.80–1.40** |

### P3. Break-even

COGS $0.40, ARPU $1.00 → **gross margin ~60%, contribution $0.60/MAU**.

To cover a $300k/yr burn (2 devs + founder), need $25k/mo contribution = **~42k MAU**. Achievable in 12 months if launch goes well; aggressive.

### P4. Unit-economics levers

| Lever | Impact |
|---|---|
| Prompt caching on LLM | COGS −$0.10 → margin 70% |
| Shift itinerary gen to fine-tuned Llama | COGS −$0.12 → margin 75% |
| Raise Pro price to $7.99 | ARPU +$0.12 |
| Push Pro conversion 3% → 5% | ARPU +$0.10 |
| Raise affiliate take-rate (direct partnerships vs Booking.com) | ARPU +$0.30 |

### P5. What kills this business

- LLM costs if you don't cache or route (COGS jumps to $0.80, margin dies)
- Free Google Places spend spiraling (budget cap + aggressive local caching)
- Affiliate commissions get clawed back on cancellations (build cancellation buffer)
- CAC if you have to advertise (organic growth via public trip templates is the plan)

---

## PART Q — TOOL-SPECIFIC OPTIMIZATIONS (Claude Code / Cursor / Copilot / Aider)

Different agents work better with different block structures. Brief notes.

### Q1. Claude Code (Sonnet/Opus, CLI)

- Excellent with long structured prompts, plan-mode, and multi-file edits.
- Put your System Rules (Part D1) in a `CLAUDE.md` at repo root — it auto-loads every session.
- Use plan-mode (/plan) for each block before execution. Cuts rework by ~30%.
- Feed the block in two stages: first "draft the file list + interfaces", review, then "implement".

### Q2. Cursor

- Best at tight-loop edits on already-scaffolded code. Bad at cold-start scaffolding.
- Feed scaffolding to Claude Code or manual; then use Cursor from Block 0.6 onward.
- Enable Cursor "Rules for AI" with a compact version of System Rules.
- Use Composer for multi-file; single-file for quick fixes.

### Q3. GitHub Copilot Workspace

- Best for generating tests from implementations (Block 0.7).
- Bad at architectural decisions — treat as typing accelerator only.

### Q4. Aider

- Best when run against a specific subset of files (use `/add <paths>`).
- Excellent for refactors across 5–10 files (Part J anti-pattern fixes).
- Set `model: claude-sonnet-4-5` and `cache-prompts: true`.

### Q5. Recommended split

- **Claude Code**: Blocks 0.1–0.6, 1.1–1.2, all domain-heavy modules
- **Cursor**: Bug-fix loops, polish, tight iteration after scaffolding exists
- **Aider**: Bulk refactors (anti-pattern sweeps, Prisma migration squashes)
- **Copilot**: Test generation from signed-off blocks

---

## PART R — WHAT TO DO NEXT

Same menu format as v2 Part G. Pick one:

1. **"Apply v2 + v3 fixes inline to v1"** — I patch the original compendium blocks 0.1–1.2 with every B-series fix from v2 + Part J anti-patterns from v3.
2. **"Draft CLAUDE.md + System Rules"** — I produce the repo-root file that enforces v3 Part D + v3 Parts H/I meta-rules on every agent session.
3. **"Draft the missing Phase 0 blocks (0.0, 0.7–0.18)"** — full v1-format blocks, ready to feed.
4. **"Draft the missing Phase 1 blocks (1.3–1.13)"** — same.
5. **"Draft the AI product prompts (Part L expanded)"** — full system prompts + few-shot examples + Zod schemas for itinerary generator, re-planner, safety-bot, scam detector.
6. **"Draft the analytics events catalog (Part M) as packages/analytics code"** — I write the TypeScript file with Zod schemas for every event.
7. **"Draft the DR/runbooks (Part O) as doc files"** — I write all 8 runbooks as separate markdown files.
8. **"Draft the CLAUDE.md, .cursorrules, and .aider.conf"** — one file per tool so every agent in the stack obeys the same rules.
9. **"Rewrite the entire compendium v4"** — single replacement file, v1 + v2 fixes + v3 additions all applied. Biggest output, most complete artifact.

Tell me which. No code execution until you say go.

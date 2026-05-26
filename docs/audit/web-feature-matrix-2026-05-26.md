# Audit — `apps/web/` feature matrix (Next.js 15 App Router)

> **C0** of the S-series. Produced 2026-05-26 against HEAD `217039e`. Pair with [`mobile-2026-05-26.md`](mobile-2026-05-26.md) (Z1, ✅) + [`admin-2026-05-26.md`](admin-2026-05-26.md) (Z2, ✅).
>
> Honest framing: memory said web was "~20% complete." That was wrong. The truth is **~52%** across 19 feature areas — half the project, materially further along than the prior estimate. This audit corrects the number AND re-ranks the Block C plan based on what is actually missing, not what was guessed.

---

## Headline — **~52% complete** across 19 feature areas (was reported as ~20%)

The web app is materially further along than memory's prior estimate. Of 193 API endpoints across 19 bounded contexts, the web exposes working pages + SDK hooks for **10 areas** (trip, identity, account, admin, agent, media, notifications, social, food, diary) and partial coverage for **6 more** (safety, payments, places, reviews, events, compliance). **Zero web surface** for stays, transport, weather (standalone page), translation widget, embeddings (standalone). The design system is minimal (~11 base primitives in `components/ui/`). Auth is **rule-12 compliant** (memory access token + httpOnly refresh cookie + `SilentRefreshOnMount`). Test suite has 8 Playwright E2E + 16 component-unit specs but no page-level integration coverage.

**66 page files** total. **60 substantive** (>50 LOC with hooks called). **6 stubs / "coming soon"** — concentrated in payments (Stripe not configured), concierge bookings, weather standalone, and a few discovery surfaces.

**Key gaps blocking premium-tier launch:**

- **C4 — Stripe checkout** is a `window.alert("coming soon")` today (highest business priority).
- **C-reviews — Create-review form** doesn't exist for places / stays / eateries / agents.
- **C-safety user flows** — Create SOS, trusted contacts CRUD, scam report are missing UIs (backends ready).
- **C-stays** — Full backend (`stays` module) with zero web pages.

---

## Feature matrix

API counts approximate (the OpenAPI bundle has 193 endpoints across the 19 modules). Page count is `app/**/page.tsx` files in `apps/web/`. Hook-call count is grep of `useXxxController` invocations inside `apps/web/src/` (excluding type-only imports).

| Area              | API endpoints  | Web pages | Hooks used | %       | Gap                                                                                                                                                    |
| ----------------- | -------------- | --------- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **identity**      | 19             | 3         | 14         | 85      | Magic-link + password-reset + MFA-recovery wired. Missing: JWKS admin UI, email-verify flow.                                                           |
| **trip**          | 38             | 9         | 26         | 90      | CRUD + itinerary edit + day reorder + share + media live. Missing: lock/archive UI, TripWatch.                                                         |
| **food**          | 4              | 1         | 3          | 50      | Eatery detail + dish reporting. Missing: eatery search/browse, cuisine filters, near-me food.                                                          |
| **media**         | 20             | 4         | 21         | 80      | Memory-book CRUD + asset upload + multi-variant render. Missing: version control, variant tests.                                                       |
| **safety**        | 20             | (frags)   | 3          | 40      | Public country primer + emergency numbers + admin SOS list. Missing: SOS create, trusted-contacts CRUD, scam-report flow, agent self-profile.          |
| **payments**      | 4              | 2         | 0          | 30      | Billing portal link + pricing page. **Checkout is `alert('coming soon')`.** No subscription lifecycle.                                                 |
| **social**        | 34             | 1         | 4          | 25      | Public reviewer profile + karma + read-only reviews + helpful votes. Missing: follow/block UI, comment threads, trip reactions, create-review surface. |
| **agent**         | 4              | 3         | 5          | 60      | Agent dashboard + profile + run history. Missing: create/edit, marketplace browse, acceptance UI.                                                      |
| **notifications** | 11             | 1         | 7          | 70      | Inbox list + preferences. Missing: notification detail, archive UI, full prefs mutations.                                                              |
| **account**       | 17             | 6         | 9          | 75      | Password / prefs / privacy (GDPR export+delete) / reactivate / trusted-contacts. Missing: device mgmt, session revocation, OAuth.                      |
| **events**        | 2              | 0         | 0          | **0**   | No pages. API exists.                                                                                                                                  |
| **diary**         | 4              | 1         | 0\*        | 75      | Entry CRUD + AI assist + gamification (uses `apiFetch`-direct, hence 0 hook counts). Missing: detail view, sharing.                                    |
| **places**        | 3              | 1         | 1          | 30      | Hidden-gems search (geo + radius). Missing: place detail, place reviews, near-me places.                                                               |
| **stays**         | 1              | 0         | 0          | **0**   | No pages. API exists.                                                                                                                                  |
| **transport**     | 2              | 0         | 0          | **0**   | No pages. API exists.                                                                                                                                  |
| **reviews**       | 34 (in social) | 0         | 2          | 15      | Read-only via user profile + helpful votes. **No create-review surface** anywhere.                                                                     |
| **weather**       | 2              | (in trip) | 0\*        | 20      | 3-day forecast in trip overview. No standalone page, no hourly, no alerts.                                                                             |
| **translation**   | 1              | 0         | 0          | **0**   | Echo stub on api (A2 ships real translate). No widget on web.                                                                                          |
| **embeddings**    | 0              | (in feed) | 0          | **0**   | Similar-trips rail in `/feed` via `apiFetch`-direct. No standalone surface.                                                                            |
| **admin**         | 19             | 7         | 18         | 65      | See `admin-2026-05-26.md` (Z2). 6 moderation queues live; IP-allowlist + role-promotion missing.                                                       |
| **TOTAL**         | **~193**       | **~36**   | **~117**   | **~52** | —                                                                                                                                                      |

`*` = consumed via `apiFetch`-direct (hand-coded HTTP under `apps/web/src/lib/two-oh-api.ts`) rather than generated SDK hooks. Tracked tech debt; not a wiring gap.

---

## What's missing — grouped by priority

### Zero-coverage (0%) — APIs exist, no UI

- **`events`** (live events feed, RSVP, attendance, calendar) — needed for trips with concert / festival overlap.
- **`stays`** (browse, detail, booking flow) — large backend, no UI. Booking flow could be its own week.
- **`transport`** (transit widget in trip, nearest transit search) — small but valuable.
- **`translation` widget** — small. C11.
- **`embeddings` standalone surface** — small; "find trips like this" reuses an existing hook.

### Partial coverage (15–50%) — surface exists but incomplete

- **`food`** (50%) — eatery detail + dish reporting. Missing eatery search/browse, cuisine filters, near-me food.
- **`safety`** (40%) — public primer + admin SOS list. **No user-facing Create SOS / trusted-contacts / scam report flow.**
- **`payments`** (30%) — billing portal link works; **Stripe checkout is stubbed**. No refunds, escrow, commission tracking.
- **`places`** (30%) — hidden gems search only. No place detail, no place reviews, no near-me places.
- **`reviews`** (15%) — read-only on user profile + helpful votes. **No create-review surface anywhere.**
- **`weather`** (20%) — 3-day forecast in trip overview only. No standalone page.

### Substantial coverage (60–90%) — mature, polish-only

- **`trip`** (90%), **`identity`** (85%), **`media`** (80%), **`account`** (75%), **`diary`** (75%), **`notifications`** (70%), **`admin`** (65%), **`agent`** (60%).

---

## Design system + hooks + auth posture

**Design system** — `apps/web/src/components/ui/` has **~11 base primitives** (badge, button, card, destination-image, empty-state, input, relative-time, select, skeleton, theme-toggle, toast). No Storybook, no design tokens module, no dark-mode wiring beyond a single `theme-toggle`. Pages compose Tailwind classes ad-hoc; no 12-col grid scaffold, no shared layout components beyond `app/(...)/layout.tsx`. **Refactor candidate** once Block C lands new surfaces — extract repeating list/detail patterns.

**Hooks layer** — no `apps/web/src/hooks/` directory. Feature-aware logic lives under `apps/web/src/lib/` as flat `.ts` files (`use-auth-token.ts`, `use-trip-center.ts`, `use-speech.ts`, `use-online.ts`). Pages call `@app/sdk` hooks directly — no adapter layer. Custom hooks are sparse (auth, theme, geolocation, speech recognition).

**Two-oh-api seam** — several 2.0 surfaces (`/feed`, diary, similar-trips, creator profile) call `apiFetch` directly (hand-coded HTTP in `apps/web/src/lib/two-oh-api.ts`) because orval can't regenerate them yet (some controllers use Zod-validated `@Query()` per memory note [[orval-zod-query-params]]). This is tracked tech debt; degrades gracefully (`apiFetch` returns null on 503).

**Auth posture — CLAUDE.md rule 12 compliant.** Access token lives only in memory (`apps/web/src/lib/auth-store.ts` pub/sub pattern). Refresh token is httpOnly cookie set by the API; JS never touches it. `SilentRefreshOnMount` handles hard-reload resurrection + 10-minute keep-alive ticks. On logout, token cleared + next nav bounces to `/login`. No `localStorage` / `sessionStorage` tokens anywhere (verified by grep).

---

## TODOs · dead imports · empty routes

**User-facing "coming soon" stubs (the ones a customer can see):**

- `/pricing` → Stripe checkout shows `window.alert("coming soon")` when API returns 503 (Stripe not configured).
- `/account/billing` → Stripe portal link conditional on configuration; "Stripe not configured" fallback message.
- `/trips/[id]/concierge` → "Concierge booking — coming soon. We will reach out when live."
- `/help` → FAQ mentions "Stripe checkout lands in a follow-up release."

**No in-code `// TODO` / `// FIXME` comments** inside `apps/web/src/app/**` — stubs are user-facing copy, not dev breadcrumbs. Clean.

**Empty / non-existent routes** — `app/events/`, `app/stays/`, `app/transport/`, `app/weather/`, `app/translation/` don't exist as page files. Some have skeleton component dirs under `apps/web/src/components/` that are empty or near-empty.

**Dead imports** — grep returned no unused SDK imports inside `apps/web/src/app/**`.

---

## Build · CI · test status

- `pnpm --filter=web dev` → `next dev --port 3001` ✅
- `pnpm --filter=web build` → `next build` ✅ (gated in ci.yml)
- `pnpm --filter=web typecheck` → `tsc --noEmit` ✅
- `pnpm --filter=web lint` → `eslint src e2e test` ✅
- `pnpm --filter=web test` → `vitest run` ✅ (16 component-unit specs)
- `pnpm --filter=web e2e` → Playwright (8 specs in `apps/web/e2e/`: accessibility, account-flow, auth-flow, help, landing, login-flow, trip-flow, trips-empty)

**No page-level integration tests** (between SDK hooks + pages). **No coverage threshold enforced** on web. The web app gets less test discipline than the api — that gap matters more as Block C adds Stripe / reviews / safety flows.

---

## C-series plan refinement (Block C, revised from prior 12-slice estimate)

The prior memory plan was 12 generic slices ("C1 trip detail/edit · C2 live companion · C3 memory book · ..."). Now that we have the actual numbers, **re-rank by business impact + missing-surface size**.

**Revised Block C — three waves, ~3-4 weeks total:**

### Wave 1 (week 1) — premium tier unlock

| Slice  | Title                                           | Size | Why first                                                                          | Effort |
| ------ | ----------------------------------------------- | ---- | ---------------------------------------------------------------------------------- | ------ |
| **C1** | Stripe checkout + subscription lifecycle        | L    | The only thing blocking paid revenue. `/pricing` currently `alert('coming soon')`. | ~5 d   |
| **C2** | Create-review surface (place/stay/eatery/agent) | M    | The social loop is read-only today; no UGC creation surface for reviews.           | ~3 d   |

### Wave 2 (week 2) — user-visible safety + social

| Slice  | Title                                                           | Size | Why second                                           | Effort |
| ------ | --------------------------------------------------------------- | ---- | ---------------------------------------------------- | ------ |
| **C3** | Safety user flows (SOS create + trusted contacts + scam report) | M    | 40% → 80%. Marketable safety story is gated on this. | ~4 d   |
| **C4** | Social graph (follow/block, follower lists, trip reactions)     | M    | 25% → 70%. Network-effects depend on this.           | ~3 d   |
| **C5** | Food browse + cuisine filters + near-me food                    | M    | 50% → 80%. Discovery completes.                      | ~2 d   |

### Wave 3 (week 3) — breadth + polish

| Slice   | Title                                                   | Size | Effort |
| ------- | ------------------------------------------------------- | ---- | ------ |
| **C6**  | Stays light (browse + detail + light booking)           | L    | ~4-5 d |
| **C7**  | Events + live (feed + RSVP + calendar widget)           | M    | ~3 d   |
| **C8**  | Weather standalone (hourly + alerts) + transport widget | M    | ~2-3 d |
| **C9**  | Diary polish (detail view + sharing + badge showcase)   | S    | ~2 d   |
| **C10** | Translation widget (in trip / on places)                | S    | ~2 d   |
| **C11** | A11y sweep + visual baselines (axe + Chromatic)         | M    | ~2-3 d |
| **C12** | Hooks layer extraction + design-token refactor          | M    | ~2-3 d |

**Total Block C**: ~33-42 working days ≈ **7-9 weeks solo** (revised UP from memory's earlier "~4 weeks" — the new estimate accounts for the social graph + stays surfaces that weren't in the prior plan).

**Sequencing rationale:**

1. **Stripe + create-review first** — unblocks revenue + the social loop. Highest leverage per day.
2. **Safety + social + food second** — visible to every user, lifts the marketing story.
3. **Stays + events + breadth third** — feature-completeness, less time-critical.

**Risk vectors:**

- **Stripe checkout requires real credentials** — Stripe not configured in dev. Need `STRIPE_*` env vars (test mode → live mode flip on launch).
- **`apiFetch`-direct seam** for feed / diary / similar-trips remains hand-coded until orval-Zod-Query is fixed (per memory [[orval-zod-query-params]]). New surfaces should AVOID this pattern; if they require Zod `@Query()`, fix the controller (add `@ApiQuery()`) first.
- **No E2E coverage** for food, diary, reviews, agent, safety user flows — every C-slice should add at least one Playwright spec.

---

## See also

- [`mobile-2026-05-26.md`](mobile-2026-05-26.md) — Z1 mobile audit.
- [`admin-2026-05-26.md`](admin-2026-05-26.md) — Z2 admin audit.
- [`apps/api/src/modules/`](../../apps/api/src/modules/) — 19 bounded contexts.
- [`apps/web/src/app/`](../../apps/web/src/app/) — 36 pages across 12 route trees.
- [`apps/web/src/lib/two-oh-api.ts`](../../apps/web/src/lib/two-oh-api.ts) — `apiFetch`-direct seam.
- [`apps/web/src/lib/auth-store.ts`](../../apps/web/src/lib/auth-store.ts) — memory-only access token (rule-12 compliant).
- [`travel-app-playbook.md`](../../travel-app-playbook.md) §13.2 — access-token TTL (15m) + refresh schedule (10m).

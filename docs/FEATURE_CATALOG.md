# Feature Catalog & Page Map

> One-stop reference for every feature in TravelSuperApp. Use this
> as a checklist when redesigning pages, planning new flows, or
> tracking what's wired vs stubbed.
>
> **Last updated:** 2026-05-13 (after POST.10 + POST.7 + POST.8 shipped).
>
> **Scope:** 58 web pages · 169 API routes · 16 feature domains.
>
> Companion docs:
>
> - [`PROGRESS.md`](../PROGRESS.md) — chronological ship log
> - [`docs/POST_VUX_GAPS.md`](POST_VUX_GAPS.md) — gap audit + execution prompts
> - [`docs/external-apis.md`](external-apis.md) — every external dep + free tier limits
> - [`docs/api/openapi.yaml`](api/openapi.yaml) — generated API contract

---

## How to use this document

When designing a page in a future session:

1. Find the page in the **Page Map** (§2).
2. Open its **Per-Page Design Brief** (§4).
3. Read the **Feature Domain** (§3) it belongs to for context.
4. Use the **Design Checklist Template** (§5) to evaluate the page's current state.
5. Update the Status columns as you ship.

The status legend is unified across the doc:

- ✅ **Done** — designed + functional, no known gaps
- 🟡 **Partial** — works but UX needs polish
- ⚪ **Stub** — placeholder, needs full design pass
- ❌ **Disabled** — env-gated off (no API key); behavior intentional
- 🔒 **Auth-gated** — sign-in required
- 👮 **Admin-only** — `@Roles('admin')` required

---

## 1. Quick stats

| Metric                                 | Count                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Pages (Next.js routes)                 | **58**                                                                           |
| API endpoints                          | **169**                                                                          |
| Feature domains                        | **16**                                                                           |
| Hexagonal modules in api               | **17**                                                                           |
| External adapters with stub fallback   | **9** (Anthropic, Gemini, Ollama, Resend, Stripe, Twilio, Sentry, Honeycomb, S3) |
| Truly free services wired              | 4 (Gemini, Ollama, VAPID, MinIO/dev)                                             |
| Paid services wired (TEST mode = free) | 5 (Stripe, Twilio, Resend, Sentry, Honeycomb)                                    |

---

## 2. Page Map (every public route)

### Public / unauthenticated (15 pages)

| Route                          | Purpose                                                                                         | UX status | Functional status                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| `/`                            | Landing — hero, value pillars, sample trip demo, welcome-back banner, live metrics, trust strip | ✅        | ✅                                      |
| `/login`                       | Magic-link request + password sign-in + Google OAuth + mock-dev                                 | ✅        | 🟡 (needs Resend for magic-link emails) |
| `/login/forgot`                | Password-reset request                                                                          | 🟡        | 🟡                                      |
| `/login/reset/[token]`         | Password-reset consume                                                                          | 🟡        | ✅                                      |
| `/login/mfa-recover`           | Backup-code MFA recovery                                                                        | ⚪        | ✅                                      |
| `/register`                    | Email + password signup + Google sign-in button                                                 | ✅        | ✅                                      |
| `/auth/magic-link/[token]`     | Magic-link consume + redirect                                                                   | ⚪        | ✅                                      |
| `/onboarding`                  | 3-step wizard (interests, comfort mode, first trip)                                             | ✅        | ✅                                      |
| `/demo`                        | 6-scene narrated walkthrough of the product                                                     | ✅        | ✅                                      |
| `/press`                       | Press kit (logo, screenshots, founder pitch)                                                    | ✅        | ✅                                      |
| `/pricing`                     | 3-tier pricing (Free / Premium / Agent)                                                         | ✅        | 🟡 (Stripe stub mode unless key set)    |
| `/help`                        | FAQ + accordion + client-side search                                                            | ✅        | ✅                                      |
| `/status`                      | Live health probe per dependency                                                                | ✅        | ✅                                      |
| `/terms` `/privacy` `/cookies` | Legal pages (server-rendered MD)                                                                | ✅        | ✅                                      |
| `/accessibility`               | A11y statement + WCAG conformance                                                               | ⚪        | ✅                                      |
| `/featured`                    | Public featured memory books grid                                                               | 🟡        | ✅                                      |
| `/shared/[code]`               | Public view of a shared trip + clone CTA                                                        | 🟡        | ✅                                      |
| `/users/[id]`                  | Public user profile (recent reviews, books)                                                     | ⚪        | ✅                                      |
| `/connectivity/[country]`      | Public country primer (visa, e-sim, plugs, currency)                                            | ⚪        | ✅                                      |
| `/appeal`                      | Banned-user appeal submission                                                                   | ⚪        | ✅                                      |

### Authenticated user (15 pages) 🔒

| Route                       | Purpose                                                               | UX status | Functional status                           |
| --------------------------- | --------------------------------------------------------------------- | --------- | ------------------------------------------- |
| `/trips`                    | Active + archived trips, vim nav, suggestions strip                   | ✅        | ✅                                          |
| `/trips/new`                | Create draft (title, center map, radius, dates, length presets)       | ✅        | ✅                                          |
| `/trips/[id]`               | Trip dashboard — overview cards + AI plan + itinerary + media + share | ✅        | ✅                                          |
| `/trips/[id]/overview`      | Aggregated weather + places + stays + eateries + events + transport   | 🟡        | ✅                                          |
| `/trips/[id]/concierge`     | Premium agent matching                                                | ⚪        | 🟡 (Premium gate works, agent flow stubbed) |
| `/trips/[id]/expenses`      | Group-trip expense tracking + balances + settle-up                    | ⚪        | ✅                                          |
| `/trips/[id]/food-crawl`    | Day-of food crawl planner                                             | ⚪        | ✅                                          |
| `/trips/[id]/primer`        | Country primer for trip's destination                                 | ⚪        | ✅                                          |
| `/discover`                 | Search places (text + filters)                                        | ⚪        | ✅                                          |
| `/near-me`                  | Geo-aware "what's around me right now"                                | ⚪        | ✅                                          |
| `/eateries/[id]`            | Eatery detail + reviews + dishes                                      | ⚪        | ✅                                          |
| `/inbox`                    | Notification list + per-category prefs + push subscription            | ✅        | ✅                                          |
| `/memory-books`             | List memory books (mine)                                              | 🟡        | ✅                                          |
| `/memory-books/new`         | Create memory book                                                    | ⚪        | ✅                                          |
| `/memory-books/[id]`        | View memory book (preview pane)                                       | 🟡        | ✅                                          |
| `/memory-books/[id]/edit`   | Edit memory book (drag-reorder, captions, theme, publish)             | 🟡        | ✅                                          |
| `/account`                  | Hub — links to Privacy, Preferences, Trusted contacts, Inbox, Billing | 🟡        | ✅                                          |
| `/account/billing`          | Current plan + Stripe Customer Portal link                            | ⚪        | 🟡 (Stripe stub mode unless key set)        |
| `/account/preferences`      | Family / comfort / budget / nomad mode toggles                        | 🟡        | ✅                                          |
| `/account/privacy`          | Export NDJSON, delete account, ban-appeal entry                       | ✅        | ✅                                          |
| `/account/reactivate`       | Cancel pending hard-delete (within 7-day grace)                       | ⚪        | ✅                                          |
| `/account/trusted-contacts` | Add/remove SOS recipients (max 3)                                     | 🟡        | ✅                                          |

### Admin (12 pages) 👮

| Route                            | Purpose                                            | UX status | Functional status                                           |
| -------------------------------- | -------------------------------------------------- | --------- | ----------------------------------------------------------- |
| `/admin`                         | Admin hub — links to all moderation surfaces       | ⚪        | ✅                                                          |
| `/admin/users`                   | Cross-user list with ban/unban actions             | 🟡        | ✅                                                          |
| `/admin/users` (Ban Appeals tab) | Review pending ban appeals                         | 🟡        | ✅                                                          |
| `/admin/trips` (in `/admin`)     | Cross-user trip list with archive/delete           | ⚪        | ✅                                                          |
| `/admin/media`                   | Cross-user media list with thumbnails + takedown   | ✅        | ✅                                                          |
| `/admin/scam-reports`            | Verify or dismiss user-submitted scam reports      | 🟡        | ✅                                                          |
| `/admin/sos`                     | SOS event triage + admin-resolve                   | 🟡        | ✅                                                          |
| `/admin/audit`                   | Filterable audit log (every admin action)          | ✅        | ✅                                                          |
| `/compliance`                    | Retention windows + processed takedowns count      | ⚪        | ✅                                                          |
| `/compliance/takedowns`          | Filterable takedown event log                      | ⚪        | ✅                                                          |
| `/ops`                           | System dashboard (health, queue depth, error rate) | 🟡        | ✅ (S3 tile is dead pending HealthModule revert resolution) |
| `/ops/runbooks`                  | Index of incident-response runbooks                | ⚪        | ✅                                                          |

### Agent / concierge (3 pages) 🔒

| Route              | Purpose                                    | UX status | Functional status |
| ------------------ | ------------------------------------------ | --------- | ----------------- |
| `/agent/profile`   | Agent self-profile + KYC status            | ⚪        | 🟡                |
| `/agent/dashboard` | Active matches, earnings, pending bookings | ⚪        | 🟡                |
| `/agent/bookings`  | Bookings the agent has handled             | ⚪        | 🟡                |

---

## 3. Feature domains (16)

### 3.1 Identity & Auth

**What it does:** Sign up, sign in, MFA, refresh, logout. Three sign-in paths: magic-link email, password (argon2id), Google OAuth (verified ID-token via JWKS). MFA is TOTP + 8 backup codes (sha256-peppered).

**Pages:** `/login` `/login/forgot` `/login/reset/[token]` `/login/mfa-recover` `/register` `/auth/magic-link/[token]` `/onboarding`

**API surface:** 14 routes under `/api/v1/auth/*` (register, login, magic-link request/consume, password-reset request/consume, refresh, logout, oauth/:provider, me, mfa setup/verify/disable, backup-codes regenerate, onboarding/complete)

**Wires:** Resend (real emails — POST.3), Google OAuth (ID-token verify — POST.3), argon2id (`@app/auth`)

**User flow — magic link:**

1. /login → enter email → POST /auth/magic-link/request
2. Resend sends email with `/auth/magic-link/[token]` URL
3. User clicks → POST /auth/magic-link/consume → mint access + refresh tokens
4. Redirect to /onboarding (first time) or /trips

**Stub mode:** When `RESEND_API_KEY` absent, magic links are logged to api console (read them there).

**Design notes:**

- Mock-dev sign-in button on /login should stay (handy for testing) but visually deprioritized
- /login/forgot lacks a confirmation success state — needs design
- /onboarding 3-step wizard is solid but could use progress indicator polish

---

### 3.2 Trip Planning

**What it does:** Create a trip (title + center geo + radius + dates), get an AI-generated plain-prose plan, build a day-by-day itinerary, fold in weather/places/stays/eateries/events/transport, share via revocable code, lock for collaboration.

**Pages:** `/trips` `/trips/new` `/trips/[id]` `/trips/[id]/overview` `/trips/[id]/concierge` `/trips/[id]/expenses` `/trips/[id]/food-crawl` `/trips/[id]/primer` `/shared/[code]`

**API surface:** ~30 routes under `/api/v1/trips/*` and `/api/v1/near-me`

**Wires:** Anthropic / Gemini / Ollama / stub (POST.4), PostGIS (geo center + radius), Mapbox (Leaflet map widget on /trips/new)

**User flow — create + plan trip:**

1. /trips → "New trip" → /trips/new
2. Form: title, drop pin on Leaflet map (or type lat/lng), radius slider, length preset (Weekend/Long/Week)
3. Submit → POST /trips → land on /trips/[id]
4. AI Plan card → "Generate plan" → POST /trips/[id]/plan-with-ai
5. Real Gemini/Ollama prose appears with "Powered by …" badge

**Design notes:**

- /trips/[id] page is the most-loaded in the app — it's currently a wall of cards. Future redesign should consider a left-rail nav or tabbed layout.
- /trips/[id]/overview is functional but feels heavy. Consider lazy-loading sections.
- /trips/new map UX needs mobile testing.

---

### 3.3 Memory Books

**What it does:** Curated photo collections per trip. Drag-reorder assets, edit captions, pick a theme, publish to public /featured grid, share via permalink.

**Pages:** `/memory-books` `/memory-books/new` `/memory-books/[id]` `/memory-books/[id]/edit` `/featured`

**API surface:** ~12 routes under `/api/v1/memory-books/*`, plus `/api/v1/media/*` for asset uploads

**Wires:** S3 / MinIO (presigned uploads), Sharp (thumb + medium WebP variants — POST.5)

**User flow — upload + organize:**

1. /memory-books → "New" → /memory-books/new → create
2. /memory-books/[id]/edit → upload via "Choose File"
3. POST /media/upload-url → presigned PUT URL
4. Browser PUTs file directly to S3
5. POST /media/:id/confirm → ConfirmUploadUseCase verifies file exists + flips status:'ready' + runs Sharp variant pipeline
6. Asset appears in book; user can drag-reorder, add caption, set as cover

**Design notes:**

- Drag-reorder uses @dnd-kit; performance is OK up to ~50 assets per book
- Preview pane on /memory-books/[id]/edit is split-screen on desktop, stacked on mobile
- /featured grid needs better empty state + pagination polish

---

### 3.4 Discovery (Places / Eateries / Stays / Events)

**What it does:** Federated search across Google Places + Foursquare + OSM. Per-place reviews + ratings + tags. Trip-scoped lookups (e.g. "stays inside this trip's radius").

**Pages:** `/discover` `/near-me` `/eateries/[id]`

**API surface:** ~14 routes under `/api/v1/places/*` `/api/v1/eateries/*` `/api/v1/stays/*` `/api/v1/events/*` `/api/v1/transport/*` `/api/v1/weather/*`

**Wires:** Google Places (api_key), Foursquare (api_key), OSM Overpass (free), Open-Meteo (weather, free)

**User flow — discover near current trip:**

1. /trips/[id] → "Find places" → drilldown into category
2. POST /places/federated-search with trip's center+radius
3. Server-side: query Google → fallback Foursquare → fallback OSM (circuit-breaker per provider)
4. Results displayed with provider badge + dedupe + rich tags

**Design notes:**

- /discover needs major design pass — it's a stub-quality form right now
- /near-me geolocation prompt UX could be smoother
- Place cards need consistent shape across /discover, /near-me, trip overview

---

### 3.5 Social

**What it does:** Hearts on shared trips (anonymous), votes on places (signed-in), 5-star reviews with helpful counts, karma scoring (background scheduler), public user profiles.

**Pages:** `/users/[id]` `/shared/[code]`

**API surface:** ~15 routes for hearts, votes, reviews, summaries

**User flow — review a place after a trip:**

1. /trips/[id] → click a place card → place detail
2. "Write a review" → 5-star + text
3. POST /reviews → ReviewSummary auto-recomputed
4. Karma scheduler (daily) recomputes user's karma score

**Design notes:**

- Public profile (`/users/[id]`) is bare-bones; needs hero + recent activity feed
- Heart counter on /shared/[code] needs animation polish

---

### 3.6 Safety / SOS

**What it does:** Trigger SOS (3 channels: manual button, phone-based panic pattern, geofence boundary). Fan out to up to 3 trusted contacts via SMS (Twilio). Crime layer + scam reports + safety score per location.

**Pages:** `/account/trusted-contacts` (no dedicated SOS page — SOS FAB is global, bottom-right)

**API surface:** ~13 routes under `/api/v1/safety/*`

**Wires:** Twilio (SMS — POST.7, optional with TEST creds), Numbeo (crime index, api_key), government open-data feeds (per country)

**User flow — trigger SOS:**

1. Any page → tap red SOS FAB (bottom-right)
2. Confirm modal → POST /safety/sos with trigger type + lat/lng
3. Server fan-outs via Promise.allSettled to each trusted contact
4. With Twilio: real SMS sent. Without: logged to ring buffer.
5. Banner appears on every page until cancelled or admin-resolved

**Design notes:**

- SOS FAB is well-placed; modal could use bigger touch target
- /account/trusted-contacts add-form could autocomplete from existing contacts
- Crime layer overlay on map (in trip overview) needs design

---

### 3.7 Premium / Payments

**What it does:** $9/mo Premium subscription via Stripe Checkout. Webhook flips User.role to 'premium'. Manage subscription via Stripe Customer Portal.

**Pages:** `/pricing` `/account/billing`

**API surface:** 4 routes under `/api/v1/payments/*` (POST.9)

**Wires:** Stripe (TEST mode is free, LIVE for production)

**User flow — upgrade:**

1. /pricing → "Upgrade to Premium" → POST /payments/checkout
2. Redirect to https://checkout.stripe.com/...
3. Pay with test card `4242 4242 4242 4242`
4. Stripe redirects back to /account/billing
5. Webhook (`checkout.session.completed`) → SyncSubscriptionUseCase → role flipped to 'premium'
6. /trips/[id]/concierge unlocks (PremiumGate stops showing)

**Design notes:**

- /pricing has 3 tier cards (Free / Premium / Agent); Agent CTA is `mailto:`
- /account/billing is barebones; needs design pass for the "active sub" state
- PremiumGate component shows "Upgrade to Premium" CTA — links to /pricing

---

### 3.8 Account / Privacy / Compliance

**What it does:** GDPR Art. 15 (export) + Art. 17 (delete with 7-day grace). Reactivation within grace window. Ban appeals. Per-user preferences (family, comfort, budget, nomad).

**Pages:** `/account` `/account/billing` `/account/preferences` `/account/privacy` `/account/reactivate` `/account/trusted-contacts` `/appeal`

**API surface:** ~10 routes under `/api/v1/account/*`

**User flow — export my data:**

1. /account/privacy → "Download data export"
2. GET /account/export.ndjson (streaming response)
3. Browser downloads NDJSON file with every user-owned row across the schema

**User flow — delete account:**

1. /account/privacy → "Delete account" → confirm modal
2. DELETE /account → soft-delete (deletedAt = now)
3. AccountPurgeScheduler (daily cron) hard-deletes after 7 days
4. Within 7 days: /account/reactivate cancels the deletion

**Design notes:**

- /account hub layout is OK but cluttered; consider grouping into Identity / Privacy / Billing sections
- /account/preferences toggles need clearer descriptions

---

### 3.9 Notifications / Inbox

**What it does:** In-app notification inbox (read/unread/archive/delete). Per-category preferences (trip-locked, itinerary-ready, sos-triggered, etc.). Web Push subscription via VAPID.

**Pages:** `/inbox`

**API surface:** ~8 routes under `/api/v1/notifications/*`

**Wires:** VAPID (Web Push — POST.7, free, self-generated keys)

**User flow — subscribe to push:**

1. /inbox → "Push notifications: Enable"
2. Browser prompts for permission
3. Service worker registers a push subscription with VAPID public key
4. POST /notifications/push/subscribe stores the subscription
5. Backend events (e.g. trip-locked) trigger push fan-out via web-push library

**Design notes:**

- Inbox row UX is solid (POST.8 added RelativeTime)
- Per-category preferences page needs design
- Push permission flow could use a "why we ask" preamble

---

### 3.10 Translation

**What it does:** On-demand text translation via NLLB sidecar (Python ai-service). Translate widget bottom-left on every page, opens a modal with source + translated text.

**Pages:** Global widget; no dedicated page

**API surface:** 1 route — POST /api/v1/translation/translate

**Wires:** Python FastAPI ai-service (`AI_SERVICE_URL=http://localhost:8001`)

**Design notes:**

- Widget is functional but visually heavy; could collapse to icon-only by default

---

### 3.11 Admin / Moderation

**What it does:** Cross-user list + ban/unban (User), trip moderation (archive/delete), media takedown, scam-report verify/dismiss, SOS triage, audit log filtering, compliance dashboards, account purge trigger, JWKS rotation.

**Pages:** `/admin` `/admin/users` `/admin/media` `/admin/scam-reports` `/admin/sos` `/admin/audit` `/compliance` `/compliance/takedowns` `/ops` `/ops/runbooks`

**API surface:** ~25 routes under `/api/v1/admin/*` `/api/v1/compliance` `/api/v1/metrics`

**Design notes:**

- /admin is currently just a hub of links; needs proper card grid
- /admin/audit is the most-polished admin surface (POST.8 added RelativeTime)
- /ops dashboard's S3 tile is currently dead (HealthModule revert)
- Run book index at /ops/runbooks is an empty page

---

### 3.12 Marketing / Public

**What it does:** Landing page with hero + value pillars + sample trip demo + welcome-back banner + live metrics + trust strip. /demo narrated walkthrough. /press kit. /pricing /help /status.

**Pages:** `/` `/demo` `/press` `/pricing` `/help` `/status`

**API surface:** Public — `POST /trips/sample-plan` (landing demo), `GET /api/v1/metrics-public` (live counters), `GET /health/ready` (status page polls)

**Design notes:**

- All 6 pages are ✅ designed (V.UX.36 + POST.6)
- Footer (POST.6) appears on every page; could surface social links

---

### 3.13 Legal

**What it does:** Server-rendered markdown for /terms /privacy /cookies. Source MD files in `docs/legal/*.md`.

**Pages:** `/terms` `/privacy` `/cookies` `/accessibility`

**Wires:** None (server-side fs.readFileSync)

**Design notes:**

- Legal content is placeholder pending counsel review
- Render style is clean but dense; could use TOC sidebar for long docs
- /accessibility is a stub — needs WCAG 2.1 conformance statement filled in

---

### 3.14 Developer / Infrastructure

**What it does:** Health probes (/health/live /health/ready /health/startup) for k8s/Fly. Prometheus /metrics endpoint. Public live counters at /api/v1/metrics-public for landing page.

**Pages:** `/ops` `/ops/runbooks` (admin only)

**API surface:** /health/\* (bare path, no /api/v1 prefix), /metrics, /api/v1/metrics-public

---

### 3.15 Cross-cutting UX

**Components used everywhere:**

- `<SosFab>` — persistent bottom-right SOS trigger
- `<TranslateWidget>` — persistent bottom-left translator
- `<CommandPalette>` — Cmd+K / Ctrl+K everywhere
- `<ShortcutSheet>` — `?` shortcut cheat-sheet modal
- `<LiveRegion>` — ARIA live polite + assertive
- `<ToastProvider>` — top-right toast queue (POST.8)
- `<ThemeToggle>` — light / dark / auto in header
- Comfort-mode toggle (a11y density)
- `<PremiumGate>` — wraps premium-only features
- `<Footer>` — POST.6 footer mounted in layout
- Vim list nav (j/k) on /trips

**Design notes:**

- Toast (POST.8) is hand-rolled — no sonner dep
- RelativeTime auto-refreshes every 60s
- Empty states have a shared `<EmptyState>` (POST.8) — adopt across all stub pages

---

### 3.16 Observability / Operations

**What it does:** OTel traces (Honeycomb when wired, Jaeger fallback), Sentry error tracking, Pino structured logs, Prometheus metrics, audit log persistence, account purge cron, weekly digest cron, karma scheduler, orphan-S3-sweep cron.

**Pages:** None directly user-facing; data flows to dashboards

**Wires:** Sentry (POST.10, free tier), Honeycomb (POST.10, free tier), GitHub Actions deploy (POST.10, fires on `v*.*.*` tags)

---

## 4. Per-Page Design Brief Template

Use this for each page when planning a redesign session:

```
### Page: <route>

**Domain:** §3.X (link)
**Auth requirement:** public / 🔒 user / 👮 admin / 💎 premium
**Status (UX):** ⚪ / 🟡 / ✅
**Status (functional):** ❌ / 🟡 / ✅

**Sections (top to bottom):**
1. ...
2. ...

**User actions on this page:**
- ...

**API routes used:**
- GET /api/v1/...
- POST /api/v1/...

**Key components:**
- <ComponentA> from `@/components/...`
- <ComponentB> from `@/components/...`

**Empty state behavior:**
- Currently: ...
- Should be: ...

**Loading state behavior:**
- Currently: ...
- Should be: ...

**Error states:**
- 4xx: ...
- 5xx: ...

**Mobile considerations:**
- ...

**Accessibility:**
- Heading hierarchy: ...
- ARIA labels: ...
- Keyboard nav: ...

**Design changes proposed:**
1. ...
2. ...

**Out of scope for this redesign:**
- ...
```

---

## 5. Design checklist (per page)

When you redesign a page, verify each:

- [ ] **Hierarchy:** Single H1, logical H2/H3 nesting
- [ ] **Loading state:** Skeleton (use `<SkeletonList>` / `<SkeletonCard>` from POST.8)
- [ ] **Empty state:** Use `<EmptyState>` component (POST.8)
- [ ] **Error state:** Branded error card + retry CTA + traceId for support
- [ ] **Success feedback:** Toast via `toast.success(...)` + ARIA announce (POST.8)
- [ ] **Time displays:** Use `<RelativeTime>` not raw `toLocaleString()` (POST.8)
- [ ] **Premium gating:** Wrap with `<PremiumGate>` if 💎-only
- [ ] **Auth gating:** Redirect via `useAuthToken()` if 🔒-only
- [ ] **Dark mode:** Test in dark theme (toggle in header)
- [ ] **Comfort mode:** Test with comfort density on (a11y)
- [ ] **Mobile:** 320px width minimum; touch targets ≥ 44px
- [ ] **Keyboard nav:** Tab order makes sense; visible focus rings
- [ ] **Screen reader:** Semantic HTML; ARIA landmarks; alt text on images
- [ ] **Responsive grid:** No horizontal scroll on any breakpoint
- [ ] **Bundle size:** No new heavy deps without justification
- [ ] **API call patterns:** React Query for GET; mutations with `onSuccess` invalidation
- [ ] **Optimistic UI:** Where stateChange is fast (toggles, archives)
- [ ] **i18n hooks:** Strings could be extracted to a translation table later

---

## 6. Status colour-key for the next design pass

When walking through pages in design sessions, mark each according to this scale:

| Status         | Meaning               | Action                                        |
| -------------- | --------------------- | --------------------------------------------- |
| ✅ **Done**    | Polished, ships as-is | Skip in design pass                           |
| 🟡 **Partial** | Works but visual debt | Light pass — typography, spacing, consistency |
| ⚪ **Stub**    | Functional but ugly   | Full design pass needed                       |
| 🚧 **Broken**  | Known regression      | Fix before redesign                           |
| 🆕 **Planned** | Not yet built         | Wireframe first                               |

Recommended order for a "design every page" sprint:

1. **High-traffic pages first:** `/`, `/trips`, `/trips/[id]`, `/memory-books/[id]/edit`, `/inbox`
2. **High-conversion pages:** `/login`, `/register`, `/onboarding`, `/pricing`, `/account/billing`
3. **Cross-cutting components:** `<EmptyState>`, `<SkeletonList>`, toast variants, error states
4. **Trip subroutes:** `/trips/[id]/overview`, `/trips/[id]/concierge`, `/trips/[id]/expenses`, `/trips/[id]/food-crawl`, `/trips/[id]/primer`
5. **Discovery:** `/discover`, `/near-me`, `/eateries/[id]`
6. **Account:** `/account`, `/account/preferences`, `/account/trusted-contacts`, `/account/privacy`, `/account/reactivate`
7. **Public surfaces:** `/featured`, `/users/[id]`, `/shared/[code]`, `/connectivity/[country]`
8. **Auth recovery:** `/login/forgot`, `/login/reset/[token]`, `/login/mfa-recover`, `/auth/magic-link/[token]`, `/appeal`
9. **Agent:** `/agent/profile`, `/agent/dashboard`, `/agent/bookings`
10. **Admin / ops:** `/admin/*`, `/compliance`, `/ops/*`

---

## 7. Service signup status

Track which external services you've wired:

| Service             | Free tier          | Sign-up URL                      | Status                       |
| ------------------- | ------------------ | -------------------------------- | ---------------------------- |
| Anthropic Claude    | $5 credit signup   | https://console.anthropic.com    | ❌ not wired                 |
| Google Gemini Flash | 1500 req/day       | https://aistudio.google.com      | ✅ wired                     |
| Ollama (local)      | $0 forever         | https://ollama.com               | ✅ wired (qwen2.5:7b)        |
| Resend              | 3k emails/mo       | https://resend.com               | ❌ not wired                 |
| Stripe TEST         | unlimited TEST     | https://dashboard.stripe.com     | ❌ not wired                 |
| Twilio TEST         | magic numbers only | https://console.twilio.com       | ❌ not wired                 |
| Sentry              | 5k errors/mo       | https://sentry.io                | ❌ not wired                 |
| Honeycomb           | 20M events/mo      | https://ui.honeycomb.io          | ❌ not wired                 |
| VAPID (self-gen)    | $0 forever         | n/a                              | ✅ wired (auto-generated)    |
| Google OAuth        | unlimited          | https://console.cloud.google.com | ❌ not wired                 |
| MinIO (local S3)    | $0 forever         | docker compose                   | ✅ wired (dev)               |
| Cloudflare R2       | 10 GB free         | https://dash.cloudflare.com      | ❌ not wired (prod swap)     |
| Fly.io              | $5 credit/mo       | https://fly.io                   | ❌ not wired (deploy target) |

---

## 8. Recommended next-session work

Order these in any way that suits the design sprint:

1. **Page audit** — open every page in browser, screenshot, mark ⚪/🟡/✅ in §2
2. **Cross-cutting design pass** — finalise toast variants, EmptyState shapes, error cards, loading states
3. **Top-of-funnel polish** — landing → register → onboarding → first trip flow
4. **Trip-detail layout** — split the wall-of-cards into a tabbed or rail-nav layout
5. **Memory book edit polish** — drag-reorder UX, caption modal, theme picker preview
6. **Admin dashboard** — `/admin` is currently a hub of links; needs proper card grid
7. **Mobile QA** — every page at 375 / 414 / 768 widths

---

**Last build state:** POST.10 shipped `c1d4040` · 169 API routes · 58 web pages · 9 env-gated adapters with stub fallback · all e2e suites pass · all typecheck pass · only Gemini + Ollama + VAPID wired with real services in dev.

**To bump this doc:** add new pages to §2; new domains to §3; bump §1 stats; update §7 service status as you sign up for things.

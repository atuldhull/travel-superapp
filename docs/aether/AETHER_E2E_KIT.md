# Aether E2E Kit — operator playbook

A first-touch guide for engineers + ops opening the Aether 2.0 preview
on their own machine, walking the full user journey, and prepping for
the soft launch.

This is the only doc you should need to:

1. Boot Aether locally.
2. Walk the eight surfaces in order, hitting every state.
3. Promote yourself to admin so `/aether/dispatch` lights up.
4. Run the test suite that gates merges.
5. Flip the production feature flag for the soft launch.

> Companion docs: [`07-implementation-log.md`](./07-implementation-log.md)
> (history), [`08-data-flow.md`](./08-data-flow.md) (ASCII flows),
> [`09-component-catalog.md`](./09-component-catalog.md) (every component).

---

## 1 · Boot Aether locally

### 1.1 Backend (API + DB)

From the repo root:

```powershell
# Postgres + Redis (Docker Compose, idempotent)
pnpm dev:up

# API on http://127.0.0.1:3000
pnpm --filter=api dev
```

Wait for `:3000/api/v1/health/ready` to return `{ status: 'ok' }`. If
the API down-bell rings, that's the **first suspect** for any "broken
Aether UI" report — see the `feedback_run_api_before_judging_ui` memory.

### 1.2 Web

```powershell
# .env.local must include:
#   NEXT_PUBLIC_FEATURE_AETHER_PREVIEW=1
#
# (PowerShell does not honour bash-style VAR=x prefixes — put it in
#  .env.local, not the command line.)

pnpm --filter=web dev      # http://localhost:3001
```

Visit <http://localhost:3001/aether/drift>. You should see the hero
photograph, "Live Bharat" headline, and the editorial Drift surface.
If you get 404, the feature flag is off. Restart the dev server after
editing `.env.local` (see `feedback_stale_bundle_first_suspect`).

### 1.3 (Optional) Storybook

```powershell
pnpm --filter=aether-storybook dev   # http://localhost:6011
```

---

## 2 · Walk the eight surfaces

The full happy path takes ~6 minutes. Pour yourself a chai.

### 2.1 `/aether/drift` — home

- Hero carousel rotates every 9s through 4 photos.
- Bottom-right photographer credit pill (AE41) swaps with each rotation.
- `<AudioChip/>` pill in the top-right; open the popover, drag the
  volume slider, hit "Test chime". Mute survives a reload (localStorage:
  `aether-audio-muted`).
- Click any `<Pulse/>` FAB at the bottom-right to open the AI drawer
  (see §2.6).

### 2.2 `/aether/destinations` and `/aether/destinations/<slug>`

15 cities. Slugs: `jaipur · alleppey · leh · anjuna · hampi · varanasi
· mumbai · coorg · pondicherry · spiti · darjeeling · udaipur · madurai
· bhuj · shillong`.

Each destination renders in its **per-slug accent** (AE61) — Jaipur
sandstone-pink, Alleppey palm-teal, etc. Eyebrow says `Aether · <state>
· <accent-note>`.

Bottom CTA: "Begin the yatra →" pre-fills the planner with the city
name. If signed in _and_ you have a draft trip, an "Add to your <draft>
draft" pill appears beside it (AE45).

### 2.3 `/aether/journal` and `/aether/journal/<slug>`

6 long-form articles. Subscribe to the feed:

```text
http://localhost:3001/aether/journal/feed.xml
```

The RSS feed is XML-validated by `apps/web/src/app/aether/journal/feed.xml/route.ts`
and 1h cached.

### 2.4 `/aether/atlas`

Real Leaflet map of India. CartoDB Dark Matter tiles, 15 terracotta-
glow pins. Click any pin to navigate to its destination.

### 2.5 `/aether/plan`

The planner. Three fields (where / kind / days) — pre-filled when you
arrived via the destination CTA. Geocoded via Photon (1h in-mem cache).
Submitting POSTs `/trips`, then routes to `/aether/journey/<new id>`.

### 2.6 `<Pulse/>` AI drawer (every surface except `/plan`)

1. Click the bottom-right ✦ FAB.
2. Type "Jaipur in March, slow pace, two days" or speak it (mic
   button — AE59, Chromium/Safari only).
3. Refine ("make it cheaper", "two more days"). Each refine threads
   `instruction + priorPlan` so the model edits.
4. Two save buttons:
   - "Save this as a real trip" → `POST /trips` → routes to journey.
   - "Save + share immediately" (AE44, ochre) → save then share, copy
     `/shared/[code]` to clipboard, show "Link copied · journey
     opening" 900ms, then route.

### 2.7 `/aether/journey/<id>`

The trip cockpit. Six actions:

| Button              | Endpoint                                | Notes                                                 |
| ------------------- | --------------------------------------- | ----------------------------------------------------- |
| Create link         | `POST /trips/[id]/share`                | Copy chip appears                                     |
| Archive / Unarchive | `POST /trips/[id]/(archive\|unarchive)` | Stops in list filter                                  |
| Duplicate journey   | `POST /trips/[id]/duplicate` (AE42)     | Routes to new id                                      |
| Export PDF          | client-side (AE63)                      | Lazy-loads react-pdf + downloads `aether-<title>.pdf` |
| All journeys        | nav                                     | → `/aether/me/journeys`                               |

Itinerary day cards render below (AE40) — numbered cap, kicker,
display-serif title, italic subtitle, mono time slots.

### 2.8 `/aether/me`, `/aether/me/journeys`, `/aether/me/shares`, `/aether/account`, `/aether/onboarding`, `/aether/shared/<code>`

The full Me surface (Round B). `/aether/me` is the 3-card aggregate;
`/journeys` is the index w/ status chips; `/shares` is the cross-trip
share list with Copy + Revoke per share. `/account` has identity, audio,
motion, privacy, Sign-out. `/onboarding` is the 3-beat welcome and
marks `aether-onboarded=1` on mount. `/shared/[code]` is the read-only
public view + "Clone this journey" CTA.

---

## 3 · Promote yourself to admin (for `/aether/dispatch`)

`/aether/dispatch` (AE62) is admin-only.

```powershell
# Postgres must be reachable on 127.0.0.1:5432 with the dev DATABASE_URL.
./scripts/admin/promote-user.sh you@example.com
```

Then **log out + log back in** — `RolesGuard` reads the JWT claim, not
the DB row (memory: `feedback_role_jwt_relogin`).

Visit `/aether/dispatch`. You should see "Ops · dispatch · admin" and
four tiles (Active / Drafts / Archived / Total ever), then the 10 most
recent active trips.

---

## 4 · Test suite (the gate)

```powershell
# Type-check the touched packages
pnpm turbo run typecheck

# Lint (the touched packages)
pnpm turbo run lint

# Web build (smoke for next/image, sentry wrap, sitemap, RSS)
pnpm --filter=web build

# Playwright E2E for Aether (smoke + axe-core)
pnpm --filter=web exec playwright test e2e/aether-flow.spec.ts
```

The Aether spec auto-skips every test when the gate is off, so don't
forget the `.env.local` setting.

---

## 5 · Production soft launch

The gate flips in your hosting environment:

```text
NEXT_PUBLIC_FEATURE_AETHER_PREVIEW=1
```

When the env var is unset, every Aether `page.tsx` calls `notFound()`
and the routes 404 cleanly. There is **no migration cost** to deploy
with the flag off, and no migration cost to flip it on.

Once flipped, also surface the Aether sitemap to crawlers:

```text
https://<your-host>/aether/sitemap.xml      → 28 URLs
https://<your-host>/aether/journal/feed.xml → RSS 2.0, 6 items
```

> The main `/sitemap.xml` is untouched. Aether's section sitemap is
> opt-in for crawlers that want to discover the preview.

OG cards (AE50) work out of the box — verify at deploy time with
Facebook Sharing Debugger + Twitter Card Validator. The image source
is `images.unsplash.com` (allowlisted in `next.config.ts`, AE54).

---

## 6 · When things go sideways

| Symptom                                                 | First suspect                                                                                      | Memory ref                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `/aether/drift` is 404                                  | Feature flag not set or dev server not restarted                                                   | `feedback_stale_bundle_first_suspect`     |
| Page loads but `Pulse` shows "intelligence unreachable" | API not running or wrong port                                                                      | `feedback_run_api_before_judging_ui`      |
| Roles guard rejects you after `promote-user.sh`         | You didn't log out + back in                                                                       | `feedback_role_jwt_relogin`               |
| Photographs render as gradient placeholders             | Unsplash 404'd that id; `<SafeImg/>` is doing its job — replace the id in `photos.ts` or `data.ts` |
| `pnpm install` fails in `apps/mobile/`                  | Use `pnpm install --ignore-workspace` from there                                                   | `feedback_expo_react_workspace_collision` |
| Commit rejected by commitlint                           | Subject line >100 chars                                                                            | `feedback_commitlint_subject_length`      |

---

## 7 · The 8-line elevator pitch

> **Aether 2.0** is the editorial Indian travel super-app surface, env-
> gated by `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW`. Sixteen Aether routes
> (`/drift · /atlas · /destinations[/slug] × 15 · /journal[/slug] × 6
· /about · /plan · /journey/[id] · /me + /me/journeys + /me/shares
· /account · /onboarding · /shared/[code] · /dispatch`). Every route
> uses the Warm Italian palette, Playfair + Inter type, motion-respecting
> reveals, mandatory ambient audio (respects mute), and a Pulse AI
> drawer with voice input (AE59). Trip PDF export (AE63). Section
> sitemap + RSS feed for journal. Mobile-responsive via `useViewport`.
> See [the 07/08/09 docs](./README.md) for everything else.

---

_Installed by AE64. Update on every breaking change to the
operator-facing flow (new env var, new route, new test gate)._

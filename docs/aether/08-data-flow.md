# Aether — Data flow

ASCII box-and-arrow diagrams of how data moves through the Aether surfaces.
Pair this with `07-implementation-log.md` (history) and `09-component-catalog.md`
(static structure).

> Every flow respects the same auth posture as the main app: access
> tokens in memory only, refresh tokens in httpOnly cookies, no
> localStorage tokens. Routes that need auth gate on
> `useAetherAuth().isAuthed` (the AE354 composite hook — equivalent to
> the prior `useAuthBootComplete() && useAuthToken() !== null` trio).

---

## 1. Pulse → sample-plan → save-as-trip → /aether/journey/[id]

The conversational save loop. No auth needed to chat, auth needed to save.

```
┌────────────────────────┐
│  user types in Pulse   │
│  drawer ("Jaipur for   │
│  three days, cheap")   │
└──────────┬─────────────┘
           │ 1. ask(trimmed)
           ▼
┌────────────────────────┐
│ geocodeOne(text)       │  ┌────────────────────┐
│ — 1h cached            │──▶ Photon (komoot)    │
│ — Nominatim fallback   │  │ /api/photon/...    │
└──────────┬─────────────┘  └────────────────────┘
           │ 2. {lat, lng, label}
           ▼
┌────────────────────────┐
│ tripControllerSamplePlan│ 3. POST /trips/sample-plan
│ ({title, center, 50km})│──▶ ────────────────────┐
└──────────┬─────────────┘                        │
           │ 4. {plan, provider}                  │
           ▼                                      ▼
┌────────────────────────┐         ┌────────────────────────┐
│ ctxRef.current =       │         │ AI Port chain:         │
│  {title, center, plan} │         │  Gemini → Ollama       │
│ messages.append(plan)  │         │  → stub  ($0 fallback) │
└──────────┬─────────────┘         └────────────────────────┘
           │
           │ — user types a refinement ("two more days")
           ▼
┌────────────────────────┐
│ ask(text) — isFollowUp │
│ uses ctxRef.title +    │
│ center, body includes  │
│ {instruction, priorPlan}│
└──────────┬─────────────┘
           │ (loop — refines the plan)
           │
           ▼
┌────────────────────────┐
│ "Save this as a real   │  5a. createTrip.mutate({data})
│  trip" CTA clicked     │──▶ ───────────────────────┐
└──────────┬─────────────┘                           │
           │ (auth-gated; signed-out routes to /login)│
           │                                          ▼
           │                              ┌────────────────────────┐
           │                              │ POST /trips            │
           │                              │ — returns TripDto      │
           │                              └──────────┬─────────────┘
           │                                         │
           │  ┌──────────────────────────────────────┘
           │  │  6a. router.push(/aether/journey/[id])
           ▼  ▼
┌────────────────────────────────────────────────────┐
│ /aether/journey/[id] — useTripControllerGetOne    │
│  + useTripControllerGetItinerary                  │
└────────────────────────────────────────────────────┘

           │ Alternative: "Save + share immediately"
           ▼
┌────────────────────────┐
│ createTrip.mutate      │ 5b. POST /trips
│ shareAfterSave = true  │──▶─┐
└────────────────────────┘    │
           ▲                  ▼
           │     ┌────────────────────────┐
           │     │ Returns TripDto        │
           │     │ shareTrip.mutate(id,{}) │
           │     └──────────┬─────────────┘
           │                │ 5c. POST /trips/[id]/share
           │                ▼
           │     ┌────────────────────────┐
           │     │ TripShareResponseDto   │
           │     │  {shareCode, ...}      │
           │     └──────────┬─────────────┘
           │                │ 6b. copy /shared/[code] to clipboard
           │                │     show "Link copied · journey opening"
           │                ▼
           │     ┌────────────────────────┐
           └─────│ router.push(/aether/   │
                 │  journey/[id]) after   │
                 │  900ms                 │
                 └────────────────────────┘
```

## 2. Plan form → POST /trips → /aether/journey/[id]

The explicit planner path. Pre-fills via `?where=`, `?pace=`, `?days=`.

```
┌────────────────────────┐
│ /aether/destinations/  │
│ [slug] — "Plan this    │
│ with AI" CTA           │
└──────────┬─────────────┘
           │ <Link href=/aether/plan?where={d.name}>
           ▼
┌────────────────────────┐
│ /aether/plan           │
│ useSearchParams()      │
│ pre-fills the form     │
└──────────┬─────────────┘
           │ on submit:
           ▼
┌────────────────────────┐
│ geocodeOne(where, 'India',
│  DEFAULT_CENTER)       │  Photon → Nominatim
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ useTripControllerCreate│
│ ({title, center, 50km})│  POST /trips
└──────────┬─────────────┘
           │ onSuccess
           ▼
┌────────────────────────────────────────────────────┐
│ router.push(/aether/journey/[returned.id])         │
└────────────────────────────────────────────────────┘
```

## 3. Journey dashboard → share / archive / duplicate / itinerary

The trip-lifecycle surface.

```
                  /aether/journey/[id]
                          │
                          │ useTripControllerGetOne(id)
                          │ useTripControllerGetItinerary(id)
                          ▼
        ┌─────────────────┬─────────────────────────┐
        │                 │                         │
        ▼                 ▼                         ▼
   ┌─────────┐      ┌───────────┐            ┌───────────┐
   │ TripDto │      │ Itinerary │            │ ?addPlace=│
   │ render  │      │ List      │            │ banner    │
   │ title + │      │ Response  │            │ (AE45)    │
   │ facts   │      │ Dto       │            └───────────┘
   └────┬────┘      └─────┬─────┘
        │                 │
        ├─► useTripControllerArchive   ─►  POST /trips/[id]/archive
        ├─► useTripControllerUnarchive ─►  POST /trips/[id]/unarchive
        ├─► useTripControllerShare     ─►  POST /trips/[id]/share
        │       └─► /shared/[code] + clipboard
        └─► useTripControllerDuplicate ─►  POST /trips/[id]/duplicate
                └─► router.push(/aether/journey/[new id])

         day cards render: dayIndex+1 numeral cap, summary.title,
         summary.subtitle, items[].startTime/endTime + notes.
```

## 4. Cross-trip share index `/aether/me/shares`

One outer hook lists trips; each <TripShareBand> child hook lists its shares
(rules-of-hooks demands the per-trip hook in a child component).

```
              /aether/me/shares
                     │
                     │ useTripControllerList(active) + (archived)
                     ▼
              trips = active ∪ archived
                     │
            map over each trip
                     │
                     ▼
        ┌─────── <TripShareBand trip={t}/> ───────┐
        │       useTripControllerListShares(t.id) │
        │       useTripControllerRevokeShare      │
        │                                         │
        │  for each share in shares:              │
        │    show {shareCode, createdAt, expiresAt,│
        │         publicRead?}                    │
        │    Copy → clipboard.writeText(url)      │
        │    Revoke → DELETE /trips/[id]/share/   │
        │             [code] → invalidate         │
        └─────────────────────────────────────────┘
```

## 5. `/aether/shared/[code]` — read-only + clone

Public read. Clone needs auth.

```
                /aether/shared/[code]
                       │
                       │ useTripControllerGetSharedTrip(code) — public
                       ▼
              ┌──────────────────────┐
              │ SharedTripDto:       │
              │  title, ownerName,   │
              │  facts, days[]       │
              └──────────┬───────────┘
                         │
       ──────────────────┼──────────────────
       │                                  │
   render read-only                  "Clone this journey →"
       │                                  │
       ▼                                  ▼
   (no edit UI)                useTripControllerCloneShared
                                          │
                                          │ auth-gated
                                          ▼
                                  POST /trips/shared/[code]/clone
                                          │
                                          ▼
                                  TripDto (new owner = caller)
                                          │
                                          ▼
                                  router.push(/aether/journey/[new id])
```

## 6. Account + Identity → useAuthControllerMe

`/aether/account` + `/aether/me` both consume `useAuthControllerMe()`.

```
                  page loads
                       │
        token / bootComplete from useAuthBootComplete()
                       │
                       ▼
              isAuthed?
                  │
          ┌───────┴───────┐
          │               │
         yes              no
          │               │
          ▼               ▼
useAuthControllerMe     show sign-in wall
   {sub, sid, role,        → /login?next=...
    hasSeenOnboarding,
    previousSeenAt}
          │
          ├──► /aether/account: render identity dl, audio + motion
          │      sections, deep-link /account/privacy, Sign out
          │      → POST /auth/logout → clearAccessToken + queryClient.clear
          │      → router.replace(/login)
          │
          └──► /aether/me: render {role} stats strip (drafts, total,
                 archived) + 3 large cards → /journeys, /shares, /account
```

## 7. Atlas permalink (AE358–AE360)

Round-trip URL ↔ state for the Atlas surface so a copied URL re-opens
filtered + focused on the same pin.

```
                    URL: /aether/atlas?q=leh&season=1&focus=leh
                                │
                                │ mount: read window.location.search
                                ▼
                    parseAtlasParams({q, season, focus})
                                │
                                ├─ seeds useState<q>          → '/leh'
                                ├─ seeds useState<seasonOnly> → true
                                └─ seeds useState<focusSlug>  → 'leh'
                                │
                                │ user types / toggles / focuses rows
                                ▼
                    {q, seasonOnly, focusSlug} change
                                │
                                │ 250ms debounce
                                ▼
                    buildAtlasQuery({q, season, focus})
                                │
                                ▼
                    router.replace(`${pathname}?...`, { scroll: false })
                                │
                                ├─ atlasParamsEqual gates redundant writes
                                └─ focusSlug auto-clears when filter excludes it
```

`focusRow(idx)` mirrors `focusSlug = filtered[idx].slug` so the cursor
position and the URL stay in sync; a copied URL with `?focus=<slug>`
runs `focusRow(matchingIdx)` once on mount via `requestAnimationFrame`.

## 8. Pulse @-mention autocomplete (AE363/AE364)

```
                user types "Plan @le" in the Pulse composer
                                │
                                │ onChange / onKeyUp / onClick
                                ▼
                tracked: cursorPos (selectionStart)
                                │
                                ▼
                currentMentionAtCursor(q, cursorPos)
                                │
                                ├── null ─────── no drawer
                                │
                                └── {start, end, query} ──┐
                                                          ▼
                                                 ALL_SLUGS.filter(s =>
                                                   s.startsWith(query)
                                                 ).slice(0, 6)
                                                          │
                                                          ▼
                                            <button> drawer (role=listbox)
                                                  rendered above the input
                                                          │
                                              onMouseDown (NOT onClick — so
                                              input doesn't blur first)
                                                          │
                                                          ▼
                                        applyMentionCompletion(q, cursorPos, slug)
                                                          │
                                                          ▼
                                              setQ(next.text)
                                              setCursorPos(next.cursor)
                                              inputRef.setSelectionRange(...)
```

Slash-command drawer (AE85) and mention drawer are mutually exclusive
(mention drawer hides when `q.startsWith('/')`).

## 9. RSS + sitemap

Build-time discovery (no auth, no DB).

```
   /sitemap.xml          (main)            — untouched, NOT Aether
   /aether/sitemap.xml   (section)         — env-gated
       │                                     - 7 static + 15 dest + 6 journal URLs
       │                                     - returns [] when AETHER_PREVIEW=0
       ▼
   /aether/journal/feed.xml (RSS 2.0)
       │
       └─► ALL_JOURNAL_SLUGS → JOURNAL_ARTICLES → channel + 6 items
            Each item: title, link, pubDate, author, category, content:encoded
            Cache-Control: public, max-age=3600
```

---

_Diagrams are illustrative; the source of truth is the code under
`apps/web/src/components/aether/` and `apps/web/src/app/aether/`._

---

## Cross-cutting hooks and helpers (added by Rounds AI–AM)

Surfaces composed during AI–AM rely on a small canonical kit instead
of inlined patterns. When reading any data flow above, mentally
substitute:

| Pattern (legacy)                                                                      | Canonical helper                                            |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `useAuthToken()` + `useAuthBootComplete()` + `bootComplete && token !== null`         | `useAetherAuth()` (AE354)                                   |
| `useTripControllerList({...},{...})` + `tripsFromQuery<TripDto>(query)`               | `useAetherTripList({archived, limit, enabled})` (AE362)     |
| `(q.data?.data as { trips?: TripDto[] }                                               | undefined)?.trips ?? []`                                    | `tripsFromQuery<TripDto>(query)` (AE346) |
| `window.dispatchEvent(new CustomEvent('aether-pulse-open', { detail: { prefill } }))` | `openPulse(prefill, {submit?})` (AE331)                     |
| `navigator.clipboard.writeText(text)` + textarea fallback                             | `copyTextToClipboard(text)` (AE196)                         |
| inline `setX(true); setTimeout(() => setX(false), 2000)`                              | `useTransientFlag(2000)` (AE347)                            |
| inline `setX(value); setTimeout(() => setX(null), ms)`                                | `useTransientValue<T>(ms)` (AE351)                          |
| inline `if (!armed) { setArmed(true); setTimeout(..., 4000) }`                        | `useConfirmTwoStep(action, ms)` (AE332)                     |
| `${origin}/shared/${shareCode}` / `/aether/shared/${shareCode}`                       | `buildShareUrl({ origin, code, surface? })` (AE218)         |
| inline `Math.max(0, Math.min(1, x))`                                                  | `clamp01(x)` (AE227) / `clamp(x, lo, hi)`                   |
| inline `String(idx + 1).padStart(2, '0')`                                             | `ordinalLabel(idx)` (AE361)                                 |
| inline asIso / fmtDate / fmtTime / daysBetween                                        | `@/lib/aether-dates` (AE171)                                |
| inline `try/JSON.parse + window.localStorage.getItem`                                 | `readJSON(key, fallback)` (AE238) + `safeJsonParse` (AE228) |

---

## 8. `@app/aether-canvas-shared` (Round AK + AL — 35 pure modules)

Phase 4 mobile-parity prep moved every framework-free pure helper
out of `apps/web/src/components/aether/phase{1,2,3}/` into a single
workspace package. Both the web canvas (`@app/aether-canvas`) and
the eventual native canvas (`@app/aether-canvas/native`) import from
here so the geometry / lifecycle / palette math is bit-for-bit
identical across platforms.

```
              ┌──────────────────────────────────────────────────────────┐
              │             @app/aether-canvas-shared                    │
              │             (35 pure modules, 0 peer deps)               │
              ├──────────────────────────────────────────────────────────┤
              │ • lifecycle-progress     • genie-state    • mirror-globe │
              │ • lifecycle-camera       • genie-particles • mirror-investigate
              │ • pulse-breathing        • genie-camera   • echo-feed    │
              │ • atlas-orbs             • genie-recorder • echo-layout  │
              │ • compass-rose           • continuum-state • live-trip-watch
              │ • lumen-cloud            • continuum-sigil • lumen-museum│
              │ • lumen-keyboard         • continuum-landing • lumen-pinch
              │ • lumen-selection        • vault-glyphs   • lumen-strategies
              │ • vault-glyph-positions  • vault-checkout │              │
              │ • vault-sample-prices    • pulse-hold-to-talk            │
              │ • url-ttl                • weather-simulation            │
              │ • now-card-content       • now-card-lifecycle            │
              │ • destination-coords     • upcoming-trip                 │
              └──────────────────────────────────────────────────────────┘
                       ▲                              ▲
                       │ re-export shim               │ direct import (future)
                       │ (apps/web/.../*.ts)          │
                       │                              │
              ┌────────────────────┐         ┌────────────────────────┐
              │  apps/web phase{1, │         │  apps/mobile (Phase 4) │
              │  2, 3}/*.ts files  │         │  @app/aether-canvas/   │
              │  — 30+ shims, each │         │  native (when wired)   │
              │  1-line re-export  │         │                        │
              └────────────────────┘         └────────────────────────┘
```

Round-by-round migration history:

| Round | Slices      | Modules added                                                                                                                                                                                                 |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK    | AE453-AE457 | lifecycle-progress + lifecycle-camera (AE454); pulse-breathing (AE455); 5 spatial layouts (AE456); 3 weather + time + coords (AE457). 11 modules.                                                             |
| AL    | AE469-AE481 | 4 Genie (AE469); 3 Continuum (AE470); 2 Mirror (AE471); 2 Echo + LiveTrip (AE477); 5 Lumen interactions (AE478); 5 Vault + Pulse + url-ttl (AE479); 2 Now Card lifecycle + upcoming-trip (AE480). 23 modules. |

Every dependency is type-only (`SurfaceLifecyclePhase` from
`@app/aether-core`). No React, no DOM, no Three.js, no R3F. Hermes-safe.

Cross-package integration (AE472) pins the three-way handoff
contract: `useSurfaceLifecycle()` (aether-core) → `easedPhaseProgress`

- `cameraPoseAt` (canvas-shared) → `channelGainsAt` (aether-audio).
  All three modules must co-evolve for the surface lifecycle to read
  as one seamless animation.

Shape gates: AE481 (canvas-shared own barrel) + AE483 (web phase1
barrel) + AE484 (web phase2 barrel). Renaming any export now fails
a paired spec loudly.

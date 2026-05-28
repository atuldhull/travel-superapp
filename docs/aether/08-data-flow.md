# Aether — Data flow

ASCII box-and-arrow diagrams of how data moves through the Aether surfaces.
Pair this with `07-implementation-log.md` (history) and `09-component-catalog.md`
(static structure).

> Every flow respects the same auth posture as the main app: access
> tokens in memory only, refresh tokens in httpOnly cookies, no
> localStorage tokens. Routes that need auth gate on
> `useAuthBootComplete() && useAuthToken() !== null` before firing
> any hook.

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

## 7. RSS + sitemap

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

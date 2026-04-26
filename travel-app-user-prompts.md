# Travel-App — 40 user personas, requirements, and build prompts

> Companion to `travel-app-prompts.md`. Where that file is **architecture-first** (per Playbook subsection),
> this one is **user-first** — every entry is a real human persona, what they need, and the concrete
> build prompt that makes the app actually solve their problem.
>
> **Prompt-id namespace:** `[V.UX.1]` … `[V.UX.40]`. Each prompt is self-contained; pick any in any order.
>
> **Format per persona:**
>
> 1. **Who they are** — one-sentence sketch
> 2. **Goals** — what they're trying to accomplish
> 3. **Pain points** — what currently blocks / annoys them
> 4. **Required features** — the concrete capability list
> 5. **Catchy interface notes** — UX patterns + microcopy that pull them in
> 6. **Build prompt** — the executable slice spec (files, deps, AC, prompt id)

---

## Index

1. [V.UX.1] First-time visitor
2. [V.UX.2] Returning unauthenticated browser
3. [V.UX.3] Just-registered user
4. [V.UX.4] Casual weekend traveler
5. [V.UX.5] Frequent business traveler
6. [V.UX.6] Power planner
7. [V.UX.7] Spontaneous improviser
8. [V.UX.8] Group trip organizer
9. [V.UX.9] Group trip participant (invited collaborator)
10. [V.UX.10] Anonymous share-link recipient
11. [V.UX.11] Memory-book viewer (auth-less)
12. [V.UX.12] Memory-book author / curator
13. [V.UX.13] Solo female / safety-first traveler
14. [V.UX.14] Family with kids
15. [V.UX.15] Senior / accessibility-needs traveler
16. [V.UX.16] Budget backpacker
17. [V.UX.17] Premium / luxury traveler
18. [V.UX.18] International first-timer
19. [V.UX.19] Domestic / hyper-local traveler
20. [V.UX.20] Foodie
21. [V.UX.21] Adventure / nature traveler
22. [V.UX.22] Cultural / religious tourist
23. [V.UX.23] Digital nomad / long-stay
24. [V.UX.24] Verified agent / local guide
25. [V.UX.25] Reviewer / community contributor
26. [V.UX.26] Notification-driven user
27. [V.UX.27] Mobile-first user
28. [V.UX.28] Accessibility / screen-reader user
29. [V.UX.29] Power-keyboard user
30. [V.UX.30] Returning user after long gap
31. [V.UX.31] Account-recovery user
32. [V.UX.32] GDPR / DPDP-conscious user
33. [V.UX.33] Soft-deleted user (7-day undo window)
34. [V.UX.34] Banned user
35. [V.UX.35] SOS / emergency user
36. [V.UX.36] Admin / moderator
37. [V.UX.37] Compliance / legal reviewer
38. [V.UX.38] Oncall / SRE
39. [V.UX.39] Crawler / SEO bot
40. [V.UX.40] Investor / press / casual sceptic

---

## [V.UX.1] First-time visitor

**Who they are.** Just landed on `/` from a referral link, ad, or search result. No account. 30 seconds of attention, max.

**Goals.**

- Understand what the app does in one glance.
- Decide whether it's worth signing up.
- Try one thing without committing (search a place, see a memory book).

**Pain points.**

- Generic landing pages waste their time.
- Login walls before any value seen → bounce.
- "Travel app" is crowded; needs clear differentiator.

**Required features.**

- A landing hero with a one-line value prop ("Your AI-powered travel companion — plan, explore, stay safe").
- A live demo widget on `/`: "Try it" — type a city, see a sample 3-day itinerary instantly (no signup).
- Featured memory books carousel as social proof (already at `/featured`; promote on `/`).
- Two CTAs: "See a sample trip" (no auth) and "Sign up free" (auth).
- Subtle trust signals: "Used by N travelers", "Open-source", "GDPR / DPDP compliant".

**Catchy interface notes.**

- Animated hero illustration (city skyline morphing → itinerary card).
- Sticky "Try without signup" pill in header.
- Below-the-fold: 3 user-quote testimonials + 3 feature highlights with icons.
- Color: warm brand accent on the hero CTA, neutral elsewhere.

**Build prompt.**

```
[V.UX.1] Landing page rebuild for first-time visitors

Files to touch:
  apps/web/src/app/page.tsx                              (full rewrite)
  apps/web/src/components/landing/hero.tsx               (new)
  apps/web/src/components/landing/sample-trip-demo.tsx   (new — uses TRIP_PLANNER_PORT stub)
  apps/web/src/components/landing/featured-strip.tsx     (new — wraps useMemoryBookControllerFeatured)
  apps/web/src/components/landing/value-pillars.tsx      (new)

Deps: none new (use existing tailwind 4 + sdk hooks)

Acceptance criteria:
- `/` renders without auth.
- Hero: tagline + 2 CTAs + animated illustration.
- "Try a sample trip" widget: city input + radius slider → calls /trips/plan-with-ai (stub) and renders the prose plan inline. NO signup wall.
- 3-card "Featured memory books" strip pulled from /memory-books/featured.
- 3-pillar feature grid: AI itinerary, Live safety, Group planning.
- Mobile-first responsive (375px → 1440px).
- Lighthouse mobile perf > 90.
```

---

## [V.UX.2] Returning unauthenticated browser

**Who they are.** Has visited 2-3 times over a week. Still hasn't signed up. Curious but uncommitted.

**Goals.**

- Re-experience whatever caught their eye last time.
- See if anything new has landed.
- Find a low-friction signup hook.

**Pain points.**

- The site looks identical every visit; no memory of what they saw.
- No bookmark for the trip they were sketching.
- Signup form feels long.

**Required features.**

- Recent-activity localStorage banner: "You looked at Rishikesh last visit — pick up where you left off".
- "Try the trip planner without signup" — one-shot generation cached locally for 24h.
- Reduced-friction signup: email-only magic link option (passwordless).
- Visible "what's new" strip on `/` (latest 3 published memory books).

**Catchy interface notes.**

- Welcome-back toast on second+ visit.
- Persistent "Save this trip" button on the sample-trip widget; clicking prompts signup.
- Magic-link signup option above password (less friction).

**Build prompt.**

```
[V.UX.2] Returning-visitor recall + magic-link signup

Files to touch:
  apps/web/src/lib/visit-recall.ts                       (new — localStorage of last city + sample plan)
  apps/web/src/app/page.tsx                              (welcome-back banner)
  apps/web/src/app/register/page.tsx                     (add magic-link option)
  apps/api/src/modules/identity/...                      (POST /auth/magic-link/request + /auth/magic-link/consume)
  apps/api/src/modules/identity/.../magic-link-token.entity.ts   (new)
  packages/sdk regen + barrel re-exports

Deps: nodemailer or resend for email send (already used elsewhere?). Otherwise stub for dev.

Acceptance criteria:
- First visit: no banner. Second+ visit with localStorage hit: "Welcome back — continue planning Rishikesh →" banner.
- /register has a "Email me a sign-in link" option above the password form.
- Token expires in 15 min, single-use, scoped to email.
- E2E test: request → consume → /trips redirect.
```

---

## [V.UX.3] Just-registered user

**Who they are.** Account 0-7 days old. Has zero trips. Excited but doesn't know what to do first.

**Goals.**

- Get to a "wow" moment fast.
- Understand the app's mental model (trip = central object).
- Avoid the empty-state cliff.

**Pain points.**

- Logging in to an empty `/trips` page is depressing.
- No tour, no example, no template.
- Doesn't know that itineraries can be AI-generated.

**Required features.**

- 3-step guided onboarding on first sign-in: "Where are you going? → How long? → Generate".
- Pre-seeded "Sample trip" in `/trips` for new accounts (read-only, deletable).
- Inline tooltips on `/trips/new` for the first 3 visits.
- A `?tour=true` query parameter that re-triggers the onboarding flow.

**Catchy interface notes.**

- Confetti animation on first trip created.
- "0 / 3 trips planned this month" progress on the dashboard (gamification light).
- Empty `/trips` page: large illustrated CTA "Plan your first trip — takes 30 seconds".

**Build prompt.**

```
[V.UX.3] First-run onboarding + sample trip

Files to touch:
  apps/web/src/app/onboarding/page.tsx                   (new — 3-step wizard)
  apps/web/src/app/trips/page.tsx                        (empty-state CTA + sample-trip seed)
  apps/web/src/components/onboarding/step-where.tsx
  apps/web/src/components/onboarding/step-when.tsx
  apps/web/src/components/onboarding/step-generate.tsx
  apps/api/src/modules/trip/application/seed-sample-trip.use-case.ts (new — runs on first /trips GET if user has 0 trips)
  apps/api/src/modules/identity/...whoami extension     (boolean: hasSeenOnboarding)
  packages/sdk regen

Deps: none

Acceptance criteria:
- First sign-in → /onboarding (not /trips).
- Wizard: city → start/end dates → "Generate" → backend calls plan-with-ai → trip created → redirect /trips/[id].
- Skip flow: lands on /trips with the sample trip pre-seeded.
- /trips empty state shows the illustrated CTA.
- whoami includes hasSeenOnboarding boolean to suppress re-tour.
```

---

## [V.UX.4] Casual weekend traveler

**Who they are.** Solo or couple, takes 3-6 short trips a year, plans 1-2 weeks ahead.

**Goals.**

- Quick "what's there to do" answer for a weekend.
- Light planning — 2 days, max 4 stops a day.
- Save the plan to phone and forget the laptop.

**Pain points.**

- Power-planner UIs feel overwhelming.
- Wants a "weekend template", not a blank canvas.
- Mobile sync is critical; doesn't want to re-plan on phone.

**Required features.**

- Trip duration presets: "Weekend (2 nights)", "Long weekend (3 nights)", "Week".
- AI suggestion: "Based on Rishikesh in October, here are 6 must-do places — pick 4".
- One-tap "Add to itinerary" on every place card.
- "Open in mobile" QR code on the desktop trip view.

**Catchy interface notes.**

- Preset chip row above the date picker on `/trips/new`.
- Drag chosen places into day buckets — visually obvious, no nested menus.
- Sunday-evening reminder: "Your trip is tomorrow — packing checklist?".

**Build prompt.**

```
[V.UX.4] Weekend-trip presets + place-suggestion picker

Files to touch:
  apps/web/src/app/trips/new/page.tsx                    (preset chips)
  apps/web/src/components/trip/place-suggestion-picker.tsx (new — multi-select chip grid)
  apps/api/src/modules/trip/application/suggest-places-for-trip.use-case.ts (new)
  apps/api/src/modules/trip/interface/...                (POST /trips/:id/place-suggestions → returns 6 ranked places)
  packages/sdk regen
  apps/web/src/app/trips/[id]/page.tsx                   (QR-to-mobile button)

Deps: qrcode.react

Acceptance criteria:
- /trips/new has 3 preset chips that auto-fill startsOn/endsOn.
- After trip created, "Suggest places" button calls the new endpoint, returns 6 cards, multi-select adds to day buckets.
- /trips/[id] shows a small "Open on phone" button → modal with QR code linking back to the same URL.
```

---

## [V.UX.5] Frequent business traveler

**Who they are.** 1-3 trips a month, repeat cities, hates re-entering the same data.

**Goals.**

- Re-use prior trips as templates.
- Track expenses for reimbursement.
- Forward an itinerary to assistant / partner.

**Pain points.**

- Same hotel chain, same airport — typing it every time is friction.
- Expense tracking lives in a separate app.
- No "send to email" / "export PDF" surface.

**Required features.**

- "Duplicate trip" verb on `/trips/[id]`.
- Frequent-locations memory: top 5 cities autocompleted on `/trips/new`.
- Per-trip expense pane (already shipped at `/trips/:tripId/expenses` api side — promote it).
- Export-to-PDF button on `/trips/[id]`.
- Email-this-itinerary button (mailto: link with formatted body).

**Catchy interface notes.**

- "Duplicate" appears next to "Edit" on the trip header.
- Expense pane shows running total + USD conversion + "Export CSV for reimbursement".
- PDF includes day-by-day itinerary + venue addresses + emergency contacts.

**Build prompt.**

```
[V.UX.5] Trip duplication + PDF export + frequent-locations

Files to touch:
  apps/api/src/modules/trip/application/duplicate-trip.use-case.ts (new)
  apps/api/src/modules/trip/interface/...                (POST /trips/:id/duplicate)
  apps/web/src/app/trips/[id]/page.tsx                   (Duplicate button + Export PDF)
  apps/web/src/components/trip/export-pdf-button.tsx     (new — uses jspdf or @react-pdf/renderer)
  apps/web/src/lib/frequent-locations.ts                 (new — localStorage top-5 cities)
  apps/web/src/app/trips/new/page.tsx                    (autocomplete)
  apps/web/src/app/trips/[id]/expenses/page.tsx          (new — promote api expenses to web)
  packages/sdk regen

Deps: @react-pdf/renderer

Acceptance criteria:
- POST /trips/:id/duplicate creates a new draft trip with same title (+" copy"), radius, dates, and itinerary days/items copied. New owner = caller.
- /trips/[id] has a Duplicate button → redirects to the new trip.
- /trips/[id]/expenses lists, lets user add/delete; net balances visible.
- Export-PDF button generates a 1-2 page PDF and triggers download.
- /trips/new city input shows top-5 cached cities as suggestions.
```

---

## [V.UX.6] Power planner

**Who they are.** Researches for weeks, opens 40 tabs, wants total control.

**Goals.**

- Multi-day, multi-stop, optimized itinerary.
- Detailed venue info (hours, prices, photos, reviews).
- Drag-and-drop reordering, time-block editing.

**Pain points.**

- Other apps cap at simple itineraries.
- Can't see weather + transit + crowd in one glance.
- Manually optimizing the route hurts.

**Required features.**

- Drag-and-drop day items (@dnd-kit).
- Cross-day drag — move an item from Day 2 to Day 4.
- Auto-route-optimize button: "Reorder day 2 to minimize travel time".
- Side-by-side weather + crowd + transit overlay on each day.
- Per-item notes field (hours, prices, "skip on rainy day").

**Catchy interface notes.**

- Spreadsheet-like keyboard navigation (Tab to next field).
- Color-coded day pills.
- Map view alongside itinerary, with route drawn between stops.

**Build prompt.**

```
[V.UX.6] Power-planner mode on /trips/[id]

Files to touch:
  apps/web/src/app/trips/[id]/page.tsx                   (drag-drop + map sidebar)
  apps/web/src/components/trip/day-item-drag-list.tsx    (new — @dnd-kit/sortable)
  apps/web/src/components/trip/route-map.tsx             (new — Leaflet polyline between stops)
  apps/api/src/modules/trip/application/optimize-day-route.use-case.ts (new — call transport.routes)
  apps/api/src/modules/trip/interface/...                (POST /trips/:tripId/days/:dayId/optimize)
  packages/sdk regen

Deps: @dnd-kit/core @dnd-kit/sortable

Acceptance criteria:
- Day items reorder via drag (within day).
- Cross-day drag moves item to another day, preserves position.
- "Optimize day" button calls api, swaps order, shows before/after travel time.
- Map sidebar updates live as items reorder.
- Per-item notes field saves on blur via update-day-items.
```

---

## [V.UX.7] Spontaneous improviser

**Who they are.** Books day-of, walks into things. Phone-only, real-time decisions.

**Goals.**

- "What's near me right now?"
- "Is it open? Is it crowded? Is it raining?"
- Single tap, single screen.

**Pain points.**

- Other apps require pre-planning.
- Wants live, not curated.
- Battery + signal often poor.

**Required features.**

- "Near me now" mode — uses geolocation, returns 5 nearest places + transit options + weather + safety score.
- Live-companion mode (already in the playbook 0%, ship a slim version).
- Offline cache of last fetch.
- Voice input for "I want sushi" → eatery search.

**Catchy interface notes.**

- One big "Near me" CTA on dashboard.
- Compact card: photo + open/closed badge + walking time + price tier.
- Pull-to-refresh.

**Build prompt.**

```
[V.UX.7] Near-me-now composite endpoint + UI

Files to touch:
  apps/api/src/modules/trip/application/near-me-now.use-case.ts (new — composite of places + weather + safety + transport)
  apps/api/src/modules/trip/interface/...                (POST /near-me — body: { center, radiusKm })
  apps/api/src/modules/trip/interface/dto/...            (NearMeNowResponseDto)
  packages/sdk regen
  apps/web/src/app/near-me/page.tsx                      (new — geolocation + list)
  apps/web/src/components/near-me/place-card.tsx         (new — compact)
  apps/web/src/lib/offline-cache.ts                      (new — IndexedDB cache for last response)

Deps: idb (IndexedDB wrapper)

Acceptance criteria:
- POST /near-me with caller coords returns: 5 places, weather forecast, safety score, transport options for each place.
- /near-me page asks for geolocation, posts, renders cards.
- Offline: shows last cached response with timestamp.
- Voice input button (Web Speech API) on the search bar.
```

---

## [V.UX.8] Group trip organizer

**Who they are.** Plans the family vacation / friends weekend; herds cats.

**Goals.**

- Invite collaborators easily.
- See who's in, who voted, who paid.
- Lock the plan once finalized.

**Pain points.**

- Sharing a Google Doc loses formatting.
- No vote primitive — has to ask "who's good with X?" in group chat.
- Expenses chaos.

**Required features.**

- Mint share-codes UI (already api-side).
- Active share-codes list with revoke.
- Voting on places + items (already api-side; promote on web).
- Expense ledger with "settle up" suggestions.
- "Lock trip" verb — freeze edits.

**Catchy interface notes.**

- Share modal with copyable link + "send via WhatsApp" button.
- Vote tallies inline next to each place card.
- "Settle up" shows who-pays-whom arrows.

**Build prompt.**

```
[V.UX.8] Group-organizer pack: share-list, voting UI, settle-up

Files to touch:
  apps/web/src/app/trips/[id]/page.tsx                   (active-shares list + revoke + WhatsApp share)
  apps/web/src/components/trip/share-list.tsx            (new)
  apps/web/src/components/trip/vote-buttons.tsx          (new — up/meh/down on each item)
  apps/web/src/app/trips/[id]/expenses/page.tsx          (settle-up suggestions)
  apps/api/src/modules/social/application/settle-up.use-case.ts (new — minimum-cashflow algo)
  apps/api/src/modules/social/interface/...              (GET /trips/:tripId/expenses/settle-up)
  apps/api/src/modules/trip/application/lock-trip.use-case.ts (new)
  apps/api/src/modules/trip/interface/...                (POST /trips/:id/lock + /unlock)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Share modal lists active codes + revoke.
- Vote buttons under each itinerary item; tally updates live.
- Settle-up shows N-1 transfers (minimum cashflow) for the trip.
- Lock disables edits for everyone except owner; show banner.
```

---

## [V.UX.9] Group trip participant (invited collaborator)

**Who they are.** Got a share-code from a friend. Account-holder, not the organizer.

**Goals.**

- See the trip the organizer made.
- Vote, comment, add expenses they paid.
- Don't accidentally edit the wrong thing.

**Pain points.**

- Doesn't know what permissions they have.
- Wants their voice heard but not to override.

**Required features.**

- "Joined trip" badge on `/trips` listing.
- Visible role: "You're a collaborator on this trip".
- Vote + add-expense allowed; rename/delete blocked.
- Push notification when organizer locks the plan.

**Catchy interface notes.**

- Different header color for trips you don't own.
- "Suggested by [name]" attribution on items they added.

**Build prompt.**

```
[V.UX.9] Collaborator role surface + scoped permissions

Files to touch:
  apps/api/src/modules/trip/application/list-trips.use-case.ts (extend to include trips via active TripShare)
  apps/api/src/modules/trip/interface/dto/trip-response.dto.ts (add role: "owner" | "collaborator")
  apps/web/src/app/trips/page.tsx                        (badge + filter)
  apps/web/src/app/trips/[id]/page.tsx                   (role banner; gate edit/delete buttons on role)
  packages/sdk regen
  apps/api/src/modules/notifications/...                 (template: trip.locked → recipient = collaborators)

Deps: none

Acceptance criteria:
- /trips lists own + collaborated trips with a "shared" badge.
- /trips/[id] for collaborator: hides Edit/Delete, shows Vote/Expense; banner: "Collaborator on [Owner]'s trip".
- Locking a trip queues a notification to all active TripShare recipients.
```

---

## [V.UX.10] Anonymous share-link recipient

**Who they are.** Got a `/shared/[code]` link via WhatsApp; might not even sign up.

**Goals.**

- Open the link, view the trip.
- Maybe save / clone it for themselves.
- No friction.

**Pain points.**

- Other apps force signup to view.
- Link expiry is opaque.

**Required features.**

- Read-only `/shared/[code]` viewer (already shipped).
- "Save this trip to my account" CTA — sign up + clone.
- Visible expiry: "This link expires in 3 days".
- Comment / reaction without signup (anonymous, rate-limited).

**Catchy interface notes.**

- "Made in TravelSuperApp" footer with subtle CTA.
- Beautiful map preview at the top.
- "❤️ this trip" anonymous heart counter.

**Build prompt.**

```
[V.UX.10] Public shared-trip enrichment + clone + anonymous react

Files to touch:
  apps/web/src/app/shared/[code]/page.tsx                (expiry banner, clone CTA, ❤️)
  apps/api/src/modules/trip/application/clone-shared-trip.use-case.ts (new)
  apps/api/src/modules/trip/interface/...                (POST /trips/shared/:code/clone — auth required)
  apps/api/src/modules/social/application/heart-shared-trip.use-case.ts (new — IP-rate-limited)
  apps/api/src/modules/social/interface/...              (POST /trips/shared/:code/heart — @Public, rate-limited)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Shared viewer shows "Expires in N days" if expiresAt set.
- "Save to my account" CTA: if not authed → /register?then=clone&code=…; if authed → POST clone → redirect /trips/[newId].
- ❤️ button increments anonymous count, IP-rate-limited at 1/min.
```

---

## [V.UX.11] Memory-book viewer (auth-less)

**Who they are.** Found `/memory-books/[id]` from Featured page or external link.

**Goals.**

- Browse beautiful trip recaps.
- Find inspiration for own trips.
- Share their favorites.

**Pain points.**

- Generic photo galleries are boring.
- No context: where, when, what was the story?
- Can't easily go from "I like this" to "let me plan something similar".

**Required features.**

- Already shipped: typed thumbnails, theme badge, asset count.
- Add: per-asset captions.
- Add: "Plan a similar trip" CTA — pre-fills /trips/new with the book's geography.
- Add: social share (Twitter/X / WhatsApp / copy link) buttons.
- Add: full-screen lightbox for thumbs.

**Catchy interface notes.**

- Story-mode (vertical scroll, one asset per viewport).
- Reading time estimate at top.
- Author byline (displayName, joined date).

**Build prompt.**

```
[V.UX.11] Memory-book viewer storification + social share

Files to touch:
  apps/api/src/modules/media/application/...             (extend MemoryBookAsset with caption + position)
  prisma/schema.prisma                                   (MediaAsset.caption?: string, position int)
  prisma migration
  apps/web/src/app/memory-books/[id]/page.tsx            (story-mode toggle + lightbox + share row)
  apps/web/src/components/memory-book/lightbox.tsx       (new)
  apps/web/src/components/memory-book/social-share.tsx   (new)

Deps: yet-another-react-lightbox

Acceptance criteria:
- DB migration adds caption + position to MediaAsset (nullable).
- Owner can edit captions on /memory-books/[id]/edit.
- Public viewer renders captions below thumbs.
- "Plan similar" pre-fills /trips/new with book.geography (if available).
- Social share row works on desktop + mobile (Web Share API fallback to copy link).
```

---

## [V.UX.12] Memory-book author / curator

**Who they are.** Just finished a trip; wants to publish a polished recap.

**Goals.**

- Drag photos in; write a caption per photo.
- Pick a theme + cover.
- Publish + share.

**Pain points.**

- Other apps make galleries flat.
- No rich captioning.
- No layout choices.

**Required features.**

- Drag-and-drop reorder of attached assets.
- Per-asset caption editor.
- Theme picker (3-5 themes with preview).
- Cover image picker from attached assets.
- "Preview as public" mode.

**Catchy interface notes.**

- Live preview pane on the right while editing on left.
- Theme thumbnails clickable.
- Big "Publish" gradient button.

**Build prompt.**

```
[V.UX.12] Memory-book editor pro

Files to touch:
  apps/web/src/app/memory-books/[id]/edit/page.tsx       (split-pane layout + caption editing + theme picker)
  apps/web/src/components/memory-book/theme-picker.tsx   (new)
  apps/web/src/components/memory-book/preview-pane.tsx   (new — embeds the public viewer in iframe)
  apps/api/src/modules/media/interface/...               (PATCH /memory-books/:id/assets/:assetId — caption, position)
  apps/api/src/modules/media/application/reorder-book-assets.use-case.ts (new)
  packages/sdk regen

Deps: @dnd-kit/sortable

Acceptance criteria:
- Edit page: left = drag-list of assets with caption inputs + theme picker; right = live preview iframe.
- Drag-reorder persists via PATCH.
- Theme change updates preview instantly (CSS variable swap).
- "Preview as public" opens /memory-books/[id]?preview=true in new tab.
```

---

## [V.UX.13] Solo female / safety-first traveler

**Who they are.** Travels alone; safety is the dominant filter for every decision.

**Goals.**

- See safety score for any place she's considering.
- Read scam reports filed by other women.
- One-tap SOS with location share.

**Pain points.**

- Generic safety ratings don't account for nuance.
- SOS hidden behind menus.
- Can't filter scam reports by category (catcalling vs. theft).

**Required features.**

- Safety score on every place card.
- Scam-reports filter chips: "Theft", "Catcalling / harassment", "Taxi overcharge", "Fake guide".
- Floating SOS button on every screen, persistent.
- Trusted-contacts feature: pre-set 3 contacts; SOS auto-texts them with live location.
- "Safe routes" option in transport — biases away from low-safety areas.

**Catchy interface notes.**

- Red SOS pill at bottom-right, always visible.
- Confirm modal on SOS: "Trigger SOS? Your contacts will be notified."
- Color-coded safety badges: green/yellow/red on every card.

**Build prompt.**

```
[V.UX.13] Safety-first surfaces — score badges, filter chips, persistent SOS, trusted contacts

Files to touch:
  apps/web/src/components/safety/safety-badge.tsx        (new — green/yellow/red pill)
  apps/web/src/components/safety/sos-fab.tsx             (new — floating bottom-right button + confirm)
  apps/web/src/app/layout.tsx                            (mount SosFab)
  apps/api/src/modules/account/...                       (TrustedContact entity + 3 routes: list/add/delete)
  prisma/schema.prisma                                   (TrustedContact { id, userId, name, phone, email })
  prisma migration
  apps/api/src/modules/safety/application/trigger-sos.use-case.ts (extend — fan-out to trusted contacts via SMS adapter)
  apps/web/src/app/account/trusted-contacts/page.tsx     (new)
  packages/sdk regen

Deps: twilio (or stub adapter)

Acceptance criteria:
- Every place / eatery / stay card shows a safety badge derived from /safety/score.
- Reviews + scam reports list has filter chips by category.
- SOS FAB visible on every authed screen; tap → confirm → POST /safety/sos → trusted contacts notified.
- /account/trusted-contacts CRUD works; max 3 per account.
```

---

## [V.UX.14] Family with kids

**Who they are.** Parents traveling with 1-3 kids under 12. Different needs entirely.

**Goals.**

- Kid-friendly places, food, accommodation.
- Ground-floor / elevator-equipped stays.
- Realistic pacing — 3 things a day, max.

**Pain points.**

- Other apps don't filter by "good for kids".
- Restaurants without high chairs ruin meals.
- Hotels without cribs are deal-breakers.

**Required features.**

- "Family mode" toggle in account preferences.
- Filter chips: "Kid-friendly", "Stroller-accessible", "Has high chairs", "Has cribs".
- Pacing warnings: "That's 6 stops in one day — heavy for kids".
- Kid-meal options on eatery cards.

**Catchy interface notes.**

- Family-mode chip on dashboard.
- Tiny stroller / crib icons next to features.

**Build prompt.**

```
[V.UX.14] Family mode + kid-friendly filters

Files to touch:
  prisma/schema.prisma                                   (UserPreferences.familyMode boolean, hasKidsAges int[])
  prisma migration
  apps/api/src/modules/places/...                        (extend search to filter by features[])
  apps/api/src/modules/stays/...                         (extend search to filter by amenities including 'crib', 'high_chair', 'stroller_accessible')
  apps/web/src/app/account/preferences/page.tsx          (family-mode toggle + ages)
  apps/web/src/components/search/family-filter-chips.tsx (new)
  apps/web/src/app/trips/[id]/page.tsx                   (pacing warning component)

Deps: none

Acceptance criteria:
- Preferences page lets user toggle familyMode + add kid ages.
- When familyMode is on, search forms auto-add family filter chips.
- Day-pacing warning: "Day 2 has 6 items — kids may struggle" if familyMode + > 4 items.
```

---

## [V.UX.15] Senior / accessibility-needs traveler

**Who they are.** 60+ or accessibility-impaired (mobility, vision).

**Goals.**

- Large fonts, high contrast.
- Step-free routes.
- Slow / simple flows.

**Pain points.**

- Default UIs are too dense.
- "Senior mode" on other apps is patronizing.
- Tap targets too small.

**Required features.**

- "Comfort mode" toggle: 1.25× font, increased line-height, larger tap targets.
- Step-free routing in transport.
- Verbose labels on icons.
- Voice-over the trip plan ("read this to me").

**Catchy interface notes.**

- Comfort-mode banner: "Layout adjusted — more space, larger text".
- Audio play button at the top of trip pages.

**Build prompt.**

```
[V.UX.15] Comfort mode + audio readout + step-free routing

Files to touch:
  apps/web/src/app/account/preferences/page.tsx          (comfort-mode toggle)
  apps/web/src/lib/comfort-mode.ts                       (new — applies a .comfort class on root)
  apps/web/src/app/globals.css                           (.comfort overrides: --font-size-base etc.)
  apps/web/src/components/trip/audio-readout.tsx         (new — Web Speech API)
  apps/api/src/modules/transport/application/get-routes.use-case.ts (add stepFree filter)
  packages/sdk regen

Deps: none (Web Speech API is built-in)

Acceptance criteria:
- Comfort toggle persists in localStorage AND user prefs (so cross-device).
- Comfort mode visibly enlarges all type + spacing.
- Audio readout button on /trips/[id] reads the day list aloud.
- Transport routes have a "step-free only" toggle that filters legs.
```

---

## [V.UX.16] Budget backpacker

**Who they are.** $20-50/day, hostels, street food, free walking tours.

**Goals.**

- Cheap stays + cheap eats.
- Free events.
- Visa-on-arrival info.

**Pain points.**

- Other apps lead with luxury.
- Price isn't always shown clearly.
- Free events buried.

**Required features.**

- "Budget mode" filter cap: maxPriceTier = 2.
- Daily-spend tracker.
- Free-events filter.
- Hostel-specific stays filter.

**Catchy interface notes.**

- "$" pills next to every venue.
- "Today's spend: $34 / $50 budget" sticky banner.

**Build prompt.**

```
[V.UX.16] Budget mode + daily spend tracker + free events

Files to touch:
  apps/web/src/app/account/preferences/page.tsx          (budget cap + daily target)
  apps/web/src/components/budget/daily-spend-banner.tsx  (new)
  apps/api/src/modules/events/...                        (extend search with priceMax=0 → free only)
  apps/api/src/modules/stays/...                         (extend with stayType filter)
  apps/web/src/app/trips/[id]/page.tsx                   (sticky banner if budget set)

Deps: none

Acceptance criteria:
- Preferences: budget mode + daily target.
- Search forms hide priciness > cap.
- /trips/[id] shows sticky "Today: $X / $Y" banner that pulls from expenses.
```

---

## [V.UX.17] Premium / luxury traveler

**Who they are.** Wants curated, polished, high-touch.

**Goals.**

- Hand-picked stays.
- Concierge-level guidance.
- Verified agent option.

**Pain points.**

- Generic search returns chain hotels.
- Wants the "best of" not the "all of".

**Required features.**

- "Curated only" filter.
- Verified-agent matching for the destination.
- "Book with concierge" flow.
- Premium-only memory-book themes.

**Catchy interface notes.**

- Gold accent on premium features.
- "Premium" badge in account header.

**Build prompt.**

```
[V.UX.17] Premium tier surfaces

Files to touch:
  prisma/schema.prisma                                   (User.tier already exists; ensure 'premium' is honored)
  apps/web/src/components/upsell/premium-gate.tsx        (new — wraps premium-only features)
  apps/api/src/modules/places/...                        (extend search with curatedOnly)
  apps/api/src/modules/safety/application/match-agent-for-trip.use-case.ts (new — finds verified agents in destination)
  apps/api/src/modules/safety/interface/...              (POST /agents/match-for-trip)
  apps/web/src/app/trips/[id]/concierge/page.tsx         (new — agent-match UI)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Premium users see "Curated only" toggle + agent-match flow.
- Non-premium users see PremiumGate with upgrade CTA.
- Agent-match returns top 3 verified agents in destination region.
```

---

## [V.UX.18] International first-timer

**Who they are.** First time leaving home country; visa, language, scams all unknown.

**Goals.**

- Visa info for destination.
- Translation help on the ground.
- Scam awareness primer.

**Pain points.**

- Visa info scattered across govt sites.
- Translation apps separate.
- Scam categories country-specific.

**Required features.**

- Pre-trip primer: "Going to Thailand? Here's what to know".
- In-app translation widget (text + voice; uses Translation module — currently 0%).
- Scam-primer per country.
- Local emergency numbers card.

**Catchy interface notes.**

- "Pre-trip checklist" timeline on /trips/[id].
- Big translate button persistent in mobile header.

**Build prompt.**

```
[V.UX.18] International primer + translation widget + scam primer

Files to touch:
  apps/api/src/modules/translation/...                   (new module — port + Google Translate adapter or stub)
  apps/api/src/modules/safety/application/get-country-primer.use-case.ts (new — joins ScamReport categories by country)
  apps/api/src/modules/safety/interface/...              (GET /safety/country-primer/:countryCode)
  apps/web/src/components/translation/translate-widget.tsx (new — floating)
  apps/web/src/app/trips/[id]/primer/page.tsx            (new)
  apps/web/src/app/layout.tsx                            (mount translate widget if user.locale != trip.country.locale)
  packages/sdk regen

Deps: @google-cloud/translate (or stub)

Acceptance criteria:
- /trips/[id]/primer shows visa info (static seed initially), top scam categories, emergency numbers, language phrases.
- Translate widget translates clipboard text or typed text via the new port.
- Stub adapter returns "[stub] <text>" so dev works without keys.
```

---

## [V.UX.19] Domestic / hyper-local traveler

**Who they are.** Same-country, often same-region, day trips and weekenders.

**Goals.**

- Discover places nearby they haven't been.
- "Hidden gems" not "tourist hotspots".
- Local-language content.

**Pain points.**

- Apps optimized for international travel.
- Top results all the same chains.

**Required features.**

- "Local discoveries" mode: prefers low-relaxationScore-known venues.
- Day-trip distance filter (≤ 200km).
- Local-language reviews surfaced first.

**Catchy interface notes.**

- "Within driving distance" map section.
- "Hidden gem" pill for low-popularity high-rating venues.

**Build prompt.**

```
[V.UX.19] Hyper-local discovery mode

Files to touch:
  apps/api/src/modules/places/application/discover-hidden-gems.use-case.ts (new — filters by review-count threshold)
  apps/api/src/modules/places/interface/...              (POST /places/hidden-gems)
  apps/web/src/app/discover/page.tsx                     (new — geolocation + day-trip distance slider)
  apps/web/src/components/discover/gem-card.tsx          (new)
  packages/sdk regen

Deps: none

Acceptance criteria:
- POST /places/hidden-gems returns places with review_count between (5, 50) sorted by review average.
- /discover page asks for location, has distance slider 25-300km.
- Gem cards have "✨ Hidden gem" pill.
```

---

## [V.UX.20] Foodie

**Who they are.** Travels for food. Plans around restaurants.

**Goals.**

- Best dishes, not just best restaurants.
- Cuisine-specific search.
- Reviews from other foodies.

**Pain points.**

- "Best restaurants" lists ignore individual dishes.
- No way to track what they ate.

**Required features.**

- Dish-level reviews (DishReport already in entity export).
- Cuisine + dietary filters.
- "Food crawl" itinerary builder — multi-stop tasting.
- Photo-of-dish upload + caption.

**Catchy interface notes.**

- Tongue / fork emoji highlights.
- Dish-of-the-day strip on city pages.

**Build prompt.**

```
[V.UX.20] Dish-level surfaces + food-crawl itinerary

Files to touch:
  prisma/schema.prisma                                   (ensure DishReport surfaced; add Dish entity if missing)
  prisma migration
  apps/api/src/modules/food/application/list-dishes-for-eatery.use-case.ts (new)
  apps/api/src/modules/food/interface/...                (GET /eateries/:id/dishes, POST /eateries/:id/dishes)
  apps/api/src/modules/food/application/build-food-crawl.use-case.ts (new — k-stop optimized walk between eateries)
  apps/web/src/app/eateries/[id]/page.tsx                (new — dishes + reviews)
  apps/web/src/components/food/dish-card.tsx             (new)
  apps/web/src/app/trips/[id]/food-crawl/page.tsx        (new — multi-select eateries → optimized day plan)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Eatery page lists dishes; users can add a DishReport with photo + price.
- Food-crawl page lets user pick 3-5 eateries → returns walking-optimized order with estimated time.
```

---

## [V.UX.21] Adventure / nature traveler

**Who they are.** Hiking, climbing, water sports; outdoor and weather-sensitive.

**Goals.**

- Trail / outdoor venue discovery.
- Detailed weather (precip + wind).
- Difficulty / fitness level info.

**Pain points.**

- Weather forecasts too coarse for outdoor planning.
- No trail metadata.

**Required features.**

- Hourly weather (extend forecast).
- Trail / outdoor place category with difficulty + elevation.
- Gear checklist per activity.

**Catchy interface notes.**

- "Today's adventure window" widget — best 2-hour weather slot.
- Topographic-style map view.

**Build prompt.**

```
[V.UX.21] Adventure surfaces — hourly weather + trail metadata

Files to touch:
  apps/api/src/modules/weather/application/get-hourly-forecast.use-case.ts (new)
  apps/api/src/modules/weather/interface/...             (GET /weather/forecast/hourly)
  prisma/schema.prisma                                   (Place metadata.difficulty, .elevationM, .activityType)
  apps/web/src/app/places/[id]/page.tsx                  (extend with adventure metadata if present)
  apps/web/src/components/weather/adventure-window.tsx   (new — best 2hr slot)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Hourly endpoint returns 24-48h hourly with precip/wind/temp.
- Trail places show difficulty + elevation badges.
- Adventure-window widget on /trips/[id] shows the best 2hr slot in the next 24h.
```

---

## [V.UX.22] Cultural / religious tourist

**Who they are.** Visiting temples, festivals, cultural sites; mindful of customs.

**Goals.**

- Festival calendar.
- Dress code / etiquette per venue.
- Cultural history snippets.

**Pain points.**

- Apps don't surface cultural context.
- Festival info scattered.

**Required features.**

- Cultural-events filter on events search.
- Etiquette card per cultural venue.
- Festival calendar overlay on trip dates.

**Catchy interface notes.**

- 🛕 / 🕌 / ⛪ icons by venue type.
- "Festival on this day" banner on day cards.

**Build prompt.**

```
[V.UX.22] Cultural surfaces — festival calendar + etiquette

Files to touch:
  prisma/schema.prisma                                   (Place.metadata.etiquette: text, .dressCode: text)
  apps/api/src/modules/events/application/festivals-during.use-case.ts (new — joins events filtered by category=festival)
  apps/api/src/modules/events/interface/...              (GET /events/festivals?from=&to=&center=)
  apps/web/src/components/places/etiquette-card.tsx      (new)
  apps/web/src/app/trips/[id]/page.tsx                   (festival overlay on day cards)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Cultural place cards show etiquette + dress-code if metadata present.
- /trips/[id] day cards show "🎉 Diwali festival today" if festival overlaps.
```

---

## [V.UX.23] Digital nomad / long-stay

**Who they are.** 2-8 week stays; lives in cities, not visits.

**Goals.**

- Co-working spaces, monthly stays, fast wifi.
- Repeat-trip templates.
- Local SIM / connectivity info.

**Pain points.**

- Hotel search defaults to nightly.
- No remote-work amenities filter.

**Required features.**

- Stay search: monthly rate + wifi-speed filter.
- Co-working venue category.
- Connectivity info per city (avg mobile speed, SIM costs).
- "Long stay" trip template (4 weeks).

**Catchy interface notes.**

- "👨‍💻 Nomad mode" toggle.
- Wifi-speed badge on stays.

**Build prompt.**

```
[V.UX.23] Nomad mode — long stays + co-working + connectivity

Files to touch:
  apps/api/src/modules/stays/...                         (extend search with stayType=monthly + wifiSpeedMbps)
  prisma/schema.prisma                                   (Place category includes 'coworking'; Stay.wifiSpeedMbps?)
  apps/web/src/app/account/preferences/page.tsx          (nomad-mode toggle)
  apps/web/src/app/connectivity/[country]/page.tsx       (new — connectivity info)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Stays search has monthly toggle + wifi-speed slider.
- /connectivity/:country renders SIM/wifi avg from a seed dataset.
- Nomad mode persists in prefs.
```

---

## [V.UX.24] Verified agent / local guide

**Who they are.** Provides services, gets reviewed, manages bookings.

**Goals.**

- Profile page.
- Booking management.
- Review responses.
- Earnings dashboard.

**Pain points.**

- Currently no agent-side UI.

**Required features.**

- `/agent/dashboard`: bookings, reviews, earnings.
- Profile editor.
- Respond-to-review verb.
- KYC verification status.

**Catchy interface notes.**

- "Verified" badge on profile.
- Earnings sparkline.

**Build prompt.**

```
[V.UX.24] Agent dashboard + profile editor

Files to touch:
  apps/web/src/app/agent/dashboard/page.tsx              (new — gated to role=agent)
  apps/web/src/app/agent/profile/page.tsx                (new)
  apps/web/src/app/agent/bookings/page.tsx               (new)
  apps/api/src/modules/safety/...                        (AgentProfile already in domain — wire through)
  apps/api/src/modules/social/application/respond-to-review.use-case.ts (new)
  apps/api/src/modules/social/interface/...              (POST /reviews/:id/response)
  prisma/schema.prisma                                   (Review.responseBody, .responseAt)
  packages/sdk regen

Deps: none

Acceptance criteria:
- /agent/* gated to role=agent (otherwise 403 redirect).
- Dashboard shows bookings (last 30 days), reviews avg, earnings sum.
- Profile editor: bio, languages, regions, avatar.
- Reviews list has "Respond" inline editor.
```

---

## [V.UX.25] Reviewer / community contributor

**Who they are.** Posts reviews + votes for crowd-signal karma.

**Goals.**

- Get noticed for quality reviews.
- Track contribution stats.
- Earn badges / karma.

**Pain points.**

- No reputation surface.
- Reviews feel like shouts into the void.

**Required features.**

- Public profile with review count + helpful votes received.
- Karma score.
- Badges (10 reviews, 100 helpful votes, etc).
- "Top reviewer in [city]" leaderboard.

**Catchy interface notes.**

- Karma number next to displayName everywhere.
- Badge shelf on profile.

**Build prompt.**

```
[V.UX.25] Reviewer karma + badges + public profile

Files to touch:
  prisma/schema.prisma                                   (UserKarma { userId, score, badges[] }; HelpfulVote { reviewId, voterId })
  prisma migration
  apps/api/src/modules/social/application/cast-helpful-vote.use-case.ts (new)
  apps/api/src/modules/social/application/recompute-karma.use-case.ts (new — scheduled)
  apps/api/src/modules/social/interface/...              (POST /reviews/:id/helpful, GET /users/:id/profile)
  apps/web/src/app/users/[id]/page.tsx                   (new — public profile)
  apps/web/src/components/social/karma-pill.tsx          (new)
  apps/web/src/components/social/badge-shelf.tsx         (new)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Helpful votes increment karma (computed nightly).
- Profile page shows karma + badges + recent reviews.
- DisplayName everywhere has karma pill (e.g. "Atul · 240").
```

---

## [V.UX.26] Notification-driven user

**Who they are.** Lives in the inbox; reacts to alerts more than browses.

**Goals.**

- Real-time push.
- Single-tap actions from notification.
- Smart digests (weekly summary).

**Pain points.**

- Without push, has to keep checking.
- Mark-all-read tedious.

**Required features.**

- Web push via service worker.
- Notification preference per category.
- Weekly digest email.
- Tap-action: deep-link to the relevant trip/section.

**Catchy interface notes.**

- Inbox badge in header.
- Swipe-to-archive on rows.

**Build prompt.**

```
[V.UX.26] Web push + notification inbox + digest

Files to touch:
  apps/web/public/sw.js                                  (service worker for push)
  apps/web/src/lib/web-push-subscribe.ts                 (new)
  apps/api/src/modules/notifications/...                 (web-push adapter)
  apps/api/src/modules/notifications/application/send-weekly-digest.use-case.ts (new — scheduled)
  apps/web/src/app/inbox/page.tsx                        (new — list + swipe-archive + per-category prefs)
  apps/web/src/components/inbox/notification-row.tsx     (new)
  packages/sdk regen

Deps: web-push (npm)

Acceptance criteria:
- /inbox lists notifications, mark-read, archive.
- Per-category prefs persist.
- Browser push prompts on first visit; tapping a push opens deep-link.
- Weekly digest cron sends Sunday 8am local.
```

---

## [V.UX.27] Mobile-first user

**Who they are.** Exclusively on the RN app (not yet shipped); poor signal often.

**Goals.**

- Identical functionality to web.
- Offline mode.
- Battery-friendly.

**Pain points.**

- No RN app exists yet.

**Required features.**

- Expo 51 + Tamagui scaffold (per CLAUDE.md stack).
- ~10 screens replicating web routes.
- Offline trip view (last-fetched cached).
- Deep-link from web URLs.

**Catchy interface notes.**

- Native gestures (pull-to-refresh, swipe-back).
- Bottom tab bar.

**Build prompt.**

```
[V.UX.27] RN mobile shell — Expo 51 + Tamagui + 10 screens

Files to touch:
  apps/mobile/                                            (new package)
  apps/mobile/app/_layout.tsx                            (Expo Router root)
  apps/mobile/app/(tabs)/{trips,explore,inbox,profile}.tsx
  apps/mobile/app/trips/[id].tsx
  apps/mobile/app/memory-books/[id].tsx
  apps/mobile/lib/sdk.ts                                 (configures @app/sdk for native fetch)
  apps/mobile/lib/offline-cache.ts                       (AsyncStorage + queryClient persistor)
  packages/sdk                                            (no changes — apiFetch already runtime-agnostic)
  pnpm-workspace.yaml                                    (add apps/mobile)
  turbo.json                                              (add mobile pipeline)

Deps: expo@51 expo-router tamagui @tanstack/query-async-storage-persister

Acceptance criteria:
- pnpm --filter=mobile start launches Expo dev server.
- Bottom tabs work; auth flow uses same /auth endpoints.
- Trip detail renders identical content to web.
- Airplane mode: shows last cached trips with "offline" banner.
```

---

## [V.UX.28] Accessibility / screen-reader user

**Who they are.** Uses VoiceOver / NVDA; keyboard-only.

**Goals.**

- ARIA-correct.
- Logical focus order.
- No mouse-required interactions.

**Pain points.**

- Drag-and-drop without keyboard fallback.
- Modals trap focus poorly.
- Dynamic regions unannounced.

**Required features.**

- ARIA labels on every icon button.
- Keyboard fallback for drag (arrow-key reorder).
- Live-region announcements for async actions.
- Skip-to-main-content link.

**Catchy interface notes.**

- "Accessibility statement" in footer.

**Build prompt.**

```
[V.UX.28] A11y audit + ARIA + keyboard fallbacks

Files to touch:
  apps/web/src/app/layout.tsx                            (skip-to-main link)
  apps/web/src/components/ui/* (audit + label)
  apps/web/src/components/trip/day-item-drag-list.tsx    (add arrow-key reorder)
  apps/web/src/lib/announce.ts                           (new — live-region helper)
  apps/web/src/app/accessibility/page.tsx                (new — statement)

Deps: @axe-core/react (dev) for audit

Acceptance criteria:
- Lighthouse a11y score > 95 on every page.
- Every interactive element has aria-label.
- Drag list reorderable via keyboard (Tab to grip, arrow up/down).
- Async actions (save, delete) announced via live region.
```

---

## [V.UX.29] Power-keyboard user

**Who they are.** Wants shortcuts; rarely touches mouse.

**Goals.**

- Cmd+K for global search.
- Single-letter shortcuts (n=new, e=edit, d=delete).
- Vim-style navigation (j/k for list).

**Pain points.**

- Has to mouse for everything.

**Required features.**

- Global command palette (Cmd+K).
- Per-page shortcut hints (?-key opens help).
- Vim-style list navigation.

**Catchy interface notes.**

- "?" overlay shows shortcuts on every page.

**Build prompt.**

```
[V.UX.29] Command palette (Cmd+K) + shortcut sheet

Files to touch:
  apps/web/src/components/cmdk/command-palette.tsx       (new — Radix or cmdk lib)
  apps/web/src/lib/use-shortcuts.ts                      (new — global key handlers)
  apps/web/src/app/layout.tsx                            (mount palette)
  apps/web/src/components/cmdk/shortcut-sheet.tsx        (new — ? key opens)

Deps: cmdk

Acceptance criteria:
- Cmd+K opens palette with: search trips, search places, jump to /trips/new, sign out, etc.
- ? opens a shortcut cheat sheet.
- j/k navigate trip list focus.
- All shortcuts respect text-input focus (don't fire when typing).
```

---

## [V.UX.30] Returning user after long gap

**Who they are.** Account exists but stale; trips need refreshing.

**Goals.**

- See what they did last time.
- Be welcomed back, not lost.
- Quickly archive old trips.

**Pain points.**

- /trips dump is overwhelming after a year.
- Old trips clutter the active view.

**Required features.**

- "Welcome back, here's your last trip" hero on next sign-in.
- Auto-archive trips older than 1 year.
- Trip archive view.
- "Plan something new based on your past trips" suggestion.

**Catchy interface notes.**

- "Last trip: Bali, 14 months ago — relive memories?".
- Tabs on /trips: Active / Archived.

**Build prompt.**

```
[V.UX.30] Returning-user hero + trip archive

Files to touch:
  apps/api/src/modules/trip/...                          (Trip.archivedAt; auto-archive cron)
  prisma migration
  apps/api/src/modules/trip/interface/...                (POST /trips/:id/archive + /unarchive)
  apps/web/src/app/trips/page.tsx                        (Active/Archived tabs + welcome-back hero)
  apps/api/src/modules/trip/application/suggest-from-history.use-case.ts (new)
  apps/api/src/modules/trip/interface/...                (GET /trips/suggestions)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Trips older than 365 days auto-archive (overnight cron).
- /trips has Active/Archived tabs.
- First sign-in after 30+ day gap shows hero with last trip link.
- Suggestions endpoint returns 3 destinations based on past trip categories.
```

---

## [V.UX.31] Account-recovery user

**Who they are.** Forgot password, lost MFA, locked out.

**Goals.**

- Get back in.
- Fast, secure flow.

**Pain points.**

- Recovery emails arrive late.
- MFA backup codes lost.
- Support not responsive.

**Required features.**

- Password reset via email.
- MFA recovery via backup codes.
- Last-resort: identity verification via support form.

**Catchy interface notes.**

- "Trouble signing in?" link prominent on /login.

**Build prompt.**

```
[V.UX.31] Password reset + MFA recovery flow

Files to touch:
  apps/api/src/modules/identity/application/request-password-reset.use-case.ts (new)
  apps/api/src/modules/identity/application/consume-password-reset.use-case.ts (new)
  apps/api/src/modules/identity/interface/...            (POST /auth/password-reset/request + /consume)
  apps/api/src/modules/identity/...                      (extend MFA path with backup-code consume)
  apps/web/src/app/login/forgot/page.tsx                 (new)
  apps/web/src/app/login/reset/[token]/page.tsx          (new)
  apps/web/src/app/login/mfa-recover/page.tsx            (new)
  packages/sdk regen

Deps: nodemailer or resend

Acceptance criteria:
- Request reset → email with 15-min token.
- Consume → set new password.
- MFA backup codes (8 single-use) issued at MFA setup; one-shot consume.
- All flows rate-limited.
```

---

## [V.UX.32] GDPR / DPDP-conscious user

**Who they are.** Wants export + delete; reads privacy policy.

**Goals.**

- Download own data.
- Delete account.
- Understand what's stored.

**Pain points.**

- Other apps make this hard.

**Required features (already partially shipped).**

- /account/export already works.
- Surface it in account UI.
- Delete-my-account flow on web.
- Per-category data dashboard.

**Catchy interface notes.**

- /account/privacy page with stats: "We store: 24 trips, 130 photos, 8 reviews".

**Build prompt.**

```
[V.UX.32] /account/privacy hub — export, delete, stats

Files to touch:
  apps/web/src/app/account/privacy/page.tsx              (new — uses /account/export to derive stats + delete CTA)
  apps/web/src/app/account/page.tsx                      (new — account hub linking to privacy, prefs, security, trusted contacts)
  apps/api/src/modules/account/application/get-storage-stats.use-case.ts (new — counts per section)
  apps/api/src/modules/account/interface/...             (GET /account/stats)
  packages/sdk regen

Deps: none

Acceptance criteria:
- /account/privacy shows storage stats per section + Export JSON + Export NDJSON + Delete account.
- Delete shows 3-step confirm: "Have you exported your data? Type your email to confirm. Final confirm."
```

---

## [V.UX.33] Soft-deleted user (7-day undo window)

**Who they are.** Just deleted account; might regret.

**Goals.**

- Undo within 7 days.
- Confirm everything's gone after 7.

**Pain points.**

- No clear way to come back.

**Required features.**

- Soft-delete sets deletedAt + revokes sessions.
- Within 7 days: signing in shows "Your account is scheduled for deletion — restore it?".
- After 7: hard purge cron (already shipped).

**Catchy interface notes.**

- Email confirmation of deletion with reactivation link.

**Build prompt.**

```
[V.UX.33] Reactivation flow within retention window

Files to touch:
  apps/api/src/modules/identity/application/login.use-case.ts (extend to detect deletedAt within 7d → return reactivation token)
  apps/api/src/modules/account/application/reactivate-account.use-case.ts (new)
  apps/api/src/modules/account/interface/...             (POST /account/reactivate)
  apps/web/src/app/login/page.tsx                        (handle reactivation flow)
  apps/web/src/app/account/reactivate/page.tsx           (new)
  packages/sdk regen
  apps/api/src/modules/notifications/...                 (template: account.deletion-pending → with reactivate link)

Deps: none

Acceptance criteria:
- Sign-in attempt for soft-deleted user within 7d → "Restore your account?" page with one-click reactivate.
- Reactivate clears deletedAt, restores sessions.
- After 7d: sign-in returns USER_NOT_FOUND.
- Deletion-pending email sent on initial delete with reactivate link.
```

---

## [V.UX.34] Banned user

**Who they are.** Hit ban-hammer; admin set deletedAt or a ban flag.

**Goals.**

- Understand why.
- Appeal if wrongly banned.

**Pain points.**

- Vague "account suspended" with no info.

**Required features.**

- Distinct ban state vs. soft-delete.
- Reason field shown on sign-in.
- Appeal form linked.

**Catchy interface notes.**

- Empathetic copy: "Your account has been suspended. Here's why: ... You can appeal."

**Build prompt.**

```
[V.UX.34] Ban state distinct from delete + appeal flow

Files to touch:
  prisma/schema.prisma                                   (User.bannedAt, .banReason)
  prisma migration
  apps/api/src/modules/account/application/admin-ban-user.use-case.ts (extend to take reason)
  apps/api/src/modules/identity/application/login.use-case.ts (return BAN_REASON on banned login)
  apps/web/src/app/login/page.tsx                        (render banned state)
  apps/web/src/app/appeal/page.tsx                       (new — form posting to support)
  apps/api/src/modules/account/...                       (BanAppeal { id, userId, body, status, createdAt })
  packages/sdk regen

Deps: none

Acceptance criteria:
- Admin ban prompts for reason; reason persisted.
- Banned login renders the reason + appeal link.
- Appeal submission visible in admin queue.
```

---

## [V.UX.35] SOS / emergency user

**Who they are.** In trouble; one tap, no friction.

**Goals.**

- Trigger help fast.
- Share live location.
- Notify trusted contacts.

**Pain points.**

- SOS hidden.
- Geolocation permission slow.

**Required features (ties to V.UX.13).**

- SOS FAB persistent.
- 3-second hold to confirm (avoid accidental).
- Notify trusted contacts via SMS.
- Local emergency-services number displayed.

**Catchy interface notes.**

- Red breathing FAB.
- Big "I'm OK" cancel button after trigger.

**Build prompt.**

```
[V.UX.35] SOS resilience — hold-to-confirm + cancel + local 911

Files to touch:
  apps/web/src/components/safety/sos-fab.tsx             (extend — hold-to-confirm, cancel)
  apps/api/src/modules/safety/application/cancel-sos.use-case.ts (new)
  apps/api/src/modules/safety/interface/...              (POST /safety/sos/:id/cancel)
  apps/api/src/modules/safety/application/get-local-emergency.use-case.ts (new — country → numbers)
  apps/api/src/modules/safety/interface/...              (GET /safety/emergency-numbers/:countryCode)
  apps/web/src/components/safety/active-sos-banner.tsx   (new — sticky banner with cancel + emergency numbers)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Tap-and-hold 3s on FAB triggers SOS.
- Active SOS shows persistent banner with cancel + local emergency numbers.
- Cancel only by user.sub (own SOS).
- Numbers seeded for ~50 countries.
```

---

## [V.UX.36] Admin / moderator

**Who they are.** Internal staff with `role: 'admin'`.

**Goals.**

- Triage scam reports.
- Resolve SOS events.
- Ban/unban users.
- Audit moderation actions.

**Pain points.**

- Currently no admin UI on web.

**Required features.**

- /admin dashboard (gated).
- Moderation queues for scam reports + SOS.
- User search + ban.
- Audit log of admin actions.

**Catchy interface notes.**

- Sticky "Admin mode" red ribbon at top.
- Action confirmation modals.

**Build prompt.**

```
[V.UX.36] Admin dashboard on web

Files to touch:
  apps/web/src/app/admin/layout.tsx                      (new — role gate + red ribbon)
  apps/web/src/app/admin/page.tsx                        (new — counts dashboard)
  apps/web/src/app/admin/scam-reports/page.tsx           (new — list + verify/dismiss)
  apps/web/src/app/admin/sos/page.tsx                    (new — triage)
  apps/web/src/app/admin/users/page.tsx                  (new — search + ban)
  apps/web/src/app/admin/media/page.tsx                  (new — takedown)
  apps/web/src/app/admin/audit/page.tsx                  (new — admin action log)
  apps/api/src/modules/admin/...                         (AdminAuditLog entity + log writes from existing admin use-cases)
  packages/sdk regen

Deps: none

Acceptance criteria:
- All /admin/* gated to role=admin (otherwise 403).
- Each queue uses the typed admin endpoints already shipped.
- Every admin write logs to AdminAuditLog with actor + target + timestamp.
- Audit page is read-only, paginated, filterable by actor/target/action.
```

---

## [V.UX.37] Compliance / legal reviewer

**Who they are.** Internal/external; reviews retention, takedowns, audit trail.

**Goals.**

- Verify retention policies.
- Inspect takedown queue.
- Generate compliance reports.

**Pain points.**

- No compliance dashboard exists.

**Required features.**

- Retention dashboard: counts of soft-deleted, scheduled-purge.
- Takedown log.
- Export compliance report (CSV).

**Catchy interface notes.**

- /compliance/\* requires role=compliance (new).

**Build prompt.**

```
[V.UX.37] Compliance dashboard + retention + takedown report

Files to touch:
  prisma/schema.prisma                                   (UserRole enum: add 'compliance')
  prisma migration
  apps/api/src/modules/admin/application/get-retention-stats.use-case.ts (new)
  apps/api/src/modules/admin/application/list-takedowns.use-case.ts (new)
  apps/api/src/modules/admin/interface/...               (GET /compliance/retention, /compliance/takedowns)
  apps/web/src/app/compliance/page.tsx                   (new)
  apps/web/src/app/compliance/takedowns/page.tsx         (new — CSV export)
  packages/sdk regen

Deps: none

Acceptance criteria:
- Compliance role gates /compliance/*.
- Retention dashboard shows soft-deleted counts + days until purge.
- Takedown report lists every admin action against user-generated content.
- CSV export downloadable.
```

---

## [V.UX.38] Oncall / SRE

**Who they are.** Engineer on-call; checks /health, runbooks, dashboards.

**Goals.**

- Confirm system green.
- Diagnose incidents.
- Run safe ops actions.

**Pain points.**

- Runbooks scattered.
- /health doesn't show enough.

**Required features (mostly already shipped).**

- /health/ready + /startup endpoints.
- Operational README index.
- Force-purge button.

**Catchy interface notes.**

- /ops/dashboard (new) for human-readable health.

**Build prompt.**

```
[V.UX.38] /ops dashboard — health, runbooks, force-actions

Files to touch:
  apps/web/src/app/ops/page.tsx                          (new — gated to role in admin|compliance|sre)
  apps/web/src/app/ops/runbooks/page.tsx                 (new — index of docs/runbooks/*)
  apps/api/src/modules/admin/...                         (no new routes; reuse health + admin/account-purge)
  prisma/schema.prisma                                   (add 'sre' role)

Deps: none

Acceptance criteria:
- /ops/dashboard shows: liveness + readiness + last DB connection + Redis ping + S3 reachability.
- Runbooks page lists docs/runbooks/*.md with markdown rendering.
- Force-purge button calls existing /admin/account-purge.
- All gated to admin|compliance|sre.
```

---

## [V.UX.39] Crawler / SEO bot

**Who they are.** Googlebot, Bingbot, social-card scrapers.

**Goals.**

- Index public pages.
- Render meta tags + OG cards.

**Pain points.**

- Client-side-rendered pages may not be crawled.
- Missing OG / Twitter card metadata.

**Required features.**

- Sitemap.xml.
- Robots.txt with rules.
- OG / Twitter card meta on /featured, /memory-books/[id], /shared/[code].
- Server-rendered metadata via Next 15 generateMetadata.

**Catchy interface notes.**

- Pretty OG card per memory book (cover + title + theme).

**Build prompt.**

```
[V.UX.39] SEO + OG cards + sitemap

Files to touch:
  apps/web/src/app/sitemap.ts                            (new — Next 15 sitemap)
  apps/web/src/app/robots.ts                             (new)
  apps/web/src/app/memory-books/[id]/page.tsx            (add generateMetadata for OG/Twitter)
  apps/web/src/app/shared/[code]/page.tsx                (same)
  apps/web/src/app/featured/page.tsx                     (same)
  apps/web/src/app/og/memory-book/[id]/route.ts          (new — dynamic OG image @vercel/og)

Deps: @vercel/og

Acceptance criteria:
- /sitemap.xml lists all public memory-book + shared-trip + featured URLs.
- /robots.txt allows public, disallows /api/* and /account/*.
- Sharing /memory-books/[id] in Slack/Twitter renders a rich card with cover + title.
```

---

## [V.UX.40] Investor / press / casual sceptic

**Who they are.** Clicks once, judges in 30 seconds. The demo audience.

**Goals.**

- See the wow moment immediately.
- Trust signals (security, traction).
- Quick pitch.

**Pain points.**

- Long landing pages with no proof.
- No clear "what makes this different".

**Required features.**

- /demo route: scripted 60-second auto-play tour.
- Trust strip on /: GDPR, SOC2-pending, open-source repo link.
- "Press kit" page with screenshots + brand assets.
- Live metrics (anonymized): N trips planned this month, N memory books published.

**Catchy interface notes.**

- /demo full-screen Storybook-style scrolling tour with annotations.

**Build prompt.**

```
[V.UX.40] /demo + /press + live metrics strip

Files to touch:
  apps/web/src/app/demo/page.tsx                         (new — auto-playing scripted tour)
  apps/web/src/app/press/page.tsx                        (new — brand assets + screenshots)
  apps/web/src/components/landing/trust-strip.tsx        (new)
  apps/web/src/components/landing/live-metrics.tsx       (new — pulls /metrics-public)
  apps/api/src/modules/admin/application/get-public-metrics.use-case.ts (new — sanitized counts)
  apps/api/src/modules/admin/interface/...               (GET /metrics-public — @Public, cached)
  packages/sdk regen

Deps: framer-motion (for the scripted tour)

Acceptance criteria:
- /demo: 6 scenes, auto-advance every 8s, manual prev/next, ends with CTA.
- /press: downloadable brand kit + 5 screenshots.
- /metrics-public: { tripsThisMonth, memoryBooksThisMonth, activeUsersThisWeek } — anonymized counts only.
- Trust strip on / shows security + open-source links.
```

---

## Appendix — execution notes

- **Order of execution.** No mandatory order. Each prompt is self-contained. Suggested sequencing in the post-launch roadmap conversation.
- **Per-prompt commit format.** Use the Playbook convention: `feat(V.UX.<id>): <short summary>` and `docs(V.UX.<id>): progress-log entry`.
- **PROGRESS.md.** Append a row for every shipped V.UX prompt under a new section header `## V.UX log`.
- **Splitting prompts.** Some prompts (V.UX.27 RN shell, V.UX.18 translation, V.UX.36 admin dashboard) are multi-day. They can be split into sub-prompts `[V.UX.27.1]`, `[V.UX.27.2]`, etc., on first execution.
- **Schema migrations.** Many of these introduce new entities. Each migration is its own prompt step and lands BEFORE the use-case that consumes it.
- **No mock data shortcuts.** Where a prompt mentions a stub adapter (translation, push, SMS), real-provider wiring is a follow-up — not blocking.

_Compiled by `[V.UX.0]` on 2026-04-26._

# Aether — Implementation log

A chronological one-line record of every Aether (AE) commit. The
canonical source is `git log --grep '^feat(AE'` — this file is the
human-readable mirror that survives squash-merges and partial
rebases.

> **Phase**: 0 (preview, env-gated by `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW=1`)
> **Stack**: Next.js 15 App Router · React 18 · Aether packages
> (`@app/aether-{motion,core,canvas}`) · NestJS 11 backend (no new
> tables Phase 0) · Unsplash photography (replace in Phase 2).

---

## Round 0 — Foundations (AE1–AE4)

| #       | Commit hook                                               | Surface                                                        |
| ------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| **AE1** | `feat(AE1): aether-motion package — locked design tokens` | `@app/aether-motion` (palettes, spring, easing, type scale)    |
| **AE2** | `feat(AE2): aether-core package — AetherProvider + hooks` | `@app/aether-core` (useTheme, useMotionPolicy, useAudioEngine) |
| **AE3** | `feat(AE3): aether-canvas package — primitives`           | `@app/aether-canvas` (Reveal, ParallaxImg)                     |
| **AE4** | `feat(AE4): Storybook for Aether packages`                | aether-storybook app                                           |

## Round 1 — Drift hero (AE5–AE8)

| #       | Slice                          | Outcome                                                               |
| ------- | ------------------------------ | --------------------------------------------------------------------- |
| **AE5** | next/font + theme override     | Playfair Display + Inter via CSS variables prepended to locked stacks |
| **AE6** | Drift → editorial India layout | Full rebuild of /aether/drift with Sapore-bones + Indian content      |
| **AE7** | useParallax + IO-reveals       | Hero parallax + below-fold staggered reveals                          |
| **AE8** | Finishing pass                 | StatStrip, Esperienze grid, Voices, JournalPreview, EditorialFooter   |

## Round 2 — Destinations + Journal SSG (AE9–AE12)

| #        | Slice                       | Outcome                                                             |
| -------- | --------------------------- | ------------------------------------------------------------------- |
| **AE9**  | DestinationPage SSG         | Per-slug editorial layout (hero, facts, lede, moments, itineraries) |
| **AE10** | Journal article SSG         | Long-form per-slug page with pull-quotes + h2 sections              |
| **AE11** | Atlas constellation sketch  | Phase 0 stylised SVG-ish constellation (10 pins)                    |
| **AE12** | Atlas → Leaflet placeholder | (Later replaced by AE24 real Leaflet)                               |

## Round 3 — Closing the nav graph (AE13–AE17)

| #        | Slice                      |
| -------- | -------------------------- |
| **AE13** | /aether/journal index      |
| **AE14** | /aether/destinations index |
| **AE15** | /aether/about manifesto    |
| **AE16** | /aether/plan stub          |
| **AE17** | Misc copy / lint sweeps    |

## Round 4 — Plan → backend + Pulse + responsive (AE18–AE23)

| #        | Slice                                               |
| -------- | --------------------------------------------------- |
| **AE18** | Plan form → POST /trips                             |
| **AE19** | Pulse FAB scaffold                                  |
| **AE20** | useViewport — SSR-safe responsive hook              |
| **AE21** | Pulse → live AI chat (sample-plan)                  |
| **AE22** | Pulse threaded refinement (priorPlan + instruction) |
| **AE23** | Plan geocodes via Photon                            |

## Round 5 — Atlas + journey loop (AE24–AE29)

| #        | Slice                                              |
| -------- | -------------------------------------------------- |
| **AE24** | Real Atlas Leaflet — CartoDB Dark Matter + 10 pins |
| **AE25** | /aether/journey/[id] live dashboard                |
| **AE26** | +5 destinations (15 total) + 3 articles (6 total)  |
| **AE27** | Polish + photo notes                               |
| **AE28** | Pulse save-as-trip → /trips → /aether/journey/[id] |
| **AE29** | /aether/me/journeys index with filter chips        |

## Round 6 — Image safety + audio + responsive (AE30–AE35)

| #        | Slice                                             |
| -------- | ------------------------------------------------- |
| **AE30** | SafeImg — graceful 404 fallback                   |
| **AE31** | SafeImg applied across surfaces                   |
| **AE32** | AudioChip status pill in DriftNav                 |
| **AE33** | Mobile responsive sweep (8 surfaces)              |
| **AE34** | Drift hero photo carousel (4 photos, 9s rotation) |
| **AE35** | Geocode 1hr in-memory cache                       |

## Round 7 — Trip surface depth (AE36–AE39)

| #        | Slice                                                     |
| -------- | --------------------------------------------------------- |
| **AE36** | Trip share UI on journey dashboard                        |
| **AE37** | Archive/unarchive UI                                      |
| **AE38** | Destination `Plan this with AI` pre-fills /aether/plan    |
| **AE39** | AudioChip → settings popover (volume + mute + test chime) |

## Round 8 — Round A · trip surface depth ✦ AE40–AE45

| #        | Slice                                                     | Commit            |
| -------- | --------------------------------------------------------- | ----------------- |
| **AE40** | Itinerary day cards on journey dashboard                  | `98bf91d`         |
| **AE41** | Drift hero photographer credit overlay                    | `41195cb`         |
| **AE42** | Duplicate journey button on dashboard                     | `18cd5b2`         |
| **AE43** | /aether/me/shares cross-trip share index                  | `(round A close)` |
| **AE44** | Pulse save+share combo button                             | `d9c84e4`         |
| **AE45** | Destination 'Add to existing trip' CTA + dashboard banner | `299255d`         |

## Round 9 — Round B · new surfaces ✦ AE46–AE49

| #        | Slice                                                      |
| -------- | ---------------------------------------------------------- |
| **AE46** | /aether/onboarding first-time editorial welcome            |
| **AE47** | /aether/account editorial profile + settings               |
| **AE48** | /aether/shared/[code] Aether-styled read-only view + clone |
| **AE49** | /aether/me aggregate dashboard                             |

## Round 10 — Round C · quality ✦ AE50–AE54

| #        | Slice                                                                    |
| -------- | ------------------------------------------------------------------------ |
| **AE50** | OG + Twitter Card meta on every Aether route + shared `lib/aether-og.ts` |
| **AE51** | Playwright E2E smoke + a11y for Aether surfaces                          |
| **AE52** | A11y focus rings via `AetherA11yStyles` in every shell                   |
| **AE53** | `/aether/sitemap.xml` + `/aether/journal/feed.xml`                       |
| **AE54** | `images.remotePatterns` for Unsplash; SafeImg kept raw deliberately      |

## Round 11 — Round D · documentation ✦ AE55–AE58

| #        | Slice                                            |
| -------- | ------------------------------------------------ |
| **AE55** | docs/aether/07-implementation-log.md (this file) |
| **AE56** | docs/aether/08-data-flow.md                      |
| **AE57** | docs/aether/09-component-catalog.md              |
| **AE58** | PROGRESS.md row + README mention                 |

## Round 12 — Round E · stretch ✦ AE59–AE64

| #        | Slice                                                                                                            | Commit    |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| **AE59** | Pulse voice input via Web Speech API (`useVoiceInput` hook)                                                      | `2a2d430` |
| **AE60** | Hand-drawn `<AetherMark/>` SVG replaces the ॐ emoji in DriftNav                                                  | `a2702ac` |
| **AE61** | Per-destination accent palette (`destinations/palette.ts`, 15 curated tones; hero eyebrow gains a slug-note tag) | `7c0551a` |
| **AE62** | `/aether/dispatch` admin-only ops view (4-tile metrics + 10 active + 5 archived, `me.role==='admin'` gate)       | `3660260` |
| **AE63** | Trip PDF export via `@react-pdf/renderer` (lazy-loaded on click, terracotta-cover A4 sheet)                      | `d86650a` |
| **AE64** | `docs/aether/AETHER_E2E_KIT.md` operator playbook + README refs                                                  | `e0d64b6` |

## Round 13 — Round F · breadth + polish ✦ AE65–AE70

| #        | Slice                                                                                                          | Commit    |
| -------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **AE65** | Pulse keyboard shortcut — Cmd/Ctrl+K and `/` open the drawer (skips input/textarea focus); `⌘K · /` hint chip  | `7b559c2` |
| **AE66** | Reading-progress sticky 2px terracotta bar on journal articles (`<ReadingProgress/>`)                          | `8254b85` |
| **AE67** | `/aether/brand` press-kit page — mark sizes + palette swatches (click-to-copy) + 15 destination accents + type | (round F) |
| **AE68** | Atom 1.0 alternative feed at `/aether/journal/feed.atom` + `<link rel="alternate">` autodiscovery              | `c926500` |
| **AE69** | Atlas pin search filter — input narrows the regions list + dims non-matching map pins (no map recreate)        | `d28683c` |
| **AE70** | Round F docs (this update) + autopilot + PROGRESS refresh                                                      | _this_    |

## Round 14 — Round G · depth + persistence ✦ AE71–AE80

| #        | Slice                                                                                                              | Commit    |
| -------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| **AE71** | Atlas geolocation "where am I" pin + nearest-destination chip (haversine over 15 pins, fit-bounds map pan)         | `51c89de` |
| **AE72** | Pulse conversation persists across reloads — `aether-pulse-history:v1` localStorage key, defensive schema check    | `1123b04` |
| **AE73** | `/aether/destinations/compare?a=&b=` side-by-side surface (twin hero band · facts table · ledes · paired CTAs)     | (round G) |
| **AE74** | Journal kicker/tag filter chips (`tagOf(kicker)` extracts the stem before `·`)                                     | `270df85` |
| **AE75** | `/aether/status` operator health page (feature-flag · API /health/ready ping every 30s · route counts · build sha) | (round G) |
| **AE76** | Vitest unit specs for `aetherOg` + `destinationAccent` + journal `tagOf` (15 tests across 3 files)                 | (round G) |
| **AE77** | Activity timeline on the journey dashboard (createdAt → updatedAt → archivedAt rail, derived from TripDto)         | `8773d7a` |
| **AE78** | Storybook stories — AetherMark · ReadingProgress · DestinationAccents (3 self-contained Chromatic baselines)       | (round G) |
| **AE79** | Trip share-card SVG generator — 1200×630 pure-SVG card · journey-dashboard toggle + download + 6 vitest specs      | `e3d18d6` |
| **AE80** | Round G docs (this update) + autopilot + MEMORY refresh                                                            | _this_    |

## Round 15 — Round H · breadth + tests ✦ AE81–AE90

| #        | Slice                                                                                                                  | Commit    |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE81** | Aether-section favicon + apple-icon via Next 15 `icon.tsx` / `apple-icon.tsx` (edge ImageResponse, AetherMark on pill) | `83aa901` |
| **AE82** | `<TripShareCard/>` re-mountable on `/aether/shared/[code]` — `shareSvg` now accepts structural `ShareCardTrip`         | `2bf90d6` |
| **AE83** | "In season now" chip on destination cards + slug page hero. New `seasons.ts` + 9 vitest specs                          | `9073563` |
| **AE84** | jsdom render spec for `<AetherMark/>` (5 tests)                                                                        | `79d1027` |
| **AE85** | Pulse slash-command palette — 10 commands (/jaipur, /cheap, /two-days, etc.), live filter, single-tap expand           | `9e1cc87` |
| **AE86** | Atlas "in season only" toggle pill (combines with the AE69 text filter)                                                | `1ccb115` |
| **AE87** | Trip days timeline bar above day cards — segment per day, anchor-jumps to `#day-<id>`                                  | `64037be` |
| **AE88** | Journal cross-links on destination pages via `relatedArticles(d)` helper + 3 vitest specs                              | `94587e3` |
| **AE89** | jsdom render spec for `<ReadingProgress/>` (4 tests wrapped in AetherProvider)                                         | `860e8e4` |
| **AE90** | Round H docs + autopilot + MEMORY refresh                                                                              | `0d95e5a` |

## Round 16 — Round I · polish + depth ✦ AE91–AE100

| #         | Slice                                                                                                        | Commit    |
| --------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| **AE91**  | Extract `pulse/slash-commands.ts` + 7 vitest specs (matcher + catalogue shape)                               | `4b48923` |
| **AE92**  | `/aether/*` 404 page (`app/aether/not-found.tsx`, Server Component, hard-coded palette)                      | `1cea406` |
| **AE93**  | Pulse-history Reset button on `/aether/account` (wipes the AE72 localStorage key)                            | `3b33d1b` |
| **AE94**  | `<TripChecklist/>` per-trip prep list on journey dashboard (5-item starter, add/toggle/remove, localStorage) | `dfb50fc` |
| **AE95**  | `/aether/about` gains a Press section linking `/aether/brand`                                                | `5ff6b07` |
| **AE96**  | "Ask Pulse" button on journey dashboard via new `aether-pulse-open` CustomEvent bridge                       | `d37c4c0` |
| **AE97**  | `?` keyboard help overlay mounted via `<AetherA11yStyles/>` (single edit, lands on every shell)              | `ae72b40` |
| **AE98**  | jsdom render spec for `<TripShareCard/>` (4 tests, mocks `URL.createObjectURL`)                              | `6d6a2e7` |
| **AE99**  | Journal article 'Visit destinations' cross-links via `relatedDestinations(a)` + 3 vitest specs               | `e976b0c` |
| **AE100** | Round I docs + autopilot + MEMORY refresh                                                                    | `511fc2b` |

## Round 17 — Round J · weave the loops ✦ AE101–AE110

| #         | Slice                                                                                              | Commit    |
| --------- | -------------------------------------------------------------------------------------------------- | --------- |
| **AE101** | Per-destination 'Ask Pulse about <name>' button reusing AE96 CustomEvent bridge                    | `9c55ee6` |
| **AE102** | Per-journal-article 'A trip like this' button — Pulse prefill from kicker + dek                    | `2a99255` |
| **AE103** | jsdom render spec for `<TripChecklist/>` (6 tests, localStorage persistence assertion)             | `330e3f7` |
| **AE104** | jsdom render spec for `<KeyboardHelp/>` (5 tests, `?`-in-INPUT skip guard)                         | `166fdce` |
| **AE105** | `/aether/*` `error.tsx` 500 boundary — companion to AE92, reset() + status link                    | `6a30a70` |
| **AE106** | Pulse 'Recent' prompt strip on empty-state + long-memory localStorage store (survives Reset)       | `09dda3c` |
| **AE107** | `/aether/me/journeys` row tags `<Name> in season` when the title mentions an in-season destination | `3a78337` |
| **AE108** | Atlas pin tooltip surfaces accent note + in-season row                                             | `7c78fc8` |
| **AE109** | Extract `pulse/recent-prompts.ts` + 8 vitest specs (corrupt JSON, cap, dedupe-to-front)            | `2f543e1` |
| **AE110** | Round J docs + autopilot + MEMORY refresh                                                          | _this_    |

## Round 18 — Round K · sharper edges ✦ AE111–AE116

| #         | Slice                                                                                                                              | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE111** | Atlas listbox keyboard nav — Arrow/Home/End traverse pins, `aria-activedescendant` follows focus, hint chip under heading          | `9dd6240` |
| **AE112** | `/aether/me` Recent prompts card surfaces the AE106 long-memory store; one-tap re-asks via `aether-pulse-open` bridge              | `6cb6845` |
| **AE113** | `<TripChecklist/>` "copy as bullets" — Clipboard API w/ textarea fallback, inline ✓ copied tick                                    | `0b6c1f9` |
| **AE114** | Per-destination checklist starter packs (15 curated: Leh down-jacket / Anjuna scooter helmet / Varanasi slip-ons / etc.) + 7 specs | `0b6c1f9` |
| **AE115** | Server-component `loading.tsx` for `/aether/destinations`, `/aether/destinations/[slug]`, `/aether/journey/[id]` — CSS shimmer     | `ddf6fcd` |
| **AE116** | Round K docs + autopilot + MEMORY refresh                                                                                          | _this_    |

## Round 19 — Round L · keyboard & calm ✦ AE117–AE122

| #         | Slice                                                                                                             | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| **AE117** | Atlas listbox focus row 0 when tabbed into from chrome (`tabIndex` flip + container onFocus)                      | `5701974` |
| **AE118** | `/aether/me` Recent prompts "clear all" — confirm-then-wipe + `clearRecentPrompts()` helper next to read/append   | `ecbac9d` |
| **AE119** | `<TripChecklist/>` "backup .json" — `{version, tripId, exportedAt, items}` downloaded via blob URL                | `c13f5c2` |
| **AE120** | `loading.tsx` for `/aether/journal`, `/aether/journal/[slug]`, `/aether/atlas` (Atlas uses inverted dark shimmer) | `3394b85` |
| **AE121** | `<TripChecklist/>` keyboard nav — Arrow Up/Down across rows, Space/Enter toggles, Delete/Backspace removes        | `c13f5c2` |
| **AE122** | Round L docs + autopilot + MEMORY refresh                                                                         | _this_    |

## Round 20 — Round M · density & a11y ✦ AE123–AE138

| #         | Slice                                                                                                                               | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE123** | jsdom checklist keyboard nav spec (Arrow/Space/Enter/Delete/Backspace + rovingtab assertion)                                        | `aeabe3e` |
| **AE124** | `clearRecentPrompts` specs — wipe, idempotent, only-my-key invariant                                                                | `aeabe3e` |
| **AE125** | `loading.tsx` for `/aether/me`, `/me/journeys`, `/me/shares`, `/account`                                                            | `e070b1e` |
| **AE126** | Atlas list row in-season chip (olive pill mirroring AE83 destination cards + AE107 journeys index)                                  | `535fb3e` |
| **AE127** | Atlas `/` keyboard shortcut focuses filter input; guards INPUT/TEXTAREA bubble; placeholder gains hint                              | `535fb3e` |
| **AE128** | Activity timeline surfaces `Shared a link · code…` events per minted share (one new dot kind, ochre.glow)                           | `85b6851` |
| **AE129** | `<TripChecklist/>` undo snackbar after Delete — guillemet-wrapped item, 5s window, Restore Undo button + role=status                | `244ecdd` |
| **AE130** | Storybook stories for TripChecklist (5 visual variants: default / Leh / mid / all-done / undo-visible)                              | `8f95c0d` |
| **AE131** | `/aether/account` "Download my data" — bundles recent prompts + Pulse history + every checklist + onboarded + audio prefs into JSON | `131abbe` |
| **AE132** | Pulse empty-state "Try one of these" seed prompts (3 evergreen; hidden when Recent has 3+)                                          | `26e2464` |
| **AE134** | Seasons.ts edge-case specs (every slug in season some month, calendar minimum ≥2, monsoon + winter pins)                            | `ae4e8bb` |
| **AE135** | Storybook story for `<KeyboardHelp/>` overlay (open state, design baseline)                                                         | `7304e3f` |
| **AE136** | Extract `bundleLocalData` helper + 9 specs (privacy invariant, JSON parsing, version-suffix guard, audioOptOut exact-match)         | `6eb2de4` |
| **AE137** | Atlas focused-row aria-live announcer (`<name>, <state>` via role=status sr-only div)                                               | `e89cbcf` |
| **AE138** | Round M docs + autopilot + MEMORY refresh                                                                                           | _this_    |

## Round 21 — Round N · perf & backup ✦ AE139–AE142

| #         | Slice                                                                                                | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------- | --------- |
| **AE139** | Export-PDF button pre-warms `@react-pdf/renderer` chunk on hover/focus (ref-gated, retry on failure) | `50a520a` |
| **AE140** | `/aether/account` "Backup .json" mirrors AE119 for the Pulse conversation (next to AE93 Clear)       | `afe0e5e` |
| **AE141** | Activity timeline groups by ISO week (Monday-rooted) when events > 8; ≤8 stays flat                  | `52876cf` |
| **AE142** | Round N docs + autopilot + MEMORY refresh                                                            | _this_    |

## Round 22 — Round O · helpers, skeletons & a11y ✦ AE143–AE156

| #         | Slice                                                                                                                 | Commit    |
| --------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE143** | Extract timeline-grouping helpers (`TIMELINE_GROUP_THRESHOLD`, `weekKey`, `weekLabel`, `groupByWeek`) + 11 specs      | `5ce8850` |
| **AE144** | Extract `shouldFocusFilterOnSlash` Atlas guard + 6 specs (INPUT/TEXTAREA/SELECT/missing-target/non-slash)             | `79cb3db` |
| **AE145** | KeyboardHelp adds rows for AE127 `/` filter + AE121 list/checklist nav (↑↓ Space Del)                                 | `c34b0be` |
| **AE146** | `aether-pulse-open` accepts `{submit: true}` to auto-send (delayed 220ms so open animation lands)                     | `1fc401d` |
| **AE147** | PDF export error gets `↻ Try again` retry (resets preload flag) + `×` dismiss                                         | `e372624` |
| **AE148** | `<TripChecklist/>` JSON import (round-trip with AE119) — file picker, ChecklistItem validation, 4s inline error       | `e2cb173` |
| **AE149** | Extract `deriveChecklistSlug` helper + 7 specs (null/empty/case-insensitive/first-hit/15-slug-catalogue)              | `fcd8d28` |
| **AE150** | `loading.tsx` for `/aether/about` + `/plan` + `/onboarding` + `/brand` (4 server-component skeletons)                 | `cccebe9` |
| **AE151** | `loading.tsx` for `/aether/drift` + `/aether/dispatch` (2 more skeletons)                                             | `40313fc` |
| **AE152** | Storybook for `<TripShareCard/>` (3 variants: TwoWeekItinerary / SingleDay / UndatedDraft) on dark presenter backdrop | `f423ea0` |
| **AE153** | 5 more shareSvg edge specs (empty title / no-status fallback / dated range / 1-char no-shrink / no \\r)               | `cdc4e98` |
| **AE154** | Activity timeline kicker shows `· N events` count (useMemo from same input set as builder, singular/plural correct)   | `13e367e` |
| **AE155** | Atlas Esc inside filter clears query or hops focus to row 0; placeholder gains hint                                   | `1f4ac4c` |
| **AE156** | Round O docs + autopilot + MEMORY refresh                                                                             | _this_    |

## Round 23 — Round P · stamps & micro-copy ✦ AE157–AE162

| #         | Slice                                                                                                            | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| **AE157** | EditorialFooter shows the 7-char `NEXT_PUBLIC_BUILD_SHA` next to © year (silent when env unset)                  | `b1f31de` |
| **AE158** | No-op — onboarding already shipped a `Skip · explore on my own` button (verified)                                | —         |
| **AE159** | Pulse pending bubble rotates `Reading… → Sketching the route… → Almost there…` (1.5s, clamps at last)            | `1572e72` |
| **AE160** | Extract `bundlePulseHistory` helper + 4 specs (empty, JSON parsed, non-JSON fallback, privacy invariant)         | `601fed4` |
| **AE161** | Storybook for Activity timeline (3 variants: Flat / Eight / WeekGrouped) — Chromatic baseline for the AE141 rail | `ff396e8` |
| **AE162** | Round P docs + autopilot + MEMORY refresh                                                                        | _this_    |

## Round 24 — Round Q · extractions & spec coverage ✦ AE163–AE172

| #         | Slice                                                                           | Commit    |
| --------- | ------------------------------------------------------------------------------- | --------- |
| **AE163** | Extract `decodePulseOpenEvent` from AE96+AE146 + 7 specs                        | `46e0ee9` |
| **AE164** | Extract `parseChecklistBackup` from AE148 + 7 specs                             | `99e8cd2` |
| **AE165** | Extract `countTimelineEvents` from AE154 + 6 specs                              | `5243e37` |
| **AE166** | `loading.tsx` for `/aether/destinations/compare` + `/shared/[code]` + `/status` | `e005dca` |
| **AE167** | 3 more `relatedArticles` edge specs (no-crash, no-dup, case-insensitive)        | `3691958` |
| **AE168** | Storybook for `<DriftNav/>` (Default / Authed / AudioOn variants)               | `0bc28fc` |
| **AE169** | `/aether/sitemap.xml` adds `/brand` + `/compare` + `/status` routes             | `eb03ac1` |
| **AE170** | Extract `haversineKm` + `nearestPin` from atlas-canvas + 8 specs                | `13ce426` |
| **AE171** | Shared `aether-dates` helpers (`asIso`, `fmtDate`, `daysBetween`) + 11 specs    | `740fa38` |
| **AE172** | Round Q docs + autopilot + MEMORY refresh                                       | _this_    |

## Stop conditions reached / deferred

- **Mobile parity** — Aether is web-only Phase 0 (locked decision pre-AE5).
- **Real photography commissioning** — deferred to Phase 2 budget gate.
- **AR / WebGPU shaders** — deferred per Phase-0 decisions doc.
- **Open Graph tested in production crawlers** — needs the `NEXT_PUBLIC_SITE_URL`
  env var set in a hosted env; locally the URLs render correctly via Next's
  metadata API, real-world Facebook + Twitter cards verified at deploy time.
- **Visual regression baselines** — Playwright E2E ships logic only; the
  per-route screenshot baseline is platform-sensitive and produced on first CI
  run via `--update-snapshots`.

---

_Living document. Append a row per slice. Operator-owed promotion lives in
`MEMORY.md` head pointer._

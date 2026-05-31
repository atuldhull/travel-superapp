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

## Round 25 — Round R · spec coverage + Storybook ✦ AE173–AE180

| #         | Slice                                                                                                           | Commit    |
| --------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| **AE173** | Extract journal `tagOf` to sibling file + 2 more specs (first-bullet stop, ASCII `*` is NOT a separator)        | `ceecd94` |
| **AE174** | Storybook for `<Pulse/>` drawer — 4 variants (EmptyFirstTimer / RecentReturning / InConversation / SlashOpen)   | `6cb5de2` |
| **AE175** | 4 more slash-commands sanity specs (uniqueness, kebab/lowercase, expand non-whitespace, sort stability)         | `31ba4d4` |
| **AE176** | Data-shape gate for `DESTINATIONS` — 7 specs (15-slug count, no dup, every slug maps, kebab, hero photo fields) | `10a4519` |
| **AE177** | Data-shape gate for `JOURNAL_ARTICLES` — 7 specs (count ≥ 6, body is array of blocks, kicker has `·`)           | `a33dfb2` |
| **AE178** | 4 more `destinationAccent` specs (whisper hex-or-rgba, note kebab ≤24, unique notes, Leh = sky-tone)            | `e1a5647` |
| **AE179** | 4 more `aetherOg` specs (freshness, empty inputs, alt=title verbatim, shared OG↔Twitter image URL)              | `8a80484` |
| **AE180** | Round R docs + autopilot + MEMORY refresh                                                                       | _this_    |

## Round 26 — Round S · structural extractions + Storybook ✦ AE181–AE185

| #         | Slice                                                                                                     | Commit    |
| --------- | --------------------------------------------------------------------------------------------------------- | --------- |
| **AE181** | Storybook for `<EditorialFooter/>` (Default + WithBuildSha showing AE157 stamp)                           | `1e3d554` |
| **AE182** | Extract Atlas `PINS` catalogue + 7 specs (15-pin sanity, India bbox, Leh-first/Alleppey-last endpoints)   | `d64d541` |
| **AE183** | Extract `trySeasonMatch` from journeys-index + 6 specs (in-season, July Leh, multi-hit determinism)       | `d93464c` |
| **AE184** | Extract `parsePulseStore` + AE72 types + 9 specs (malformed JSON, wrong shape, ctx coords, provider type) | `8c7c4f1` |
| **AE185** | Round S docs + autopilot + MEMORY refresh                                                                 | _this_    |

## Round 27 — Round T · pure-helper sweep ✦ AE186–AE194

| #         | Slice                                                                                                             | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| **AE186** | Move `fmtTime` into shared `aether-dates` lib + 3 specs (naked HH:MM, midnight/noon/11:45 PM, garbage)            | `99eb182` |
| **AE187** | Move `fmtDayHead` into shared `aether-dates` lib + 2 specs (—-on-bad, weekday·short-date pattern)                 | `99eb182` |
| **AE188** | Extract `backupFilename` builder + 7 specs (sanitize chars, trim dashes, dated suffix, used by AE119/AE131/AE140) | `a78a330` |
| **AE189** | Copy-bubble button on assistant Pulse messages (1.5s ✓ copied tick, per-idx state)                                | `2ad1d0b` |
| **AE190** | Storybook ActivityTimeline `JustOne` variant (fresh-draft trip with 1 event)                                      | `3db482e` |
| **AE191** | Extract Atlas `decideFilterEsc` + 4 specs (clear / focus-row-0 / null / case-sensitive)                           | `d2a038b` |
| **AE192** | Extract `PENDING_PHRASES` + `nextPendingIdx` + `phraseAt` + 7 specs (clamp-at-last for AE159)                     | `cbefca4` |
| **AE193** | 3 more shareSvg specs (21-char tier-2 88px, 29-char tier-3 72px, post-escape title survival)                      | `a32f94f` |
| **AE194** | Round T docs + autopilot + MEMORY refresh                                                                         | _this_    |

## Round 28 — Round U · keyboard polish + shared helpers ✦ AE195–AE202

| #         | Slice                                                                                                  | Commit    |
| --------- | ------------------------------------------------------------------------------------------------------ | --------- |
| **AE195** | trip-share-card uses shared `aether-dates` + new `inclusiveDaysBetween` + 5 specs                      | `17455a6` |
| **AE196** | Shared `copyTextToClipboard` helper used by AE113 + AE189; 6 specs (Clipboard API + textarea fallback) | `da181a6` |
| **AE197** | Pulse composer recalls last user prompt on `↑` (empty composer guard)                                  | `ead6092` |
| **AE198** | Extract `lastUserPrompt` picker + 6 specs (empty / all-assistant / single / latest skipping reply)     | `3d7adf6` |
| **AE199** | Atlas `g` keyboard shortcut → geolocate + 4 specs (lowercase-only, INPUT/TEXTAREA/SELECT guard)        | `55264a5` |
| **AE200** | KeyboardHelp lists new `g` + `↑` shortcuts                                                             | `9a26daa` |
| **AE201** | Extract `makeChecklistItemId` + 6 specs (base36 ts + 4-digit base36 rand, injectable for tests)        | `5428788` |
| **AE202** | Round U docs + autopilot + MEMORY refresh                                                              | _this_    |

## Round 29 — Round V · tiny polish ✦ AE203–AE205

| #         | Slice                                                                                               | Commit    |
| --------- | --------------------------------------------------------------------------------------------------- | --------- |
| **AE203** | Pulse composer `↓` clears the input (mirror of AE197 `↑` recall, guarded to non-empty)              | `bc23ea2` |
| **AE204** | 3 more `backupFilename` hostile-input specs (path traversal stripped, char collapse, all-bad shape) | `a6cf146` |
| **AE205** | Round V docs                                                                                        | _this_    |

## Round 30 — Round W · helper canonicalisation + Pulse contract gates ✦ AE206–AE215

| #         | Slice                                                                                                      | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| **AE206** | Extract `timelineDotColor` + 6 specs (kind→palette routing; archive/edit/share/create distinct)            | `b7aa21e` |
| **AE207** | Extract `normalizePulsePrompt` + 8 specs (empty/too-long reasons, PULSE_PROMPT_MAX=2000, whitespace trim)  | `3ff1283` |
| **AE208** | 4 more timeline-grouping specs — cross-month + Dec→Jan year flip + Mon-Jan-1 + groupByWeek boundary        | `d817712` |
| **AE209** | `estimateReadingMinutes` (WPM helper) + 12 specs — empty=0, ceil+min-1, default 220wpm, body-array support | `4ca4b4f` |
| **AE210** | Extract Atlas `filterPins` (text query AND season toggle, injected isInSeason) + 10 specs                  | `b2c92ae` |
| **AE211** | Shared `useCopyTapFeedback` hook + 5 jsdom fake-timer specs (revert at exact windowMs, unmount cleanup)    | `2d73b06` |
| **AE212** | Extract `buildSamplePlanRequest` + `isFollowUpBody` guard + 6 specs (fresh vs follow-up tagged union)      | `c8362ed` |
| **AE213** | Extract `extractPlanText` defensive unwrap + 11 specs (null/non-object/non-string degenerate to '')        | `5ee81ad` |
| **AE214** | Extract `buildJourneyFacts` (Range·Days·Radius·Drafted) + 9 specs — uses shared `inclusiveDaysBetween`     | `c9cb451` |
| **AE215** | Round W docs + autopilot + MEMORY refresh                                                                  | _this_    |

## Round 31 — Round X · contract canonicalisation + shared kit ✦ AE216–AE225

| #         | Slice                                                                                                       | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| **AE216** | Extract Pulse `shouldShowSuggestions` + 7 specs (recent.length < 3 threshold)                               | `4483363` |
| **AE217** | `deriveTripStatus` 5-state classifier + 12 specs (draft/upcoming/active/past/archived)                      | `f383e5f` |
| **AE218** | `buildShareUrl` legacy + aether surfaces + 8 specs (origin trim, code-encode, port-preserve)                | `cc1325b` |
| **AE219** | Shared `useEscapeKey` hook + 6 jsdom specs (real KeyboardEvent dispatch, preventDefault gate)               | `82aff40` |
| **AE220** | `buildArticleMetaLine` + 8 specs (segments + joined; trims; drops empty/0/negative)                         | `1b3dd5f` |
| **AE221** | `formatLat`/`formatLng`/`formatLatLng` + 15 specs (4-decimal, hemisphere, ±180 boundary, NaN/Infinity dash) | `4b681fa` |
| **AE222** | `appendBoundedMessage` + 7 specs (PULSE_MAX_MESSAGES=40, sliding window, no-mutate)                         | `a7e9025` |
| **AE223** | `plural`/`pluralise`/`countLabel` kit + 14 specs (auto-s, explicit override, exotic plurals)                | `f62ea79` |
| **AE224** | Extract `readSummaryField` + 11 specs (lifted from journey-dashboard, every guard locked)                   | `1b994ae` |
| **AE225** | Round X docs + autopilot + MEMORY refresh                                                                   | _this_    |

## Round 32 — Round Y · helpers kit + Pulse / journey contracts ✦ AE226–AE235

| #         | Slice                                                                                            | Commit    |
| --------- | ------------------------------------------------------------------------------------------------ | --------- |
| **AE226** | `computeChecklistProgress` + 7 specs (total/done/fraction/percent/allDone)                       | `73eaca2` |
| **AE227** | `clamp` + `clamp01` + 13 specs (NaN-pass, min/max swap-tolerance)                                | `3795c34` |
| **AE228** | `safeJsonParse` + 11 specs (null/non-string/empty/malformed/JSON-null literal)                   | `4e138d1` |
| **AE229** | `useDebouncedValue` + 5 jsdom fake-timer specs (first-render imm, last-write-wins, unmount safe) | `d0f0fc9` |
| **AE230** | `pinsBBox` + 7 specs (empty→null, single→degenerate, NaN/Inf null, S<=N + W<=E invariants)       | `65087ff` |
| **AE231** | `roleVisuals` + 5 specs (user vs assistant align/accentKey/weight contract)                      | `d9db1b5` |
| **AE232** | 5 more haversine specs (equator 1°≈111km, antipodal/pole→pole ≈ 20015km, Mumbai→Delhi ≈ 1150km)  | `d5a0247` |
| **AE233** | `isoDateOnly` + 10 specs (local YYYY-MM-DD; NOT toISOString().slice — IST shift documented)      | `2d7a09f` |
| **AE234** | `buildJourneyRowStatusLine` + 9 specs (status·days·shares·in-season segments)                    | `7e29b15` |
| **AE235** | Round Y docs + autopilot + MEMORY refresh                                                        | _this_    |

## Round 33 — Round Z · sort/partition/format/href kit ✦ AE236–AE245

| #         | Slice                                                                                                       | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| **AE236** | `sortArticlesNewestFirst` + 7 specs (publishedOn desc, stable tiebreak, unparseable→end)                    | `8d1ce7c` |
| **AE237** | `groupTripsByStatus` + 5 specs (5-bucket partition via AE217; preserves order; sum invariant)               | `38de80d` |
| **AE238** | `safe-storage` kit (read/write/json/remove) + 8 specs (SSR-safe, throw-safe, cyclic-write false)            | `b19db01` |
| **AE239** | `itineraryDayLabel` + 7 specs ({num,label,anchorId}; tripId prefix; 'day-' invariant)                       | `8997b7a` |
| **AE240** | `buildQueryString` + `appendQuery` + 13 specs (omit null/empty, sorted, URL-encode, smart ? vs &)           | `256b518` |
| **AE241** | `articleHref` + `articleAbsoluteHref` + 10 specs (trim, '' for empty, encode, origin trim)                  | `32721ae` |
| **AE242** | `destinationHref` + absolute + `compareHref` + 12 specs (mirror of AE241 + AE73 compare permalink)          | `8bdee9e` |
| **AE243** | `formatPlanText` + 12 specs (drops 'Plan:'/'Itinerary:' header line, collapses 3+ blanks → 2, preserves md) | `89ddc33` |
| **AE244** | `selectPinBySlug` + `indexOfPinBySlug` + 10 specs (trim, null/-1 sentinels)                                 | `d2225ea` |
| **AE245** | Round Z docs + autopilot + MEMORY refresh                                                                   | _this_    |

## Round 34 — Round AA · lookup + storage + relative-time kit ✦ AE246–AE255

| #         | Slice                                                                                               | Commit    |
| --------- | --------------------------------------------------------------------------------------------------- | --------- |
| **AE246** | `destinationBySlug` + `destinationBySlugCi` + 10 specs (mirror of AE244)                            | `a65f919` |
| **AE247** | `useLocalStorageState` hook + 6 jsdom specs (on AE238 safe-storage; enabled=false short-circuit)    | `a53b316` |
| **AE248** | `formatInSeasonMonths` + 12 specs (range / wraparound / multi-half / fallback comma list)           | `1059092` |
| **AE249** | `articleBySlug` + `indexOfArticleBySlug` + 9 specs                                                  | `ecc9b46` |
| **AE250** | `computeShareListStats` + 7 specs (total/revoked/live/mostRecentAt; empty-string revokedAt is live) | `2ff7f81` |
| **AE251** | `atlasEmptyStateCopy` + 7 specs (4 routed messages for filter+season combos)                        | `b4682f8` |
| **AE252** | `buildPulseHistoryExport` + 7 specs (versioned envelope; schema/version exposed)                    | `d93671a` |
| **AE253** | `formatRelativeAether` + 14 specs (just-now/m/h/d/w/mo/y; future 'in <n><u>'; '' for null/garbage)  | `24a662e` |
| **AE254** | `useStableId` hook + 6 jsdom specs (wraps useId, strips ':', CSS-selector-safe)                     | `7e553e2` |
| **AE255** | Round AA docs + autopilot + MEMORY refresh                                                          | _this_    |

## Round 35 — Round AB · resolver + escape + aggregate kit ✦ AE256–AE265

| #         | Slice                                                                                                  | Commit    |
| --------- | ------------------------------------------------------------------------------------------------------ | --------- |
| **AE256** | `findFirstItineraryDate` + 7 specs (trip.startsOn > earliest day > createdAt > null)                   | `b6b83c8` |
| **AE257** | `escapeAttr` + `escapeAttrStrict` + 10 specs (5-char + control-char strip)                             | `5e7d25b` |
| **AE258** | `sentenceCase` + 12 specs (ALL-CAPS→Sentence + keepAsIs proper noun preservation, word-boundary regex) | `90247a7` |
| **AE259** | `aggregateMeCounts` + 6 specs (5-bucket + sum invariant + liveShares aggregation across trips)         | `9170f5f` |
| **AE260** | `extractPullQuotes` + `strongestPullQuote` + 7 specs (filter by kind, longest-wins, null for empty)    | `b2780b5` |
| **AE261** | `matchQuickPrompt` + `quickPrompts` + 11 specs (AE19 4-chip routing; case-insensitive label match)     | `4baf028` |
| **AE262** | `zoomFromBBox` + 9 specs (Leaflet log2 z, [0,18] clamp, Indian bbox lands at z=3)                      | `f08cfe7` |
| **AE263** | `pickFeaturedDestination` + 7 specs (in-season-first, day-of-year deterministic rotation)              | `0dfe622` |
| **AE264** | `extractShareCode` + 11 specs (inverse of AE218; legacy + aether paths; strips ?+#; URIError null)     | `b6690bd` |
| **AE265** | Round AB docs + autopilot + MEMORY refresh                                                             | _this_    |

## Round 36 — Round AC · sitemap + RSS + tooltip + photo-url kit ✦ AE266–AE275

| #         | Slice                                                                                              | Commit    |
| --------- | -------------------------------------------------------------------------------------------------- | --------- |
| **AE266** | `shouldShowThinkingDot` + 6 specs (220ms min, composer-text gate)                                  | `82adff6` |
| **AE267** | `buildPhotoUrl` + 9 specs (Unsplash sized URL, photo- prefix auto-add, https-only)                 | `86bfd45` |
| **AE268** | `useIntersectionOnce` hook + 4 jsdom specs (one-shot IO, disabled short-circuit, fake-IO stub)     | `839091b` |
| **AE269** | `buildDestinationTagline` + 7 specs (state · tagline · In season; drops empties)                   | `c17fbc8` |
| **AE270** | `destinationSitemapEntries` + 9 specs (uses AE242 href, alpha sort, per-entry lastmod or fallback) | `1488ec5` |
| **AE271** | `journalSitemapEntries` + 7 specs (newest first, updatedAt → publishedOn → fallback)               | `9b05709` |
| **AE272** | `buildShareCardTagline` + 7 specs (uses AE195 inclusiveDaysBetween + AE223 countLabel)             | `57022d3` |
| **AE273** | `buildAtlasTooltipHtml` + 6 specs (uses AE257 escapeAttr; conditional in-season + accentNote rows) | `86af243` |
| **AE274** | `buildRssItem` + 8 specs (RFC 2822 pubDate, conditional dc:creator/description, epoch fallback)    | `5b3cd06` |
| **AE275** | Round AC docs + autopilot + MEMORY refresh                                                         | _this_    |

## Round 37 — Round AD · message + summary + zoom-strategy kit ✦ AE276–AE285

| #         | Slice                                                                                                    | Commit    |
| --------- | -------------------------------------------------------------------------------------------------------- | --------- |
| **AE276** | `suggestedDuplicateName` + 10 specs (' (copy)' → ' (copy 2)' chain; cap 100)                             | `5bb9320` |
| **AE277** | `formatBytes` + 14 specs (binary/decimal units; NaN/Inf/neg → '—')                                       | `e061240` |
| **AE278** | `extractDomain` + 11 specs (URL parse, www strip, lowercased, fathom.video sanity)                       | `b616474` |
| **AE279** | `buildShareMessage` + 8 specs (title\\ntagline\\nurl; 240-char tagline cap with ellipsis)                | `cbf4cf0` |
| **AE280** | `summariseRecentActivity` + 8 specs (verb routing; tie picks first encountered; ignores updated=created) | `ef884cf` |
| **AE281** | `pickZoomStrategy` + 7 specs (snap if Δ≤1 or Δ>6; reducedMotion always snap)                             | `40ea150` |
| **AE282** | `shouldAttachContext` + 11 specs (6 fresh-start phrases; case-insensitive substring)                     | `272e303` |
| **AE283** | `shareCardTitleSize` + 11 specs (3-tier 110/88/72 at 20/28 boundaries; AE193 fixtures locked)            | `69c81aa` |
| **AE284** | `sleep` + 5 fake-timer specs (AbortSignal cancel; pre-aborted rejects immediately; negative clamp)       | `2d14e06` |
| **AE285** | Round AD docs + autopilot + MEMORY refresh                                                               | _this_    |

## Round 38 — Round AE · formatter + grouping + voice-state kit ✦ AE286–AE295

| #         | Slice                                                                                              | Commit    |
| --------- | -------------------------------------------------------------------------------------------------- | --------- |
| **AE286** | `formatIsoTime` + 7 specs (HH:MM local from ISO; null/garbage → '')                                | `0c2620b` |
| **AE287** | `groupByState` + 8 specs (state buckets; 'Other' fallback; alpha key order; input-order within)    | `261180f` |
| **AE288** | `stripMarkdown` + 12 specs (bold/italic/code/heading/bullet/link; preserves standalone \*)         | `babbd99` |
| **AE289** | `formatPercent` + 10 specs (clamp [0,1]; round whole; decimals opt; NaN/Inf → '—')                 | `5e063db` |
| **AE290** | `voiceStateLabel` + `voiceStateAriaLive` + 9 specs (5 distinct labels; assertive for error/denied) | `da52bb3` |
| **AE291** | `normalizeWhitespace` + 8 specs (collapse runs + trim)                                             | `4391a64` |
| **AE292** | `formatDistanceKm` + 9 specs (<1km meters; <10km 1-dec km; ≥10km whole km)                         | `7268b53` |
| **AE293** | `seasonChipLabel` + 7 specs (4-state router: in-season/best-month/shoulder/off)                    | `b728eca` |
| **AE294** | `shortTripTitle` + 9 specs (word-boundary cut with ellipsis; SHORT_TITLE_DEFAULT=28; unicode-safe) | `b8c0546` |
| **AE295** | Round AE docs + autopilot + MEMORY refresh                                                         | _this_    |

## Round 39 — Round AF · wrap + RNG + bbox-center + mention kit ✦ AE296–AE305

| #         | Slice                                                                                                      | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| **AE296** | `wrapRowIndex` + 7 specs (Atlas listbox cursor wrap; -1 sentinel for empty)                                | `754e96b` |
| **AE297** | `svgToDataUrl` + 8 specs (utf8 + base64 modes; round-trips; '' for empty)                                  | `4a83081` |
| **AE298** | `selectBestMonth` + 8 specs (next-in-season-from-now; wrap; null for empty/all-12)                         | `9935420` |
| **AE299** | `makeRng` (mulberry32) + 11 specs (deterministic seed; next/nextInt/pick; defensive on 0/NaN)              | `b77e6d8` |
| **AE300** | `shuffleWith` (Fisher-Yates + injected RNG) + 8 specs (deterministic; no mutation; preserves multiset)     | `9ee3971` |
| **AE301** | `sortItineraryDays` + 7 specs (null-dated to end; tie preserves input order; new array)                    | `dc17873` |
| **AE302** | `centerOfPins` + 6 specs (bbox midpoint, NOT centroid; pairs with AE230 + AE262)                           | `39eb9fb` |
| **AE303** | `formatPercentDelta` + 10 specs (↑/↓/· glyph; '—' for NaN/Inf; -0 treated as zero)                         | `5275b2d` |
| **AE304** | `extractMentions` + 10 specs (@slug autocomplete prep; lowercased + de-duped; quirk-doc'd email behaviour) | `37e23f1` |
| **AE305** | Round AF docs + autopilot + MEMORY refresh                                                                 | _this_    |

## Round 40 — Round AG · consumer migrations (helpers → call sites) ✦ AE306–AE315

| #         | Slice                                                                                                | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------- | --------- |
| **AE306** | recent-prompts.ts → AE228 safeJsonParse + AE238 safe-storage (~12 lines deleted; all 11 specs green) | `4ef32ce` |
| **AE307** | parsePulseStore → AE228 safeJsonParse (try/catch replaced; AE184 specs green)                        | `d23fd84` |
| **AE308** | parseChecklistBackup → AE228 safeJsonParse (AE164 specs green)                                       | `83e6df3` |
| **AE309** | journey-dashboard footer 'last edited' uses AE253 formatRelativeAether (fmtDate fallback)            | `3fa765b` |
| **AE310** | journey-dashboard share mutation uses AE218 buildShareUrl (URL-encodes oddball codes)                | `42cc989` |
| **AE311** | journey-dashboard 'N days/items' uses AE223 countLabel (2 inline ternaries removed)                  | `85215c4` |
| **AE312** | shared-trip-view + shares-index use AE223 countLabel (2 more inline ternaries removed)               | `96c2605` |
| **AE313** | Pulse AE146 auto-send delay uses AE284 sleep (Promise-shaped delay)                                  | `035de0a` |
| **AE314** | Pulse all 4 setMessages append paths use AE222 appendBoundedMessage (in-memory cap at 40)            | `45e433d` |
| **AE315** | Round AG docs + MEMORY refresh                                                                       | _this_    |

## Round 41 — Round AH · real-world feature wiring ✦ AE316–AE319

| #         | Slice                                                                                                          | Commit    |
| --------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **AE316** | Daily Featured destination card on /destinations (pickFeaturedDestination + selectBestMonth + seasonChipLabel) | `a926dae` |
| **AE317** | /me Recent-activity one-liner via summariseRecentActivity ("Edited X · 2h ago")                                | `d35defd` |
| **AE318** | reading-progress fill uses AE227 clamp01 (Math.min/max removed)                                                | `dd5db09` |
| **AE319** | Round AH docs + MEMORY refresh                                                                                 | `7338f9b` |

## Round 42 — Round AI · helper wires + aether-dates consolidation ✦ AE320–AE330

The first round to mix three modes in one pass: feature-wire (AE320,
AE321), pure-helper extraction with paired specs (AE322, AE327,
AE329), and large-scale consumer migration (AE323–AE326, AE328 —
~120 LOC of duplicated date helpers consolidated onto `aether-dates`).
Net: vitest 1143 → 1164 (+21 specs), zero new behaviour churn for the
consolidation slices.

| #         | Slice                                                                                                               | Commit    |
| --------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE320** | PDF export filename routes through `backupFilename` + optional `ext` arg (3 new specs)                              | `1a7194b` |
| **AE321** | Pulse `ask()` drops `priorPlan` when prompt matches a fresh-start phrase (uses AE282 `shouldAttachContext`)         | `c513914` |
| **AE322** | Extract `formatChecklistAsBullets` + 6 specs (✓ / • prefixes preserved)                                             | `f5a5a9f` |
| **AE323** | `<TripChecklist/>` localStorage onto `safe-storage` + `safeJsonParse` (SSR + quota guards now shared)               | `f5a5a9f` |
| **AE324** | `wrapRowIndex` consumer migration (Atlas listbox + checklist `focusItemAt` swap)                                    | `28ad114` |
| **AE325** | journey-dashboard + shared-trip-view: asIso/fmtDate/daysBetween onto `aether-dates` (-69 LOC)                       | `a5c704a` |
| **AE326** | dispatch + journeys-index + shares-index `fmtDate` consolidation (-23 LOC)                                          | `ec9d579` |
| **AE327** | Extract `summariseTripStats` + 6 specs; wired into `<MeHome/>` (single tested predicate for "drafts within active") | `f409dbe` |
| **AE328** | trip-pdf-doc asIso/fmtDate/fmtTime onto `aether-dates` (fmtTime null wrapped to '—' for PDF slots, -20 LOC)         | `f409dbe` |
| **AE329** | Extract `interpretGeolocationError` + 6 specs; wired in Atlas (code 1 → denied, anything else → unavailable)        | `da~~~~`  |
| **AE330** | Round AI docs                                                                                                       | `39a8d80` |

## Round 43 — Round AJ · shared-kit-isation across surfaces ✦ AE331–AE340

Mix of extraction + consumer migration: 3 new helpers + paired specs
(`openPulse`, `useConfirmTwoStep`, `buildTimelineEvents`) and 6
migrations that swap inline `navigator.clipboard`, hand-rolled
share-URL strings, ad-hoc SVG escapes, ternary title-size selectors,
ad-hoc meta-line spans, and the third "draft predicate" copy onto
canonical helpers. vitest 1164 → 1189 (+25 specs).

| #         | Slice                                                                                                          | Commit    |
| --------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **AE331** | Extract `openPulse(prefill, {submit?})` + 7 jsdom specs; consumed by destination + journal + me-home + journey | `_`       |
| **AE332** | Extract `useConfirmTwoStep(action, windowMs)` + 8 jsdom specs; wired into me-home Clear-all                    | `_`       |
| **AE333** | Pulse share-mutation + shares-index share URL onto canonical `buildShareUrl`                                   | `51127ea` |
| **AE334** | 4 inline `navigator.clipboard.writeText` → shared `copyTextToClipboard` (Pulse, brand, shares-index, journey)  | `2732d21` |
| **AE335** | trip-share-card `svgEscape` → shared `escapeAttr` (5-char + control-char strip)                                | `2091f0a` |
| **AE336** | trip-share-card `titleFs` ternary → shared `shareCardTitleSize` (3-tier 110/88/72)                             | `8cef2f8` |
| **AE337** | journal-article meta line → shared `buildArticleMetaLine` (segments + middle-dot rendering)                    | `5f771e2` |
| **AE338** | Extract `buildTimelineEvents` + 10 specs (4 contract points: create/edit/archive/share); wired in journey      | `_`       |
| **AE339** | dispatch-page drafts count → shared `summariseTripStats` (3rd consumer)                                        | `5d3453d` |
| **AE340** | Round AJ docs                                                                                                  | `ae42efa` |

## Round 44 — Round AK · helpers + clamp/storage/role-style sweep ✦ AE341–AE350

Five new helpers + paired specs (`dayOfYear`, `pulseMessageBubbleStyle`,
`tripsFromQuery`, `useTransientFlag`, `formatBuildSha`) and 5
consumer migrations that fold inline `Math.max/Math.min` onto
`clamp`/`clamp01`, swap 5 ad-hoc `as { trips?: TripDto[] }` casts
for the shared extractor, and migrate 3 transient ✓-chips + the
share-copied chip onto `useTransientFlag`. **AE345 unblocks the
AE231 backlog item** — Pulse's 8-axis bubble style now lives in a
tested helper. vitest 1189 → 1230 (+41 specs).

| #         | Slice                                                                                            | Commit    |
| --------- | ------------------------------------------------------------------------------------------------ | --------- |
| **AE341** | Extract `dayOfYear` + 10 specs; featured-pick consumes (replaces private copy)                   | `_`       |
| **AE342** | audio-chip stored volume → shared `clamp` + `safe-storage` (-5 LOC + SSR contract aligned)       | `59a735f` |
| **AE343** | use-parallax inline `Math.max/Math.min` → shared `clamp`                                         | `5c6c62d` |
| **AE344** | format-percent inline clamp → shared `clamp01` (behaviour identical)                             | `9ac80fa` |
| **AE345** | Extract `pulseMessageBubbleStyle` + 8 specs — unblocks AE231 (8 visual axes per role now tested) | `_`       |
| **AE346** | Extract `tripsFromQuery` + 7 specs; 5 surfaces migrate                                           | `_`       |
| **AE347** | Extract `useTransientFlag` + 8 jsdom specs; account-page consumes 3x                             | `_`       |
| **AE348** | journey-dashboard `shareCopied` onto `useTransientFlag` (4th consumer)                           | `e16d098` |
| **AE349** | Extract `formatBuildSha` + 8 specs; editorial-footer consumes                                    | `_`       |
| **AE350** | Round AK docs                                                                                    | `219cb0b` |

## Round 45 — Round AL · auth-trio collapse + value-keyed transient flags ✦ AE351–AE357

Three new helpers + paired specs (`useTransientValue`, `shortId`,
`useAetherAuth`, `fmtDateOrNull`) plus the biggest single migration of
the session: **9 Aether surfaces collapse the 3-line auth trio onto
useAetherAuth**. Pulse + shares-index also adopt useTransientValue
for value-keyed ✓-chip feedback. vitest 1230 → 1254 (+24 specs).

| #         | Slice                                                                                                               | Commit    |
| --------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE351** | Extract `useTransientValue<T>` + 6 jsdom specs (sibling of AE347 useTransientFlag for value-keyed flashes)          | `_`       |
| **AE352** | Pulse copiedBubbleIdx onto `useTransientValue` (was setState+inline setTimeout-then-null guard)                     | `d55d5a8` |
| **AE353** | Extract `shortId` + 7 specs (4-then-…-then-4 elision; account consumes; was private fn)                             | `_`       |
| **AE354** | Extract `useAetherAuth` + 5 specs (composite token/bootComplete/isAuthed hook); me-home first consumer              | `_`       |
| **AE355** | 9 Aether surfaces migrate to useAetherAuth (account/destination/dispatch/journey/journeys/pulse/plan/shared/shares) | `bb8ab8e` |
| **AE356** | Add `fmtDateOrNull` + 6 specs (variant returning null; account + shares-index consume — was duplicated fns)         | `1f01c9b` |
| **AE357** | Round AL docs                                                                                                       | `6cde936` |

## Round 46 — Round AM · Atlas permalink + Pulse @mention + doc refresh ✦ AE358–AE367

Three real user-visible features (Atlas URL round-trip, `@mention`
autocomplete, ordinal-numbering consolidation), one more big consumer
migration (5 surfaces onto `useAetherTripList`), and a doc refresh
pass that pulls `08-data-flow.md` + `09-component-catalog.md` back in
sync with the post-AI-AM helper kit. vitest 1254 → 1316 (+62 specs).

| #         | Slice                                                                                                                                                                       | Commit    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE358** | Extract Atlas permalink kit (`parseAtlasParams` + `buildAtlasQuery` + `atlasParamsEqual`) + 18 specs                                                                        | `_`       |
| **AE359** | Wire Atlas to `?q=&season=&focus=`: seed state from URL on mount, debounced URL writeback (`router.replace`, scroll:false), boot focus restore via rAF                      | `d053b42` |
| **AE360** | Auto-drop stale `focusSlug` from URL when filter excludes it                                                                                                                | `14304ee` |
| **AE361** | Extract `ordinalDigits` + `ordinalLabel` + 15 specs; **6 surfaces migrate** (atlas/dispatch/about/destination/journeys/trip-pdf)                                            | `_`       |
| **AE362** | Extract `useAetherTripList` + 10 specs; **5 surfaces migrate** (me-home/journeys/shares/dispatch/destination) — folds orval call + `tripsFromQuery` into one composite hook | `_`       |
| **AE363** | Extract `currentMentionAtCursor` + `applyMentionCompletion` + 19 specs (cursor-aware @-mention detector for Pulse)                                                          | `_`       |
| **AE364** | Pulse `@`-mention autocomplete drawer (live ALL_SLUGS filter, onMouseDown completion w/ `setSelectionRange` cursor restore)                                                 | `dffe9fc` |
| **AE365** | Refresh `docs/aether/08-data-flow.md` — adds Atlas permalink + Pulse @mention diagrams + canonical helper-substitution table                                                | `d11fbae` |
| **AE366** | Refresh `docs/aether/09-component-catalog.md` — full hooks section incl. new useAetherAuth/TripList/TransientFlag/Value; lib catalog reorganised by area                    | `97437f3` |
| **AE367** | Round AM docs                                                                                                                                                               | `6b657c7` |

## Round 47 — Round AN · AE276 unblocked + @mention nav + Atlas deep-link ✦ AE368–AE373

User said "finish everything except the push". This round empties the
backlog: AE276 was wrongly listed as blocked (it's a 2-step client
flow: duplicate then PATCH-rename), the @mention drawer gets full
keyboard nav, destination cards get a focus-deep-link to Atlas, and
mentions expand to canonical names before reaching the planner.
vitest 1316 → 1331 (+15 specs). After this round the only "open"
items are operator-owned (push + prod env-flag + EAS/Apple/Play).

| #         | Slice                                                                                                                                                                                                                                                                                                                                     | Commit    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE368** | **Unblock AE276** — `useTripControllerDuplicate.onSuccess` chains `useTripControllerUpdate.mutate({title: suggestedDuplicateName(trip.title)})` when the server's hardcoded ` (copy)` doesn't match the suggested suffix (e.g. source already had `(copy)` → suggested `(copy 2)`). Rename failure is silent — the duplicate still landed | `c9813e9` |
| **AE369** | @mention drawer keyboard nav — ArrowDown/Up wraps, Enter/Tab completes, Escape closes by inserting a separator. `aria-selected` + `aria-activedescendant` for AT support. Mouse hover syncs with keyboard cursor                                                                                                                          | `64e3952` |
| **AE370** | `/aether/destinations` cards get "On Atlas →" focus deep-link CTA — `<button>` + `router.push('/aether/atlas?focus=<slug>')` via `buildAtlasQuery`; stopPropagation keeps outer `<Link>` valid                                                                                                                                            | `b2b8895` |
| **AE371** | Extract `expandMentions` + 15 specs; Pulse `ask()` expands the trimmed prompt before geocode + sample-plan so `@leh` reaches the planner as `Leh (Ladakh)`. Raw user prompt still rendered unchanged                                                                                                                                      | `_`       |
| **AE372** | Storybook variants — `PulseBubble.stories.tsx` (3 turns: short / fresh / long) using AE345 `pulseMessageBubbleStyle` + `PulseMentionDrawer.stories.tsx` (PartialQuery / HighlightSecond / NarrowedToOne)                                                                                                                                  | `_`       |
| **AE373** | Round AN docs (PROGRESS counter + 07-impl-log + memory snapshot)                                                                                                                                                                                                                                                                          | _this_    |

## Round 48 — Aether 2.0 Phase 1 kickoff · Surface manager ✦ AE374

User said "start phase 1" after the editorial preview locked at AE373.
This is a different horizon than rounds W-AN — Phase 1 ships the real
R3F + WebGPU + Tone.js runtime per `docs/aether/01-architecture.md`.

AE374 establishes the spine: `@app/aether-core` grows a Surface
manager (registry + lifecycle FSM + route → scene mapping) that
AE375 (`@app/aether-canvas` R3F primitives) and AE376
(`@app/aether-audio` Tone.js) slot into. No 3D yet — that's AE375;
no audio runtime touched — that's AE376. AE377 then mounts the first
3D Drift surface behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`.

| #         | Slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **AE374** | `@app/aether-core` Surface manager. New `surface/` subtree: `types.ts` (Surface · SurfaceId · SurfaceLifecyclePhase · SurfaceRouteMatch · SurfaceMountProps · SurfaceMountLoader) · `lifecycle.ts` (SURFACE_PHASE_ORDER + nextLifecyclePhase + isTerminalPhase + canTransition, with `listening` self-loop allowed) · `route-to-surface.ts` (literal / pattern `:slug` / predicate / overlay match kinds + overlaySurfaces extractor) · `registry.ts` (SurfaceRegistry + createSurfaceRegistry, duplicate-id throws, frozen list snapshots) · `manager.tsx` (`<SurfaceManagerProvider>` + useSurfaceManager / useCurrentSurface / useSurfaceLifecycle, hooks throw outside provider, setRoute resets phase to idle) · `mount.tsx` (`<SurfaceMountFrame>` lazy-loads `surface.mount` via Suspense, calm default placeholder, surface override prop for Storybook). Re-exports from root + `./surface` sub-path export. 44 new jest specs across 5 files. aether-core test count 24 → 68. Web vitest 1331/1331 unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `3fe7e81`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE375** | `@app/aether-canvas` Surface bridge. 5 new src files: `lifecycle-progress.ts` (pure phaseProgress + easedPhaseProgress + isPhaseComplete + easeIn/OutCubic + DEFAULT_PHASE_DURATIONS) · `lifecycle-camera.ts` (pure cameraPoseAt + previousPoseFor + lerp/lerpVec3 + DEFAULT_CAMERA_SCRIPT) · `depth-fog.tsx` (`<DepthFog>` linear-fog primitive + `linearFogDensity` pure helper) · `particle-burst.tsx` (`<ParticleBurst>` inward/outward/idle scatter + `burstOffset` pure shape) · `surface-canvas.tsx` (`<SurfaceCanvas>` integration adapter wraps `<AetherScene>` + reads AE374 manager + `<LifecycleCameraDriver>` drives useFrame, caps delta at 100ms for tab-refocus). Index re-exports them all. 60 new jest specs across 4 files. aether-canvas test count 2 → 62. Web typecheck unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `836bc92`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE376** | NEW `@app/aether-audio` workspace package — Tone.js / surface-mixer layer per 01-architecture.md §Audio. Scaffolding: package.json + tsconfig.json + eslint.config.mjs + jest.config.cjs (node-env, ts-jest, moduleNameMapper for aether-motion + aether-core). 5 new src files: `destination-keys.ts` (14 curated Indian destinations using `KeySignature` from aether-motion: Leh = C min-pent slow, Goa = D major mid, Alleppey = F lydian slow, Jaipur = E phrygian-dominant mid, Varanasi = G dorian slow, Darjeeling = A♭ major mid, Andaman = E major slow, Coorg = E min-pent slow, Hampi = D phrygian slow + region aliases like `ladakh` / `rajasthan` / `kerala`; `keySignatureFor(slug)` case-insensitive w/ italianKey fallback) · `note-picker.ts` (`pickNoteRandom` + `pickNoteWeighted` with parabolic `bellWeights` default, NaN/Infinity-safe `clamp01Open`) · `scene-mixer.ts` (`channelGainsAt(phase, progress)` maps AE374 lifecycle to dB gains; idle silent · materialising drone fades in · settling drone steady + events crossfade up · listening both at reference · dissolving drone fades out; SILENCE=-60dB, DRONE=-12dB, EVENTS=-6dB; `dbToLinear`, `isChannelSilent`) · `use-surface-key.tsx` (`useSurfaceKey(slugOverride?)` hook) · `surface-audio-layer.tsx` (`<SurfaceAudioLayer/>` side-effect rAF tick, dt capped at 100ms, reduced-motion drops drone 6dB + mutes events, optional `onChannelWrite` callback). 51 new jest specs across 3 files. Workspace pnpm install added 1 new package link. Web typecheck unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `bf351c2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE377** | **First Phase 1 Drift Surface live** — gated by `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`. Wires AE374/AE375/AE376 together at the application level. New `apps/web/src/components/aether/phase1/`: `aether-registry.ts` (5 surfaces registered — drift route-bound `/aether/drift` w/ `mount: () => import('./drift-phase1-scene')`; atlas pattern `/aether/journey/:id`; compass `/aether/atlas`; pulse + continuum overlays — last 3 mount-less for AE378+) · `drift-phase1-scene.tsx` (default-exported R3F scene = `<DepthFog/>` + `<SunDisk/>` + `<AmbientField/>` + `<ParticleBurst/>` with burst mode + progress driven by `surface.phase`) · `use-lifecycle-driver.ts` (3 pure helpers: `nextPhaseInChain` + `phaseDelayFor` + `nextScheduledPhase` (composition of the first two) + `useLifecycleAutoDriver` hook — `window.setTimeout` chain through `DEFAULT_LIFECYCLE_PLAN`: idle 60ms hold → materialise 700ms → settle 500ms → listening = steady; listening / dissolving refuse auto-advance) · `phase1-drift-shell.tsx` (mounts `<SurfaceManagerProvider>` + `<SurfaceCanvas>` with active surface lazy-loaded via `React.lazy(surface.mount)` + `<SurfaceAudioLayer onChannelWrite={...}>` + dev-only operator pip showing `surface.id · drone/events dB`; wires Next `usePathname()` → manager `setRoute`) · `index.ts` barrel. Modify `drift-shell.tsx` to flag-switch (off = editorial `<DriftCanvas/>`, on = `<Phase1DriftShell/>`). Add `@app/aether-audio` workspace dep to `apps/web/package.json`. 18 new vitest specs across 2 files (registry shape + lifecycle FSM + jsdom auto-driver chain through idle → listening using staged `act()` + `vi.advanceTimersByTime`). web vitest 1331 → 1349 (+18). Web typecheck clean. Bug-fix during dev: my initial `useLifecycleAutoDriver` called `nextScheduledPhase(phase, 0, plan)` which ALWAYS returned null because 0 < idleHoldMs — refactored into `nextPhaseInChain` (pure FSM) + `phaseDelayFor` (pure ms lookup) and re-composed the time-based query                                                                                                                                                                                                                                                                                                                                                                                                                                        | `278dd08`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE378** | **Atlas Phase 1 surface mounted** at `/aether/journey/:id` behind the same `NEXT_PUBLIC_FEATURE_AETHER_PHASE1` flag. 4 new files in `apps/web/src/components/aether/phase1/`: `atlas-orbs.ts` (pure layout math — `dayPositionOnAxis(dayIndex, totalDays, axisLength)` with edge-clamping, `orbZForSlot(slot, total, spacing)` for symmetric stacking, `layoutOrbsForTrip(days, config)` sorts by position + clamps past-`maxOrbsPerSlot` onto the last slot for pathological data, `layoutDayMarkers(days)`, `orbSizeForItem` + `orbColorForItem` override hooks, `DEFAULT_ATLAS_LAYOUT` = `{axisLength:16, orbZSpacing:0.45, maxOrbsPerSlot:6}` anchored to AE375 camera `[0,0,6]`) · `trip-data-context.tsx` (`<TripDataProvider>` + `useTripData()` — context flow for trip+days into the lazy scene that only gets `{surface, phase}` from AE374's mount contract; throws outside provider) · `atlas-phase1-scene.tsx` (default-exported R3F scene = terracotta cylinder rail rotated along X axis + ochre disc markers per day + sphere PlaceOrbs per item; theme-aware colours; hides while `isPending`) · `phase1-atlas-shell.tsx` (`<Phase1AtlasShell tripId={...}/>` mounts SurfaceManagerProvider + TripDataProvider + SurfaceCanvas + SurfaceAudioLayer + dev pip; consumes `useTripControllerGetOne` + `useTripControllerGetItinerary` from `@app/sdk`, normalises orval's `{...:unknown}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | null`placeId to`string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | null`, casts inner envelope to `ItineraryListResponseDto`). Registry's atlas surface gets `mount: () => import('./atlas-phase1-scene')`. Flag-switch in `journey-shell.tsx` chooses Phase1AtlasShell when on, editorial JourneyDashboard when off. Barrel re-exports the new symbols. **29 new vitest specs** across 2 files (25 atlas-orbs covering edge-case layout math + 4 trip-data-context provider/hook). web vitest 1349 → 1378 (+29). Web typecheck clean. 0 new lint errors. | `ad56b1f` |
| **AE379** | **Compass Bird Phase 1 surface mounted** at `/aether/atlas` behind the same flag. 4 new files in `apps/web/src/components/aether/phase1/`: `compass-rose.ts` (pure bearing math — `normalizeBearing` collapses negatives + over-range + NaN/Infinity into [0,360); `bearingToVec3(deg)` returns unit vector w/ 0°=+Z north + 90°=+X east + 180°=-Z south + 270°=-X west on the XZ plane; `bearingPositionOnRing(deg, radius)` scales the unit; `CARDINALS` table; `cardinalAt(deg)` rounds clockwise so 45° → 'E', 315° → 'N'; `angularDistance(a, b)` always returns shortest-way ∈ [0, 180]) · `compass-bearing-context.tsx` (`<CompassBearingProvider bearing={...}>` + `useCompassBearing()` — defaults to 0° instead of throwing so the scene always has a valid value) · `compass-phase1-scene.tsx` (R3F default export: cream rose disc as flat cylinder + olive-whisper torus altitude ring above + 4 cardinal sphere markers, N larger + emissive; 3-piece needle group rotated by `-bearing × π/180` about Y — terracotta cone tip pointing +Z + olive cone tail behind + emissive hub sphere) · `phase1-compass-shell.tsx` (`<Phase1CompassShell bearing={}/>` mirrors Phase1DriftShell shape — SurfaceManagerProvider + CompassBearingProvider + SurfaceCanvas + SurfaceAudioLayer + dev pip; compass's registered key signature is `jaipur` = E phrygian dominant mid from AE376). Registry's compass surface gets `mount: () => import('./compass-phase1-scene')`. Flag-switch in `atlas-shell.tsx` chooses Phase1CompassShell when on, editorial Leaflet AtlasCanvas when off. Barrel re-exports compass-rose helpers + CompassBearingProvider. **26 new vitest specs** for the pure helpers: normalizeBearing (positives, negatives, NaN, Infinity), bearingToVec3 (each cardinal direction + unit-length invariant across 9 samples + y always 0), bearingPositionOnRing (radius scaling + radius-0 → origin), CARDINALS shape, cardinalAt (boundary snapping at 45°/135°/225°/315°, 315° rounds to N per round-clockwise rule, negative inputs via normalize, 360 = 0), angularDistance (zero-to-self, 90° apart, 180° max, takes short way around 0/360 boundary). 2 self-inflicted bugs in my own specs needed fixing: `cos(157°) × 0` yields -0 in JS (use `toBeCloseTo` not `toBe`); `cardinalAt(-45)` normalises to 315° which my round-clockwise rule maps to 'N' not 'W'. web vitest 1378 → 1404 (+26). Web typecheck clean. 0 new lint errors. | `78b351d`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE380** | **Audio bridge — Tone.js engine actually plays** behind the Phase 1 surfaces. New in `@app/aether-audio`: pure `scene-audio-bridge.ts` (edge-transition computer — `computeEdgeTransitions(prev, next)` reads two ChannelSnapshots and returns `BridgeActions {startAmbient, stopAmbient, tick, setMasterDb}`; drone rising edge → startAmbient + track master dB; drone falling edge → stopAmbient; events rising edge → tick (one micro-confirm); master dB tracks the live drone level while audible, `null` while silent so we don't ramp master down to floor; `hasAnyAction(actions)` no-op short-circuit; `INITIAL_CHANNEL_SNAPSHOT` at SILENCE_DB×2) + React layer `use-scene-audio-bridge.tsx` (`useSceneAudioBridge(passthrough?, autoActivateOnPointer=true)` reads `useAudioEngine()` from aether-core, ref-tracks the previous channel snapshot so the rising edge fires the moment Tone.js wakes mid-phase, optionally installs a one-shot `pointerdown` listener that calls `engine.activate()` — required by browser autoplay policy; returns `{onChannelWrite, status, activate}`). Renamed the hook file from `scene-audio-bridge.tsx` to `use-scene-audio-bridge.tsx` to avoid a `.ts`/`.tsx` collision in TS module resolution. Wire all 3 Phase 1 shells (Drift / Atlas / Compass) — each replaces `<SurfaceAudioLayer onChannelWrite={setAudio}/>` with `useSceneAudioBridge(setAudio)` + `<SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite}/>` and surfaces the engine status (`awaiting-activation` → `starting` → `running` → `silent`/`failed`) in the dev operator pip. **20 new jest specs** covering all four channel-transition edges. aether-audio test count 51 → 71. Web typecheck clean. web vitest 1404/1404 unchanged. 0 new lint errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `1dde3ba`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE381** | **Per-surface palette derivation live**. The Surface model already carried `palette?: readonly string[]` (AE374); AE381 finally consumes it. New in `@app/aether-core`: pure `surface/palette.ts` (`SurfacePalette` readonly 5-tuple type, `DEFAULT_SURFACE_PALETTE = ['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C']` (locked Warm Italian baseline), `isValidPalette` shape check, `paletteForSurface(surface)` returns surface's palette or default, `slotsFor(palette)` projects into named slots `{ink, surface, accent, glow, support}`, `blendHex(a, b, t)` linear RGB midpoint blend with t clamping + non-hex degrade, `blendPalettes(from, to, t)` per-slot blend for future surface crossfades) + `surface/palette-hooks.tsx` (`useSurfacePalette()` reads the manager's current surface, `useSurfacePaletteSlots()` projects into named slots, `<SurfacePaletteVars target='documentElement'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 'body'>`side-effect component writes`--aether-palette-{0..4,ink,surface,accent,glow,support}` to the target on mount + removes them on unmount + renders children verbatim). Registry palettes redone: **Drift = sunset** (terracotta + ochre over cream — the brand baseline); **Atlas = deeper earth** (`#9A4836`rail +`#D6A05F` markers so the trip studio feels inhabited not bright); **Compass = navigation olive** (`#6E7B5C`accent +`#A8B596`glow rose + terracotta-glow needle tip for actionable contrast). Refactored 3 R3F scenes:`drift-phase1-scene.tsx`reads palette for AmbientField + ParticleBurst;`atlas-phase1-scene.tsx`reads palette for rail/markers/orbs (drop unused theme import);`compass-phase1-scene.tsx`reads palette for disc/markers/altitude-ring/needle-tip with theme fallback on the tail. Each Phase 1 shell mounts`<SurfacePaletteVars/>` so doc-root CSS vars track the active surface. **34 new jest specs** across 2 files (26 palette + 8 palette-hooks): default shape, isValidPalette accept/reject, paletteForSurface null+missing+malformed+valid, slotsFor mapping, blendHex t=0/1/0.5 + clamping + non-hex degrade, blendPalettes element-wise + clamp, parseHex case + reject + toHex pad/clamp; jsdom hook tests for useSurfacePalette / useSurfacePaletteSlots / SurfacePaletteVars mount-write + unmount-cleanup + target='body' + default-fallback + children passthrough. aether-core test count 68 → 102 (+34). Web vitest 1404/1404 unchanged. Web typecheck clean. 0 new lint errors. | `a4e35ba`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **AE382** | **Lifecycle loop closes — Phase 1 surfaces breathe**. Originally planned around `router.events → setPhase('dissolving')`; Next.js 15 App Router removed that API so the closest equivalent is a configurable listening-hold that auto-dissolves and re-materialises. Extended `LifecyclePlan` with `dissolvingMs` (DEFAULT = 500ms) + optional `listeningHoldMs` (closes the loop when set). New `BREATHING_LIFECYCLE_PLAN` preset = DEFAULT + `listeningHoldMs: 8000`. `nextPhaseInChain(phase, plan?)` is plan-aware: listening → dissolving iff `listeningHoldMs` set, else null (terminal); dissolving → idle iff looping, else null. `phaseDelayFor('listening', plan)` returns `listeningHoldMs ?? 0`. `phaseDelayFor('dissolving', plan)` returns `dissolvingMs`. `nextScheduledPhase` composes both correctly. AE377 default (stop at listening) preserved — DEFAULT_LIFECYCLE_PLAN has no `listeningHoldMs` so the FSM still terminates there. Wired BREATHING_LIFECYCLE_PLAN into all 3 Phase 1 shells (drift / atlas / compass): now the dissolve animation + AE380 audio drone fade-down actually fires + cycle loops. **14 new vitest specs** added to the lifecycle file (file: 9 → 23 tests): 2 BREATHING preset shape, 4 nextPhaseInChain plan-aware paths, 2 phaseDelayFor (incl. listening-hold lookup), 2 nextScheduledPhase loop (listening→dissolving@8000ms; dissolving→idle@500ms), 3 integration (listening dissolves after hold; full breath through all 5 phases back to materialising; DEFAULT still stops at listening). web vitest 1404 → 1418 (+14). Web typecheck clean. 0 new lint errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `e2ef66e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AE383** | **Navigation-triggered dissolve** — `<Link>` clicks fire the AE382 dissolve fade before route swap. Next 15 App Router has no events API so AE383 intercepts user-initiated navigation. New `dissolving-navigate.ts`: pure `delayedNavigate(setPhase, navigate, ms)` fires `setPhase('dissolving')` synchronously then schedules `navigate()` after `ms` (returns cancel handle); `useDissolvingNavigate(dissolveMs = 500)` wraps `useRouter().push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | replace`from Next so any imperative navigation in a Phase 1 shell fires dissolve first (cancels prior pending on rapid double-push; clears timer on unmount).`DEFAULT_DISSOLVE_MS = 500`matches AE375/AE382. New`dissolving-link.tsx`: `<DissolvingLink href={...} dissolveMs? replace?>`wraps Next's`<Link>`w/ onClick interception;`isInAppClick(event)`gates on`button===0`+ no modifier keys (Cmd/Ctrl/Shift/Alt all bypass per browser default) + target`\_self`/empty. New `phase1-dev-nav.tsx`: `<Phase1DevNav active?>`2-chip floating strip (Drift + Compass) using DissolvingLink;`display:none`in prod. Mounted in all 3 Phase 1 shells. Barrel re-exports the new symbols + oversight-fix`BREATHING_LIFECYCLE_PLAN` from AE382. **21 new vitest specs**: 5 pure delayedNavigate, 5 hook (push/replace, rapid-double collapses to latest, custom dissolveMs, unmount cancels), 6 isInAppClick edges, 5 DissolvingLink (renders anchor w/ href, left-click triggers dissolve+push, Cmd-click bypasses, replace prop uses router.replace, user onClick still fires). web vitest 1418 → 1439 (+21). Web typecheck clean. 0 new lint errors.                                                                                                                                                                                                                                                                                                                                                                                            | `bef258a`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **AE384** | **Atlas re-tints per-destination** — replaces the deeper-earth registry default with a slug-derived palette when trip data is available. New `surface/destination-palettes.ts`: `DESTINATION_PALETTES` (8 canonical destinations + 6 aliases sharing palette object identity); `paletteForDestination(slug)` case-insensitive lookup w/ DEFAULT fallback; `hasCuratedPalette` predicate; `extractDestinationSlugFromTitle(title)` heuristic uses `\b<slug>\b` word-boundary regex so "Goal" doesn't trip 'goa'; first-registered-wins on multi-destination titles. New `<SurfacePaletteOverride palette={...}>` provider in `surface/palette-hooks.tsx` extends AE381's `useSurfacePalette()` to prefer the override context value over the registered Surface's palette; null override = defer to surface (backward-compatible). Atlas shell `phase1-atlas-shell.tsx` extracts slug from `trip?.title` via `useMemo`, maps to a palette via `paletteForDestination`, wraps the canvas tree in `<SurfacePaletteOverride>`. SurfacePaletteVars then writes the destination palette's CSS vars on the doc root. **20 new jest specs** across 2 files: 14 destination-palettes (frozen + 5-tuple shape + alias identity + case-insensitive lookup + nullish fallback + word-boundary regex + first-wins multi-destination), 6 palette-override (no-override falls through; non-null wins; works without surface match; CSS vars track override). aether-core test count 102 → 122 (+20). web vitest 1439/1439 unchanged. Web typecheck clean. 0 new lint errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | _next_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

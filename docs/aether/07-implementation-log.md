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

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

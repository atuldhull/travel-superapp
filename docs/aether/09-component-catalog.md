# Aether — Component catalog

Every Aether component, what it does, and which route mounts it.
Use this when debugging "where does X render?" or scoping a refactor.

> All Aether components live under
> `apps/web/src/components/aether/`. Packages used:
> `@app/aether-motion` (tokens), `@app/aether-core` (provider + hooks),
> `@app/aether-canvas` (primitives).

---

## Pattern: page.tsx → _-lazy.tsx → _-shell.tsx → page body

Every Aether route follows the same four-layer pattern:

| Layer     | File                                       | Responsibility                                                                                                                   |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Route** | `apps/web/src/app/aether/<route>/page.tsx` | Server Component. Env-gate (`NEXT_PUBLIC_FEATURE_AETHER_PREVIEW`), metadata + OG via `aetherOg(...)`, hands off to lazy wrapper  |
| **Lazy**  | `<route>-lazy.tsx`                         | Client Component with `dynamic(..., {ssr:false})` import of the shell                                                            |
| **Shell** | `<route>-shell.tsx`                        | Mounts `<AetherProvider>` with theme override (next/font CSS vars prepended), `<AetherA11yStyles>`, the page body, and `<Pulse>` |
| **Body**  | `<route>-page.tsx` (or canonical name)     | The actual editorial composition. Hooks: `useTheme`, `useViewport`, etc.                                                         |

Why ssr:false: Next 15 disallows `dynamic({ssr:false})` from Server Components,
and the shells use motion / window / audio hooks that need DOM.

## Top-level shared components

| Component            | Path                                  | Purpose                                                                                                      | Mounted by                                                            |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `<DriftNav>`         | `drift-nav.tsx`                       | Sticky top nav, transparent → glass-cream on scroll, includes `<AudioChip>`                                  | Every page body                                                       |
| `<EditorialFooter>`  | `drift-sections/editorial-footer.tsx` | 4-column sitemap on espresso band                                                                            | Every page body                                                       |
| `<Pulse>`            | `pulse/pulse.tsx`                     | Bottom-right AI FAB → conversational drawer w/ sample-plan + threaded refinement + save-as-trip + save+share | Every shell (except `plan-shell.tsx` — the planner IS the AI surface) |
| `<AudioChip>`        | `audio-chip.tsx`                      | Top-nav audio control: pill + popover (volume slider, mute, test chime), localStorage-persisted              | `<DriftNav>`                                                          |
| `<SafeImg>`          | `safe-img.tsx`                        | `<img>` with Aether-styled gradient fallback on 404                                                          | Every editorial card; NOT used for parallax-ref heroes                |
| `<Reveal>`           | `drift-sections/reveal.tsx`           | IntersectionObserver fade-in wrapper                                                                         | Every editorial section                                               |
| `<AetherA11yStyles>` | `aether-a11y-styles.tsx`              | Single `<style>` block injecting sandstone focus rings on `:focus-visible`                                   | Every shell                                                           |

## Drift home (`/aether/drift`)

| Component                   | Purpose                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `<DriftCanvas>`             | The full Drift composition                                                                                      |
| `<FeaturedChips>`           | Season-of-the-moment chip strip in the hero                                                                     |
| `<StatStrip>`               | 4-stat horizontal strip                                                                                         |
| `<RegionsGrid>`             | 6-card destinations grid linking to slug pages                                                                  |
| `<Voices>`                  | 3 italic-serif testimonial quotes                                                                               |
| `<JournalPreview>`          | 3 editorial article cards (link to /aether/journal/:slug)                                                       |
| `<ScrollIndicator>`         | "Scroll" hint at bottom-right of hero                                                                           |
| `photos.ts`                 | Photography manifest: HERO, HERO_CAROUSEL, EXPERIENCES, REGIONS, JOURNAL, SEASON_CHIPS + `photoUrl`/`creditUrl` |
| Photographer credit overlay | Inline in `drift-canvas.tsx` (AE41), keyed on `currentHero.id`                                                  |

## Atlas (`/aether/atlas`)

| Component       | Purpose                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `<AtlasCanvas>` | Leaflet map + DriftNav + footer                                                            |
| `<AtlasMap>`    | Leaflet integration (15 lat/lng pins, CartoDB Dark Matter tiles, terracotta-glow divIcons) |
| `pins-data.ts`  | The 15 destination markers (lat/lng/slug/name/blurb)                                       |

## Destinations (`/aether/destinations` + `/aether/destinations/[slug]`)

| Component             | Purpose                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<DestinationsIndex>` | 15-card filtered index, kicker filter chips                                                                       |
| `<DestinationPage>`   | Per-slug editorial layout (hero, facts, lede, moments, itineraries, CTAs); AE45 surfaces "Add to your draft" pill |
| `data.ts`             | All 15 destinations as TS literals + `ALL_SLUGS` + `DESTINATIONS` lookup                                          |

## Journal (`/aether/journal` + `/aether/journal/[slug]`)

| Component              | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `<JournalIndex>`       | Featured + archive grid                                                     |
| `<JournalArticleView>` | Long-form layout: hero, dek, byline, body (p / pull / h2 blocks)            |
| `data.ts`              | 6 articles as TS literals + `ALL_JOURNAL_SLUGS` + `JOURNAL_ARTICLES` lookup |

## Plan (`/aether/plan`)

| Component    | Purpose                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `<PlanPage>` | Form: where / kind / days; reads `?where=&pace=&days=` searchParams; geocodes via Photon; POSTs `/trips` |

## Journey (`/aether/journey/[id]`)

| Component            | Purpose                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<JourneyDashboard>` | Live editorial view of a saved trip: title, status, facts, share + archive + duplicate actions, itinerary day cards (AE40), addPlace banner (AE45), open-in-planner CTA |

## /aether/me/\* surfaces

| Route                   | Component                                   | Notes                                                                                    |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/aether/me`            | `<MeHome>` (`me-home/`)                     | 3-card landing (Journeys / Shares / Account) + stats strip                               |
| `/aether/me/journeys`   | `<JourneysIndex>` (`me/`)                   | List of trips with status filter chips; "Your shares" deep-link                          |
| `/aether/me/shares`     | `<SharesIndex>` + `<TripShareBand>` (`me/`) | Per-trip share index, Copy/Revoke per share                                              |
| `/aether/account`       | `<AccountPage>` (`account/`)                | Identity dl + audio + motion + privacy sections + Sign out                               |
| `/aether/onboarding`    | `<OnboardingPage>` (`onboarding/`)          | 3-beat first-time editorial welcome; marks `aether-onboarded=1` in localStorage on mount |
| `/aether/shared/[code]` | `<SharedTripView>` (`shared/`)              | Public read-only view + clone CTA                                                        |

## Hooks

| Hook                                          | File              | Returns                                                |
| --------------------------------------------- | ----------------- | ------------------------------------------------------ | ----------- | ------------------------------------------- |
| `useViewport()`                               | `use-viewport.ts` | `{isNarrow ≤640, isMid 641-960}` SSR-safe              |
| `useParallax<T>()`                            | `use-parallax.ts` | Ref forwarder + scroll-driven transform                |
| (from `@app/aether-core`) `useTheme()`        | n/a               | Aether theme object                                    |
| (from `@app/aether-core`) `useMotionPolicy()` | n/a               | `'full'                                                | 'essential' | 'none'`derived from`prefers-reduced-motion` |
| (from `@app/aether-core`) `useAudioEngine()`  | n/a               | `{engine, status}` — controls + state of ambient audio |
| `useAuthBootComplete()` / `useAuthToken()`    | (apps/web lib)    | Auth gate                                              |

## Lib helpers (under `apps/web/src/lib/`)

| File            | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| `aether-og.ts`  | Shared OG + Twitter Card metadata builder (`aetherOg(title, desc, {photoId?})`)       |
| `geocode.ts`    | Photon → Nominatim chain with 1h in-memory Map cache                                  |
| `auth-store.ts` | In-memory access token store (`getAccessToken`, `setAccessToken`, `clearAccessToken`) |

## Data sources

- **Trip data** — `@app/sdk` hooks (orval-generated React Query)
- **Geocoding** — Photon (komoot, keyless) with Nominatim fallback, 1h cache
- **AI plans** — `POST /trips/sample-plan` (public; Gemini → Ollama → stub chain)
- **Photography** — Unsplash IDs in `apps/web/src/components/aether/photos.ts` + `journal/data.ts` + `destinations/data.ts`. Replace at Phase 2 with commissioned photography. `next.config.ts` allowlists `images.unsplash.com` + `plus.unsplash.com` for next/image.

---

_If you add a new component, append a row to this catalog._

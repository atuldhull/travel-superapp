/**
 * Aether Surface registry factory.
 *
 * Boots a `SurfaceRegistry` (from @app/aether-core) with all surfaces
 * `apps/web` knows how to mount. The function name still carries the
 * Phase 1 prefix for historical reasons (AE377 onwards); AE398+ adds
 * Phase 2 surfaces (Lumen first) into the same registry — `phase` is
 * just a field on each entry and the route matcher doesn't filter on
 * it, so a Phase 1 shell happily mounts Lumen if a future test wires
 * an outer route override.
 *
 * Each mount loader returns the R3F-backed scene component lazily so
 * the chunk only loads when the route actually hits its bound URL.
 */
import { createSurfaceRegistry, type SurfaceRegistry } from '@app/aether-core';

/** Build the registry used by AE377's `<Phase1DriftShell>`. The function
 *  is exported so apps/web tests (and Storybook fixtures later) can
 *  construct a fresh registry per scenario rather than sharing module
 *  state. */
export function createAetherPhase1Registry(): SurfaceRegistry {
  return createSurfaceRegistry([
    {
      id: 'drift',
      phase: 1,
      keySignature: 'goa',
      // AE381 — Drift gets the locked Warm Italian baseline. Sunset
      // ochre + terracotta over cream.
      palette: ['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C'],
      route: { kind: 'literal', pathname: '/aether/drift' },
      // The R3F scene module lives next door; lazy-loaded so non-Phase-1
      // routes never download three/postprocessing/etc.
      mount: () => import('./drift-phase1-scene'),
    },
    {
      id: 'atlas',
      phase: 1,
      keySignature: 'leh',
      // AE381 — Atlas (the trip studio) earths into the deeper
      // terracotta and a warmer gold; it should feel inhabited, not
      // bright.
      palette: ['#180F0B', '#F2E8D5', '#9A4836', '#D6A05F', '#6E7B5C'],
      route: { kind: 'pattern', pathname: '/aether/journey/:id' },
      // AE378 wires the first cut: timeline rail + day markers + place orbs.
      // Later slices add weather shaders, draggable orbs, real skyline.
      mount: () => import('./atlas-phase1-scene'),
    },
    {
      id: 'compass',
      phase: 1,
      keySignature: 'jaipur',
      // AE381 — Compass leads with olive (the navigation hue) and uses
      // terracotta only as support so the needle still reads as a
      // direction prompt, not the focal point.
      palette: ['#1A0F09', '#F2E8D5', '#6E7B5C', '#A8B596', '#C2614A'],
      route: { kind: 'literal', pathname: '/aether/atlas' },
      // AE379 wires the first cut: compass rose + cardinal markers +
      // bearing needle. Later slices add Mapbox 3D buildings, route
      // ribbons, and AR Eye mode on mobile.
      mount: () => import('./compass-phase1-scene'),
    },
    {
      id: 'pulse',
      phase: 1,
      // AE389 — Pulse's palette tracks the host surface, but the
      // overlay's tiny private Canvas falls back to ochre when no
      // surface palette is provided.
      palette: ['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C'],
      route: { kind: 'overlay' },
      // AE396 — symmetric mount loader. The Phase 1 shell renders the
      // Pulse glow via `<Phase1PulseOverlay>` (HTML container + private
      // <Canvas>) rather than through `<SurfaceMountFrame>`, but the
      // mount loader is registered so Storybook fixtures + the future
      // Mirror admin tree can lazy-load the same scene via the standard
      // path. The fact that overlays don't get auto-mounted by the
      // route resolver keeps the production rendering path untouched.
      mount: () => import('./pulse-phase1-scene'),
    },
    {
      id: 'continuum',
      phase: 1,
      route: { kind: 'overlay' },
      // AE390 — Continuum is HTML-only (4px edge-line + popover). No
      // R3F scene to mount; the bar renders inline via
      // `<Phase1ContinuumBar>` from each shell. The `mount` loader is
      // intentionally absent.
    },
    {
      // AE398 — Lumen, the memory studio. Photos float in a 3D cloud
      // sorted by capture time on the X axis + user rating on the Y
      // axis. First scaffold mounts at `/aether/memory/:id` (the
      // memory book id). Future slices wire `useMediaControllerListByTrip`
      // for the photo set + CLIP-embedding "arrange by mood" voice
      // commands (per 02-surfaces.md §4).
      id: 'lumen',
      phase: 2,
      // Lumen leans into the gallery feel — deeper ink + creamy paper +
      // warm ochre highlight + olive accent. The palette is dimmer than
      // Drift so photos pop as the focal element.
      palette: ['#140C08', '#EFE5D2', '#A37C3B', '#D6B280', '#5C6A50'],
      // Audio key signature stays unset for now — Phase 2 audio slice
      // picks a curated "gallery hush" pad rather than a destination key.
      route: { kind: 'pattern', pathname: '/aether/memory/:id' },
      // AE399 wires the first cut R3F scene (photo planes positioned
      // via AE398 `layoutPhotoCloud`). Until that lands the route still
      // resolves; SurfaceMountFrame just shows its placeholder.
      mount: () => import('../phase2/lumen-phase2-scene'),
    },
    {
      // AE407 — Vault, the bookings + commerce surface. Per
      // 02-surfaces.md §8 prices float as weighted glyphs. First cut
      // mounts at /aether/vault with placeholder fixtures; the R3F
      // shader + Stripe Checkout iframe land in later slices.
      id: 'vault',
      phase: 2,
      // Vault leans deeper into the warm earth so prices read as
      // material — terracotta over a creamier paper.
      palette: ['#1A0F09', '#F2E8D5', '#B0644A', '#D6A05F', '#6E7B5C'],
      route: { kind: 'literal', pathname: '/aether/vault' },
      // AE414 — first cut R3F scene (sphere ring + per-glyph bob).
      // The 2D HTML labels still render on top so prices stay legible;
      // a future slice can use drei `<Html>` to attach labels in 3D.
      mount: () => import('../phase2/vault-phase2-scene'),
    },
    {
      // AE418 — Echo, the social feed surface (Phase 3, Surface #6).
      // Per 02-surfaces.md §6 Echo, the page palette re-derives from
      // each echo's photos as the user scrolls. First cut mounts at
      // /aether/feed with the AE418 sample fixtures; AE419 wires the
      // R3F vertical-scroll scene; the eventual `useFeedController*`
      // adapter lands in a b-slice.
      id: 'echo',
      phase: 3,
      // Echo's per-echo palette is derived live by AE420 from the
      // current echo's photo; the registry entry carries a baseline
      // for the first paint (and for echoes whose photo is null).
      palette: ['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C'],
      route: { kind: 'literal', pathname: '/aether/feed' },
      mount: () => import('../phase3/echo-phase3-scene'),
    },
  ]);
}

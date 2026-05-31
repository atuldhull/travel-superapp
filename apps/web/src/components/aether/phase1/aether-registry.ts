/**
 * Aether Phase 1 — Surface registry factory.
 *
 * Boots a `SurfaceRegistry` (from @app/aether-core) with the Phase 1
 * Surfaces and their route bindings. AE377 wires only **Drift** for now;
 * Atlas + Compass + Pulse + Continuum register as no-mount placeholders
 * so the manager has the right shape for the eventual scenes.
 *
 * The mount loader for Drift returns the R3F-backed scene component lazily
 * so the chunk only loads when the route actually hits `/aether/drift` and
 * the Phase 1 flag is on.
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
  ]);
}

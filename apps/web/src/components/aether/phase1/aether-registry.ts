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
      route: { kind: 'pattern', pathname: '/aether/journey/:id' },
      // mount loader lands in a future AE prompt; until then SurfaceMountFrame
      // shows the calm placeholder for this surface.
    },
    {
      id: 'compass',
      phase: 1,
      keySignature: 'jaipur',
      route: { kind: 'literal', pathname: '/aether/atlas' },
    },
    {
      id: 'pulse',
      phase: 1,
      route: { kind: 'overlay' },
    },
    {
      id: 'continuum',
      phase: 1,
      route: { kind: 'overlay' },
    },
  ]);
}

/**
 * Surface model — the conceptual unit of Aether 2.0 Phase 1.
 *
 * Every URL the user visits is mapped to **one Surface** (a 3D scene), or to
 * an overlay Surface that floats above the current route. The Surface model
 * is intentionally pure data so the routing + lifecycle machinery can be
 * tested without React, then wired up by `<SurfaceManagerProvider>`.
 *
 * Phase 1 (04-sequencing.md) ships these Surfaces:
 *   route-bound: drift · atlas · compass (Bird mode)
 *   overlay:     pulse · continuum
 * The other five (genie · lumen · echo · vault · mirror) land in Phase 2+.
 *
 * Types live here. Behaviour lives in `lifecycle.ts` / `route-to-surface.ts`
 * / `registry.ts`. The React layer is in `manager.tsx` + `mount.tsx`.
 *
 * Source-of-truth: docs/aether/02-surfaces.md.
 */
import type { ComponentType } from 'react';

/** Stable identifier for one of the ten Surfaces (02-surfaces.md §Map).
 *
 *  Why string-union, not enum: keeps the runtime side-effect-free and lets
 *  consumers narrow with `if (s.id === 'drift')` without importing a value. */
export type SurfaceId =
  | 'drift'
  | 'genie'
  | 'atlas'
  | 'lumen'
  | 'compass'
  | 'echo'
  | 'pulse'
  | 'vault'
  | 'mirror'
  | 'continuum';

/** The five lifecycle phases every Surface walks (02-surfaces.md §How surfaces compose).
 *
 *  Linear path: idle → materialising → settling → listening → dissolving → idle.
 *
 *  `anticipating` (Predictor pre-warming the next Surface) is parallel to
 *  `listening` rather than a phase of its own — we track it as a separate
 *  field on `SurfaceManagerState`. */
export type SurfaceLifecyclePhase =
  | 'idle'
  | 'materialising'
  | 'settling'
  | 'listening'
  | 'dissolving';

/** How a Surface attaches to user-facing navigation.
 *
 *   - `literal`   — exact pathname match (e.g. '/aether').
 *   - `pattern`   — `:slug`-style segments, matched left-to-right.
 *                   `/aether/journey/:id` matches `/aether/journey/abc123`.
 *   - `predicate` — caller-supplied test; escape hatch for query-aware
 *                   matching (e.g. `?surface=atlas`). Avoid when a literal
 *                   or pattern works — predicates aren't serializable.
 *   - `overlay`   — Surface is route-independent (Pulse + Continuum).
 *                   Always considered "current" alongside the route-bound
 *                   Surface; both render. */
export type SurfaceRouteMatch =
  | { readonly kind: 'literal'; readonly pathname: string }
  | { readonly kind: 'pattern'; readonly pathname: string }
  | { readonly kind: 'predicate'; readonly match: (pathname: string) => boolean }
  | { readonly kind: 'overlay' };

/** Props the lazy-loaded Surface implementation receives.
 *
 *  AE374 ships the contract; AE375 (@app/aether-canvas) provides the
 *  R3F-backed default implementation. The frame in `mount.tsx` falls back
 *  to a non-3D placeholder when `surface.mount` is undefined. */
export interface SurfaceMountProps {
  readonly surface: Surface;
  readonly phase: SurfaceLifecyclePhase;
}

/** Lazy import returning the Surface scene component.
 *
 *  Shape matches Next.js / React.lazy expectations (`{ default: ... }`)
 *  so consumers can do `mount: () => import('./atlas-scene')` directly. */
export type SurfaceMountLoader = () => Promise<{
  default: ComponentType<SurfaceMountProps>;
}>;

/** A registered Surface — metadata + a lazy mount factory.
 *
 *  Why readonly everywhere: a registry handed back to consumers should be
 *  pratically immutable; surfaces are registered once at app boot, then
 *  read by the manager. */
export interface Surface {
  readonly id: SurfaceId;
  readonly route: SurfaceRouteMatch;
  /** Phase this Surface ships in (02-surfaces.md §Map). Used by the
   *  manager to skip Surfaces gated by `NEXT_PUBLIC_FEATURE_AETHER_PHASE1`
   *  while leaving later Phases registered for AE375+. */
  readonly phase: 1 | 2 | 3 | 4 | 5 | 6;
  /** Tone.js key signature (per 01-architecture.md §Audio). Wired by
   *  `@app/aether-audio` in AE376; AE374 carries the slot only. */
  readonly keySignature?: string;
  /** Fallback palette before per-destination derivation (Phase 6).
   *  Five hex strings — Drift uses index 0 for the background drone. */
  readonly palette?: ReadonlyArray<string>;
  /** Lazy scene loader. Optional in AE374; AE375 will require it for
   *  route-bound Surfaces but overlays may stay loader-less if their
   *  content is registered globally elsewhere. */
  readonly mount?: SurfaceMountLoader;
}

/**
 * `PredictableSurfaceId` — local canvas-shared mirror of the `SurfaceId`
 * union canonicalised in `@app/aether-core` (`./surface/types.ts`).
 *
 * Phase 5 (Predictive). The predictor ranks which Aether surface the
 * user is most likely to navigate to next, so it speaks in `SurfaceId`s.
 * We mirror the union here — exactly like `SurfaceLifecyclePhase`
 * (AE526) — so the predictor math stays framework-free: importing the
 * real `SurfaceId` from `@app/aether-core` would transit that package's
 * React-19 JSX barrel and clash with apps/mobile's React-18 @types. The
 * two unions are the literal 10 surface ids and stay in lock-step by
 * construction.
 *
 * When the predictor wires into `SurfaceManagerState.anticipate(id)`
 * (the Phase-5 socket already present in aether-core's surface manager),
 * a `PredictableSurfaceId` is assignment-compatible with the real
 * `SurfaceId` because both are the same string literals.
 */
export type PredictableSurfaceId =
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

/**
 * The surfaces the predictor ranks as navigation targets — every
 * surface EXCEPT `pulse`. Pulse is the always-present corner overlay
 * (it is never "navigated to"), so it is not a prediction candidate.
 * Frozen so a consumer can't mutate the canonical candidate set.
 */
export const NAVIGABLE_SURFACES: readonly PredictableSurfaceId[] = Object.freeze([
  'drift',
  'atlas',
  'compass',
  'continuum',
  'vault',
  'lumen',
  'echo',
  'genie',
  'mirror',
]);

/** Type guard: is `value` one of the navigable (predictable) surfaces? */
export function isNavigableSurface(value: unknown): value is PredictableSurfaceId {
  return typeof value === 'string' && (NAVIGABLE_SURFACES as readonly string[]).includes(value);
}

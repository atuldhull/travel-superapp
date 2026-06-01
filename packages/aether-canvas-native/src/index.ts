/**
 * @app/aether-canvas-native — Aether 2.0 canvas package for RN.
 *
 * Phase 4 (mobile parity) foundation package. AE515 first cut.
 *
 * Two parallel renderer paths land here, per Phase 4 decision #2
 * (locked 2026-06-01):
 *
 *   • **R3F native** for surfaces with depth (Drift / Atlas / Lumen /
 *     Compass / Vault / Echo / Genie). Uses expo-three + the native
 *     R3F bindings (`@react-three/fiber/native`). Per-surface scene
 *     files live under `./scenes/r3f/<surface>.tsx`.
 *   • **Skia** for flat surfaces (Pulse / Mirror / Continuum). Uses
 *     `@shopify/react-native-skia`. Per-surface scene files live
 *     under `./scenes/skia/<surface>.tsx`.
 *
 * The scene files are added incrementally as each surface ports.
 * AE515 ships just the policy table + the canvas-shared re-export
 * barrel so future slices can land scenes one at a time.
 *
 * Pure math is re-exported from `@app/aether-canvas-shared` so the
 * R3F native + Skia scenes use the exact same lifecycle progress /
 * camera poses / particle math as the web R3F implementation. AE489
 * invariants apply to both.
 */

// Re-export the entire pure-math surface from canvas-shared. Native
// scenes import from `@app/aether-canvas-native` and get identical
// semantics to web scenes that import from `@app/aether-canvas`.
export * from '@app/aether-canvas-shared';

// AE515 — renderer policy (locked Phase 4 decision #2).
export {
  r3fNativeSurfaceIds,
  rendererForSurface,
  skiaSurfaceIds,
  type NativeRenderer,
} from './renderer-policy';

/** Package version marker — tests pin this to confirm the barrel
 *  resolves. Mirrors @app/aether-canvas-shared's pattern. */
export const AETHER_CANVAS_NATIVE_VERSION = '0.0.1';

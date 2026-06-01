/**
 * @app/aether-core-native — Aether 2.0 core for React Native.
 *
 * Phase 4 (mobile parity) foundation package. AE514 first cut.
 *
 * The web `@app/aether-core` package is largely platform-agnostic:
 * the surface manager, lifecycle FSM, palette helpers, theme,
 * reduced-motion + premium contexts all run on React only, no DOM
 * dependency. So this package re-exports those pieces verbatim and
 * adds the two RN-specific shims:
 *
 *   1. `SurfacePaletteSlotsContext` — replaces the web's
 *      `<SurfacePaletteVars>` CSS custom properties. RN has no
 *      global "document root" for vars, so the slots ride a React
 *      Context instead. Deep consumers can read the slots without
 *      sitting under a `<SurfaceManagerProvider>`.
 *   2. `<SurfacePaletteSlotsProvider>` — mirrors `useSurfacePalette()`
 *      into the Context above. Mount once high in the tree; every
 *      descendant reads via `useSurfacePaletteSlotsFromContext()`.
 *
 * `<SurfacePaletteVars>` is re-exported transparently for migration
 * convenience — its DOM-write effect guards `typeof document ===
 * 'undefined'` and no-ops on RN. Native consumers should prefer the
 * `<SurfacePaletteSlotsProvider>` + `useSurfacePaletteSlotsFromContext()`
 * pair instead; mounting `<SurfacePaletteVars>` on RN is harmless but
 * does nothing.
 */

// Re-export the entire @app/aether-core public surface verbatim.
export * from '@app/aether-core';

// New native-only context exports — definitions live alongside.
export {
  SurfacePaletteSlotsContext,
  SurfacePaletteSlotsProvider,
  useSurfacePaletteSlotsFromContext,
  type SurfacePaletteSlotsContextValue,
} from './palette-slots-context';

/** Package version marker — tests pin this to confirm the barrel
 *  resolves. Mirrors @app/aether-canvas-shared's pattern. */
export const AETHER_CORE_NATIVE_VERSION = '0.0.1';

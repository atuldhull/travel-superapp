/**
 * @app/aether-core — runtime providers + hooks.
 *
 * One root: `<AetherProvider>`.
 * Hooks: `useTheme`, `useMotionPolicy`, `useReducedMotion`, `usePremium`,
 * `useAudioEngine`, `usePerception` (Phase 0) +
 * `useSurfaceManager`, `useCurrentSurface`, `useSurfaceLifecycle` (Phase 1, AE374).
 *
 * The Phase 1 Surface module also re-exports from `./surface`; consumers
 * can import either from the root (`@app/aether-core`) or sub-path
 * (`@app/aether-core/surface`) — the sub-path keeps non-Aether-runtime
 * apps from pulling the surface tree.
 *
 * Decisions locked: docs/aether/06-decisions.md.
 */
export { AetherProvider, type AetherProviderProps } from './provider';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './theme';
export {
  ReducedMotionProvider,
  useMotionPolicy,
  useReducedMotion,
  type MotionPolicy,
  type ReducedMotionProviderProps,
  type ReducedMotionState,
} from './reduced-motion';
export {
  PremiumProvider,
  PremiumGate,
  usePremium,
  defaultPremiumRule,
  type PremiumCapability,
  type PremiumTier,
  type PremiumState,
  type PremiumProviderProps,
  type PremiumGateProps,
} from './premium';
export {
  PerceptionProvider,
  usePerception,
  type PerceptionState,
  type GazePoint,
  type GestureEvent,
  type Gesture,
  type PerceptionProviderProps,
} from './perception';
export {
  AudioEngineProvider,
  useAudioEngine,
  type AudioEngineProviderProps,
  type AudioEngineContextValue,
} from './audio-hooks';
export {
  createAudioEngine,
  toneDbToGain,
  type AudioEngine,
  type AudioEngineStatus,
  type AudioEngineConfig,
  type AudioEngineEvents,
} from './audio-engine';

// Phase 1 (AE374) — Surface manager + lifecycle + route → scene map.
export type {
  Surface,
  SurfaceId,
  SurfaceLifecyclePhase,
  SurfaceMountLoader,
  SurfaceMountProps,
  SurfaceRouteMatch,
} from './surface/types';
export {
  SURFACE_PHASE_ORDER,
  canTransition,
  isTerminalPhase,
  nextLifecyclePhase,
} from './surface/lifecycle';
export { matchSurfaceRoute, overlaySurfaces, routeToSurface } from './surface/route-to-surface';
export { SurfaceRegistry, createSurfaceRegistry } from './surface/registry';
export {
  SurfaceManagerProvider,
  useCurrentSurface,
  useSurfaceLifecycle,
  useSurfaceManager,
  type SurfaceManagerProviderProps,
  type SurfaceManagerState,
} from './surface/manager';
export { SurfaceMountFrame, type SurfaceMountFrameProps } from './surface/mount';

// Phase 1 (AE381) — per-surface palette derivation + CSS-vars bridge.
export {
  DEFAULT_SURFACE_PALETTE,
  blendHex,
  blendPalettes,
  isValidPalette,
  paletteForSurface,
  slotsFor,
  type SurfacePalette,
  type SurfacePaletteSlots,
} from './surface/palette';
export {
  SurfacePaletteVars,
  useSurfacePalette,
  useSurfacePaletteSlots,
  type SurfacePaletteVarsProps,
} from './surface/palette-hooks';

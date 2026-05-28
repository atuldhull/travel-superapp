/**
 * @app/aether-core — runtime providers + hooks.
 *
 * One root: `<AetherProvider>`.
 * Five hooks: `useTheme`, `useMotionPolicy`, `useReducedMotion`,
 * `usePremium`, `useAudioEngine`, `usePerception`.
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

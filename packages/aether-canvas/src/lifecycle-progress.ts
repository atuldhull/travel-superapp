/**
 * Lifecycle phase progress — re-export from `@app/aether-canvas-shared`.
 *
 * The actual implementation moved to the shared package in AE454 so the
 * Phase 4 native canvas can consume identical math without pulling
 * R3F peer dependencies. This file remains for back-compat with web
 * callsites that import from `@app/aether-canvas`.
 */
export {
  DEFAULT_PHASE_DURATIONS,
  easeInCubic,
  easeOutCubic,
  easedPhaseProgress,
  isPhaseComplete,
  phaseProgress,
  __testing,
  type LifecyclePhaseDurations,
} from '@app/aether-canvas-shared';

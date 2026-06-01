/**
 * Now Card lifecycle CSS — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE480 so the Phase 4
 * native Drift Now Card uses identical phase-aware opacity / scale /
 * transition math. This file remains so existing imports keep
 * working.
 */
export {
  DEFAULT_NOW_CARD_DURATIONS,
  nowCardCssForPhase,
  nowCardOpacityForPhase,
  nowCardScaleForPhase,
  nowCardTransitionMs,
  type LifecycleDurationsMs,
} from '@app/aether-canvas-shared';

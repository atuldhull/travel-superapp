/**
 * Pulse hold-to-talk gesture FSM — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE479 so the Phase 4
 * native Pulse (RN gesture handlers) consumes identical thresholds
 * + state transitions. This file remains so existing imports keep
 * working.
 */
export {
  PULSE_HOLD_THRESHOLD_MS,
  holdStatusLabel,
  isHoldGesture,
  nextHoldStatus,
  pulseReleaseOutcome,
  type PulseHoldStatus,
  type PulseReleaseOutcome,
} from '@app/aether-canvas-shared';

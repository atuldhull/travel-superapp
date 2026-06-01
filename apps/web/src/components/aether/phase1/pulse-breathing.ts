/**
 * Pulse breathing math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE455 so the Phase 4
 * native Pulse can consume identical envelopes without DOM or React.
 * This file remains so existing imports from
 * `components/aether/phase1/pulse-breathing` keep working.
 */
export {
  moodFromPhase,
  pulseBreathAt,
  pulseBreathParams,
  pulseBreathStatic,
  type PulseBreathParams,
  type PulseBreathState,
  type PulseMood,
} from '@app/aether-canvas-shared';

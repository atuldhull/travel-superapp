/**
 * Drift Now Card content — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE457 so the Phase 4
 * native Drift consumes identical time-band routing. This file
 * remains so existing imports keep working.
 */
export {
  nowCardContent,
  nowCardContentNow,
  timeBandFor,
  type NowCardContent,
  type TimeBand,
} from '@app/aether-canvas-shared';

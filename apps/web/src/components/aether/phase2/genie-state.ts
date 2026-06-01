/**
 * Genie modal state machine — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE469 so the Phase 4
 * native Genie modal consumes identical state transitions. This file
 * remains so existing imports keep working.
 */
export {
  genieIsActive,
  genieMicAriaLabel,
  genieMicRingColor,
  genieOnError,
  genieOnMicPress,
  genieOnMicRelease,
  genieOnStt,
  genieReset,
  genieStateLabel,
  type GenieState,
} from '@app/aether-canvas-shared';

/**
 * Echo feed helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE477 so the Phase 4
 * native Echo feed consumes identical swipe + palette derivation +
 * cursor advance + posted-at formatting math. This file remains so
 * existing imports keep working.
 */
export {
  ECHO_SWIPE_NOISE_PX,
  boostHexColor,
  echoActionForSwipe,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  formatEchoPostedAt,
  nextEchoIndex,
  type EchoAction,
  type EchoItem,
  type EchoSwipeDirection,
} from '@app/aether-canvas-shared';

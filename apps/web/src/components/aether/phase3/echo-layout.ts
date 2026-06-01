/**
 * Echo card layout — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE456 so the Phase 4
 * native Echo feed scene consumes identical card stack math. This file
 * remains so existing imports keep working.
 */
export {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_SPACING_Y,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardVisible,
  echoCardY,
  visibleEchoSlots,
} from '@app/aether-canvas-shared';

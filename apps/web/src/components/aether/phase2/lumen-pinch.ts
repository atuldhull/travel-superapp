/**
 * Lumen pinch-zoom intent — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE478. Native pinch
 * gesture handlers can feed identical events into wheelToPinchIntent +
 * nextFocusForPinch. This file remains so existing imports keep
 * working.
 */
export {
  PINCH_DELTA_THRESHOLD,
  nearestPlaneToCenter,
  nextFocusForPinch,
  wheelToPinchIntent,
  type LumenPinchIntent,
  type LumenPinchWheelEvent,
} from '@app/aether-canvas-shared';

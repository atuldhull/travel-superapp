/**
 * Compass bearing math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE456 so the Phase 4
 * native Compass scene consumes identical bearings. This file remains
 * so existing imports keep working.
 */
export {
  CARDINALS,
  angularDistance,
  bearingPositionOnRing,
  bearingToVec3,
  cardinalAt,
  normalizeBearing,
  type CompassPosition,
} from '@app/aether-canvas-shared';

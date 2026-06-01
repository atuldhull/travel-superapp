/**
 * Genie particle dissolution math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE469 so the Phase 4
 * native particle overlay consumes identical seed + position math.
 * This file remains so existing imports keep working.
 */
export {
  GENIE_DISSOLVE_MS,
  GENIE_PARTICLE_BASE_RADIUS,
  GENIE_PARTICLE_COUNT,
  canvasDimensions,
  easeInOutCubic,
  particleAt,
  particleInitialPosition,
  particleRadius,
  particleRestOpacity,
  particleRestPosition,
} from '@app/aether-canvas-shared';

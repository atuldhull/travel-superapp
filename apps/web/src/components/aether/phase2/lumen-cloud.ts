/**
 * Lumen photo-cloud layout — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE456 so the Phase 4
 * native Lumen scene consumes identical world coordinates. This file
 * remains so existing imports keep working.
 */
export {
  DEFAULT_LUMEN_LAYOUT,
  clampRating,
  jitterZFor,
  layoutPhotoCloud,
  ratingToY,
  sortPhotosByTime,
  timeToX,
  type LumenLayoutConfig,
  type LumenPhotoLike,
  type LumenPlaneLayout,
} from '@app/aether-canvas-shared';

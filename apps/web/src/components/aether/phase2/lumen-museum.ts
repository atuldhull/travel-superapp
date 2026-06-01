/**
 * Lumen museum-mode arc layout — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE478 so the Phase 4
 * native Lumen scene focuses identical museum-arc positions. This file
 * remains so existing imports keep working.
 */
export {
  DEFAULT_MUSEUM_ARC,
  museumArcPositions,
  resolveMuseumTarget,
  type MuseumArcConfig,
} from '@app/aether-canvas-shared';

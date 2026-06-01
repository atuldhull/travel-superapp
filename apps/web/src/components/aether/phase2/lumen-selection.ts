/**
 * Lumen camera selection — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE478 so native Lumen
 * camera dolly + focus math matches the web. This file remains so
 * existing imports keep working.
 */
export {
  LUMEN_OVERVIEW_TARGET,
  cameraTargetForPhoto,
  planeOpacityForFocus,
  planeScaleForFocus,
  resolveLumenCameraTarget,
  type LumenCameraTarget,
} from '@app/aether-canvas-shared';

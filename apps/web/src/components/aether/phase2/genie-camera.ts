/**
 * Genie camera-mode helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE469 so the Phase 4
 * native camera surface consumes identical lifecycle labels + mode
 * toggling. This file remains so existing imports keep working.
 */
export {
  DEFAULT_CAMERA_FACING_MODE,
  DEFAULT_CAPTURE_QUALITY,
  DETECTION_PLACEHOLDER_LABEL,
  GENIE_CAPTURE_MODES,
  cameraStatusLabel,
  canCaptureStill,
  canStartCamera,
  captureModeDescription,
  captureModeGlyph,
  captureModeLabel,
  formatDetectionLabel,
  isCameraStreaming,
  type GenieCameraStatus,
  type GenieCaptureMode,
} from '@app/aether-canvas-shared';

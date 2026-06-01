/**
 * AE413 — pure helpers for the Genie camera-mode scaffold.
 *
 * Per docs/aether/02-surfaces.md §2 Genie: "or hold the camera. ML
 * Kit detects what you're looking at and tells you about it." AE413
 * ships the BROWSER-side camera capture today — the modal opens a
 * live `<video>` feed, you tap to grab a still, the dataURL is held
 * for the eventual `/v1/detect-objects` POST. ML-Kit detection +
 * the on-canvas "what is this" overlay land in later slices.
 *
 * Pure — no React, no DOM. The hook in `use-genie-camera.tsx` wraps
 * `navigator.mediaDevices.getUserMedia({video})` around these helpers.
 */

/** Which capture lane the genie modal is currently using. The modal's
 *  mode toggle writes to `useState<GenieCaptureMode>` so the chrome
 *  swaps cleanly between the mic + camera layouts. */
export type GenieCaptureMode = 'voice' | 'camera';

/** Camera pipeline lifecycle. Distinct from `GenieState` (AE406) and
 *  `GenieRecorderStatus` (AE411) so the modal can render each lane
 *  independently. */
export type GenieCameraStatus =
  | 'idle' // no camera asked for yet
  | 'requesting' // awaiting getUserMedia permission
  | 'streaming' // live preview running
  | 'captured' // still grabbed; preview frozen on the data URL
  | 'error'; // permission denied / no camera / OS error

/** Preferred facing mode for travel use. Rear-facing camera shows
 *  the world; the front-facing is the selfie cam. */
export const DEFAULT_CAMERA_FACING_MODE = 'environment' as const;

/** Capture quality for the JPEG data URL. 0.85 is the sweet spot for
 *  a recognisable still under ~150 kB. */
export const DEFAULT_CAPTURE_QUALITY = 0.85;

/** All known modes for the mode-toggle UI. */
export const GENIE_CAPTURE_MODES: ReadonlyArray<GenieCaptureMode> = Object.freeze([
  'voice',
  'camera',
]);

/** Label for the mode toggle (short — these become pill buttons). */
export function captureModeLabel(mode: GenieCaptureMode): string {
  switch (mode) {
    case 'voice':
      return 'Voice';
    case 'camera':
      return 'Camera';
  }
}

/** Glyph used inside the toggle pill. The text label is the
 *  primary affordance; the glyph is a hint. */
export function captureModeGlyph(mode: GenieCaptureMode): string {
  switch (mode) {
    case 'voice':
      return '🎤';
    case 'camera':
      return '📷';
  }
}

/** sr-friendly tooltip line. */
export function captureModeDescription(mode: GenieCaptureMode): string {
  switch (mode) {
    case 'voice':
      return 'Hold the mic to speak to Aether.';
    case 'camera':
      return 'Point the camera, tap to capture (ML Kit detection lands later).';
  }
}

/** Aria-live label for the camera pipeline. Mirrors `recorderStatusLabel`
 *  from AE411 so screen readers track the camera surface too. */
export function cameraStatusLabel(status: GenieCameraStatus): string {
  switch (status) {
    case 'idle':
      return 'Camera ready';
    case 'requesting':
      return 'Requesting camera permission';
    case 'streaming':
      return 'Camera live, ready to capture';
    case 'captured':
      return 'Still captured';
    case 'error':
      return 'Camera error';
  }
}

/** True when the camera surface should display the live `<video>`
 *  element (vs. a frozen still or the permission prompt). */
export function isCameraStreaming(status: GenieCameraStatus): boolean {
  return status === 'streaming';
}

/** True when capture should be allowed (live stream available). */
export function canCaptureStill(status: GenieCameraStatus): boolean {
  return status === 'streaming';
}

/** True when starting the pipeline is safe right now. */
export function canStartCamera(status: GenieCameraStatus): boolean {
  return status === 'idle' || status === 'captured' || status === 'error';
}

/** Pretty-print a detection label + confidence. Stub for now; the
 *  real ML-Kit response carries `{label, confidence: 0..1, bbox}`. */
export function formatDetectionLabel(label: string, confidence: number): string {
  if (!Number.isFinite(confidence)) return label;
  const pct = Math.max(0, Math.min(100, Math.round(confidence * 100)));
  return `${label} (${pct}%)`;
}

/** Detection-placeholder text the modal shows BEFORE ML-Kit ships.
 *  Honest copy + a fake "still" tag so the surface doesn't lie. */
export const DETECTION_PLACEHOLDER_LABEL = 'Recognising — ML Kit lands later';

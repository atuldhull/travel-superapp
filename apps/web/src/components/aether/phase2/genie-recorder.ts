/**
 * Genie MediaRecorder helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE469 so the Phase 4
 * native recorder consumes identical lifecycle labels + MIME picker
 * + duration formatter. This file remains so existing imports keep
 * working.
 */
export {
  MAX_RECORDING_MS,
  RECORDER_MIME_PREFERENCES,
  RECORDER_TICK_MS,
  canStartRecording,
  formatRecordingDuration,
  genieMimeExtension,
  isRecorderBusy,
  pickAudioMimeType,
  recorderStatusLabel,
  shouldAutoStop,
  type GenieRecorderStatus,
} from '@app/aether-canvas-shared';

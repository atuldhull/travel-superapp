/**
 * AE411 — pure helpers for the Genie MediaRecorder capture.
 *
 * Per docs/aether/02-surfaces.md §2 Genie the modal will eventually
 * stream live audio to ai-service's `/v1/transcribe` Whisper endpoint
 * (currently behind the optional `pip install .[stt]` extra). AE411
 * ships the BROWSER-side capture today — the modal records a real
 * audio blob via the MediaRecorder API + tracks duration — without
 * the STT round trip wired. AE411b/AE411c lift the blob into the
 * Whisper pipe once the server endpoint is mounted.
 *
 * Pure — no React, no DOM. The hook in `use-genie-recorder.tsx`
 * wraps `navigator.mediaDevices.getUserMedia` + `MediaRecorder`
 * around these helpers + an interval-based duration tracker.
 */

/** Recorder lifecycle states. Distinct from `GenieState` (AE406) —
 *  the genie modal's state machine drives the UI mood; this one
 *  reflects the underlying capture pipeline. */
export type GenieRecorderStatus =
  | 'idle' // nothing in progress
  | 'requesting' // awaiting getUserMedia permission
  | 'recording' // mic open + chunks streaming in
  | 'stopping' // stop() called, awaiting final dataavailable
  | 'stopped' // capture finished, blob available
  | 'error'; // permission denied / no supported codec / OS error

/** One-minute hard cap on a single utterance. Long enough for any
 *  natural travel prompt, short enough to keep blob size bounded
 *  for the Whisper round-trip. */
export const MAX_RECORDING_MS = 60_000;

/** Tick interval (ms) for the duration counter UI. 100 ms is fine
 *  resolution for "0:00 → 1:00" without thrashing React. */
export const RECORDER_TICK_MS = 100;

/** Ordered mime-type preferences for MediaRecorder. We pick the
 *  first one the browser accepts: opus in webm if possible (best
 *  bitrate / latency), generic webm next, then mp4 (Safari), then
 *  the bare audio/ogg as a fall-through. */
export const RECORDER_MIME_PREFERENCES: ReadonlyArray<string> = Object.freeze([
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]);

/** Pick the first preferred mime the predicate accepts. Returns
 *  `null` when no preference is supported (caller should error). */
export function pickAudioMimeType(
  isSupported: (mime: string) => boolean,
  preferences: ReadonlyArray<string> = RECORDER_MIME_PREFERENCES,
): string | null {
  for (const mime of preferences) {
    if (isSupported(mime)) return mime;
  }
  return null;
}

/** Format a duration as `M:SS`. Negative / NaN / Infinity all collapse
 *  to `0:00` so the UI never shows `NaN:NaN`. */
export function formatRecordingDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds < 10 ? `0${seconds}` : String(seconds);
  return `${minutes}:${ss}`;
}

/** True when the elapsed time has hit (or passed) the cap. The hook
 *  fires `stop()` as soon as this returns true. */
export function shouldAutoStop(elapsedMs: number, maxMs: number = MAX_RECORDING_MS): boolean {
  if (!Number.isFinite(elapsedMs)) return false;
  return elapsedMs >= maxMs;
}

/** Convert a recorder status into a sr-friendly announcer label.
 *  The genie modal's existing footer keeps "Phase 2 preview" honest;
 *  this label lives in an `aria-live=polite` line for screen readers. */
export function recorderStatusLabel(status: GenieRecorderStatus, durationMs: number = 0): string {
  switch (status) {
    case 'idle':
      return 'Microphone ready';
    case 'requesting':
      return 'Requesting microphone permission';
    case 'recording':
      return `Recording, ${formatRecordingDuration(durationMs)}`;
    case 'stopping':
      return 'Finalising recording';
    case 'stopped':
      return `Recorded ${formatRecordingDuration(durationMs)}`;
    case 'error':
      return 'Microphone error';
  }
}

/** True when a status reflects an "in progress" capture. The mic
 *  button's pulse animation uses this. */
export function isRecorderBusy(status: GenieRecorderStatus): boolean {
  return status === 'requesting' || status === 'recording' || status === 'stopping';
}

/** True when the recorder is in a state where a fresh start is safe.
 *  AE411 uses this to gate the mic press handler — re-pressing while
 *  the previous round-trip is still finishing should no-op. */
export function canStartRecording(status: GenieRecorderStatus): boolean {
  return status === 'idle' || status === 'stopped' || status === 'error';
}

/**
 * AE406 — pure state machine for the Genie voice / camera modal.
 *
 * Per docs/aether/02-surfaces.md §2 Genie: "Hold the Pulse. The current
 * surface dissolves into ~5000 particles that swirl into the lower
 * third. A waveform appears. You speak. The transcription writes
 * itself in real-time across the top." First cut (AE406) ships the
 * state machine + a static-image modal scaffold — real Whisper STT
 * streaming, the particle dissolution, and the typeset-in-3D
 * transcription land in later slices.
 *
 * Pure: no React, no DOM. The modal component reads these to decide
 * which copy + mic ring colour to render; the hook in
 * `use-genie-state.tsx` wraps a useState + the three transition fns.
 */

/** The five states Genie walks through. */
export type GenieState =
  | 'idle' // modal closed (or open + waiting for the user to press the mic)
  | 'listening' // mic active, waveform animating
  | 'processing' // STT in flight, AI thinking
  | 'transcribed' // transcript ready, awaiting the next action
  | 'error'; // mic permission denied / STT failed / network out

/** Headline rendered above the waveform per state. */
export function genieStateLabel(state: GenieState): string {
  switch (state) {
    case 'idle':
      return 'Hold to talk';
    case 'listening':
      return 'Listening…';
    case 'processing':
      return 'Reading your words…';
    case 'transcribed':
      return 'Got it.';
    case 'error':
      return 'Sorry — something interrupted.';
  }
}

/** ARIA label for the mic button. Reads as an action verb tied to
 *  what the press will do given the current state. */
export function genieMicAriaLabel(state: GenieState): string {
  switch (state) {
    case 'idle':
      return 'Press and hold to talk to Aether';
    case 'listening':
      return 'Release to send your voice prompt';
    case 'processing':
      return 'Processing your voice prompt';
    case 'transcribed':
      return 'Tap to talk again';
    case 'error':
      return 'Tap to retry voice prompt';
  }
}

/** Mic-ring tint per state. Returns a CSS-var fallback name so the
 *  component can compose `var(--aether-palette-accent, ${hex})`. */
export function genieMicRingColor(state: GenieState): string {
  switch (state) {
    case 'idle':
      return 'var(--aether-palette-accent, #C2614A)';
    case 'listening':
      // Brighter ochre signals "we're actively recording".
      return 'var(--aether-palette-glow, #E8B777)';
    case 'processing':
      return 'var(--aether-palette-support, #6E7B5C)';
    case 'transcribed':
      return 'var(--aether-palette-glow, #E8B777)';
    case 'error':
      return '#B0644A';
  }
}

/** True when the mic visual should animate (heartbeat / waveform). */
export function genieIsActive(state: GenieState): boolean {
  return state === 'listening' || state === 'processing';
}

/** Decide the next state when the mic button is pressed. */
export function genieOnMicPress(state: GenieState): GenieState {
  if (state === 'idle' || state === 'transcribed' || state === 'error') return 'listening';
  return state; // already listening / processing — no-op
}

/** Decide the next state when the mic button is released. */
export function genieOnMicRelease(state: GenieState): GenieState {
  if (state === 'listening') return 'processing';
  return state; // not listening — no-op
}

/** Mark STT complete (success path). */
export function genieOnStt(state: GenieState): GenieState {
  if (state === 'processing') return 'transcribed';
  return state;
}

/** Mark a permission / network error. Always transitions to error. */
export function genieOnError(state: GenieState): GenieState {
  return state === 'idle' ? 'idle' : 'error';
}

/** Close-the-modal reset path. */
export function genieReset(): GenieState {
  return 'idle';
}

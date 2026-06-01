'use client';

/**
 * AE406 — `<Phase2GenieModal>`.
 *
 * Scaffold for the voice / camera modal Genie (02-surfaces.md §2). The
 * full surface composes a GPU particle dissolution + streaming Whisper
 * STT + typeset-in-3D transcript; AE406 ships the modal chrome + state
 * machine so Pulse hold-to-talk has a destination to open into.
 *
 * Real STT (ai-service /v1/transcribe) + the particle dissolution land
 * in later slices. The mic button drives the pure AE406 state machine
 * via `useGenieState()` (in `use-genie-state.tsx`); the modal renders
 * state-keyed copy via `genieStateLabel(state)`.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  genieIsActive,
  genieMicAriaLabel,
  genieMicRingColor,
  genieOnMicPress,
  genieOnMicRelease,
  genieReset,
  genieStateLabel,
  type GenieState,
} from './genie-state';
import { canStartRecording, formatRecordingDuration, recorderStatusLabel } from './genie-recorder';
import { useGenieRecorder } from './use-genie-recorder';

export interface Phase2GenieModalProps {
  /** Whether the modal is mounted. The trigger toggles this externally. */
  readonly open?: boolean;
  /** Initial state on mount. Defaults to 'idle'. Storybook + tests
   *  pin this so the modal renders in any state without UI clicks. */
  readonly initialState?: GenieState;
  /** Optional transcript snippet shown when state === 'transcribed'. */
  readonly transcript?: string;
  /** Called when the user closes the modal. */
  readonly onClose?: () => void;
  /** Called whenever the state machine transitions. Useful for the
   *  AE407+ wiring (Pulse breath rate, audio bridge, etc.). */
  readonly onStateChange?: (next: GenieState) => void;
}

export function Phase2GenieModal({
  open = false,
  initialState = 'idle',
  transcript,
  onClose,
  onStateChange,
}: Phase2GenieModalProps): React.ReactElement | null {
  const [state, setState] = useState<GenieState>(initialState);
  // AE411 — real MediaRecorder capture. Mic press starts the capture;
  // release stops it. The resulting blob is held in the hook for the
  // AE411b STT round trip; the modal surfaces the duration counter.
  const recorder = useGenieRecorder();

  // Sync initialState on (re)open — tests can flip props.
  useEffect(() => {
    if (open) setState(initialState);
  }, [open, initialState]);

  // Esc closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        recorder.reset();
        setState(genieReset());
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [open, onClose, recorder]);

  const transition = useCallback(
    (fn: (s: GenieState) => GenieState) => {
      setState((prev) => {
        const next = fn(prev);
        if (next !== prev) onStateChange?.(next);
        return next;
      });
    },
    [onStateChange],
  );

  if (!open) return null;

  const ringColor = genieMicRingColor(state);
  const headline = genieStateLabel(state);
  const isActive = genieIsActive(state);

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 12, 8, 0.78)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    fontFamily: 'Inter, system-ui, sans-serif',
    color: 'var(--aether-palette-surface, #F2E8D5)',
  };

  const headlineStyle: CSSProperties = {
    fontSize: 24,
    letterSpacing: '0.02em',
    fontFamily: 'Playfair Display, Georgia, serif',
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 480,
    margin: 0,
  };

  const micButtonStyle: CSSProperties = {
    width: 108,
    height: 108,
    borderRadius: '50%',
    border: `3px solid ${ringColor}`,
    background: 'transparent',
    color: ringColor,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    transition: 'transform 220ms ease, box-shadow 220ms ease',
    boxShadow: isActive
      ? `0 0 36px ${ringColor}, inset 0 0 24px ${ringColor}`
      : `0 0 12px ${ringColor}`,
    transform: state === 'listening' ? 'scale(1.06)' : 'scale(1)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aether voice prompt"
      data-aether-genie-modal
      data-aether-genie-state={state}
      style={backdropStyle}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          transition(genieReset);
          onClose?.();
        }}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          border: 'none',
          background: 'transparent',
          color: 'var(--aether-palette-surface, #F2E8D5)',
          fontSize: 24,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
      <h2 data-aether-genie-headline style={headlineStyle}>
        {headline}
      </h2>
      <button
        type="button"
        data-aether-genie-mic
        aria-label={genieMicAriaLabel(state)}
        aria-pressed={state === 'listening'}
        style={micButtonStyle}
        onPointerDown={() => {
          transition(genieOnMicPress);
          if (canStartRecording(recorder.status)) void recorder.start();
        }}
        onPointerUp={() => {
          transition(genieOnMicRelease);
          recorder.stop();
        }}
        onPointerCancel={() => {
          transition(genieOnMicRelease);
          recorder.stop();
        }}
        onPointerLeave={() => {
          if (state === 'listening') {
            transition(genieOnMicRelease);
            recorder.stop();
          }
        }}
      >
        {state === 'listening' ? '◉' : '●'}
      </button>
      {/* AE411 — live duration counter while recording. */}
      {recorder.status === 'recording' && (
        <p
          data-aether-genie-duration
          aria-live="off"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14,
            letterSpacing: '0.08em',
            margin: 0,
            opacity: 0.8,
          }}
        >
          {formatRecordingDuration(recorder.durationMs)}
        </p>
      )}
      {/* AE411 — sr-only status line so screen readers track the capture. */}
      <span
        role="status"
        aria-live="polite"
        data-aether-genie-recorder-status
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {recorderStatusLabel(recorder.status, recorder.durationMs)}
      </span>
      {state === 'transcribed' && transcript !== undefined && transcript !== '' && (
        <p
          data-aether-genie-transcript
          style={{
            fontSize: 14,
            maxWidth: 520,
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            margin: 0,
            textAlign: 'center',
          }}
        >
          “{transcript}”
        </p>
      )}
      {/* AE411 — show capture stats once the user lifts the mic. The
          full Whisper round trip lands in AE411b; until then this is
          the honest acknowledgement that the audio was captured. */}
      {recorder.status === 'stopped' && recorder.blob !== null && (
        <p
          data-aether-genie-capture-summary
          style={{
            fontSize: 12,
            opacity: 0.8,
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.04em',
          }}
        >
          Captured {formatRecordingDuration(recorder.durationMs)} ·{' '}
          {Math.round(recorder.blob.size / 1024)} kB{' '}
          {recorder.mimeType !== null ? `· ${recorder.mimeType}` : ''} — STT lands later
        </p>
      )}
      {recorder.status === 'error' && recorder.error !== null && (
        <p
          data-aether-genie-recorder-error
          style={{
            fontSize: 12,
            color: '#E47A6B',
            margin: 0,
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          {recorder.error}
        </p>
      )}
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          opacity: 0.6,
          margin: 0,
        }}
      >
        Phase 2 preview · STT lands later
      </p>
    </div>
  );
}

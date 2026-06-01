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
import { GenieDissolveOverlay } from './genie-dissolve-overlay';
import { useGenieRecorder } from './use-genie-recorder';
import {
  DETECTION_PLACEHOLDER_LABEL,
  GENIE_CAPTURE_MODES,
  cameraStatusLabel,
  canCaptureStill,
  canStartCamera,
  captureModeDescription,
  captureModeGlyph,
  captureModeLabel,
  type GenieCaptureMode,
} from './genie-camera';
import { useGenieCamera } from './use-genie-camera';

export interface Phase2GenieModalProps {
  /** Whether the modal is mounted. The trigger toggles this externally. */
  readonly open?: boolean;
  /** Initial state on mount. Defaults to 'idle'. Storybook + tests
   *  pin this so the modal renders in any state without UI clicks. */
  readonly initialState?: GenieState;
  /** AE413 — initial capture mode. The toggle inside the modal lets
   *  the user switch at runtime; Storybook pins this. */
  readonly initialMode?: GenieCaptureMode;
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
  initialMode = 'voice',
  transcript,
  onClose,
  onStateChange,
}: Phase2GenieModalProps): React.ReactElement | null {
  const [state, setState] = useState<GenieState>(initialState);
  // AE412 — when `open` flips false we keep the modal mounted for the
  // duration of the dissolve animation, then unmount via `onClosed`.
  const [closing, setClosing] = useState<boolean>(false);
  // AE411 — real MediaRecorder capture. Mic press starts the capture;
  // release stops it. The resulting blob is held in the hook for the
  // AE411b STT round trip; the modal surfaces the duration counter.
  const recorder = useGenieRecorder();
  // AE413 — camera capture lane. Mode toggle picks between voice + camera.
  const camera = useGenieCamera();
  const [mode, setMode] = useState<GenieCaptureMode>(initialMode);

  // Sync initialState + mode on (re)open — tests can flip props.
  useEffect(() => {
    if (open) {
      setState(initialState);
      setMode(initialMode);
      setClosing(false);
    }
  }, [open, initialState, initialMode]);

  // AE413 — auto-start / auto-stop the camera with the mode toggle.
  // When the user flips to camera mode we ask for permission; when they
  // flip back the stream is released so the camera light goes off.
  useEffect(() => {
    if (!open || closing) return;
    if (mode === 'camera') {
      if (canStartCamera(camera.status)) void camera.start();
    } else {
      camera.stop();
    }
    // We intentionally omit `camera` from the deps array — the handle
    // is recreated on every render and would loop. The hook handles
    // its own internal state for re-entrant calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, closing]);

  // AE412 — request close: tell the parent immediately so it can flip
  // its mount flag, and kick the dissolve-out so the swarm scatters
  // before the modal actually disappears. The `closing` flag keeps the
  // modal mounted through the scatter even if the parent flips
  // `open` to false right away.
  const requestClose = useCallback((): void => {
    recorder.reset();
    camera.reset();
    setState(genieReset());
    setClosing(true);
    onClose?.();
  }, [camera, recorder, onClose]);

  // Esc closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

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

  // AE412 — render through the dissolve-out: keep mounted until the
  // overlay tells us the particle scatter is done.
  if (!open && !closing) return null;

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
      <GenieDissolveOverlay
        open={open && !closing}
        onClosed={() => {
          // The parent's onClose has already fired from requestClose.
          // This callback just clears the internal closing flag so
          // the modal unmounts itself once the dissolve is done.
          setClosing(false);
        }}
      />
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          border: 'none',
          background: 'transparent',
          color: 'var(--aether-palette-surface, #F2E8D5)',
          fontSize: 24,
          cursor: 'pointer',
          zIndex: 101,
        }}
      >
        ×
      </button>
      <h2 data-aether-genie-headline style={headlineStyle}>
        {mode === 'camera' ? 'Point and tap to capture' : headline}
      </h2>
      {mode === 'voice' && (
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
      )}
      {/* AE413 — camera mode: live video + capture button. The mic is
          hidden in this mode; the mode toggle below switches lanes. */}
      {mode === 'camera' && (
        <div
          data-aether-genie-camera
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            maxWidth: 560,
          }}
        >
          {camera.capturedDataUrl === null ? (
            <video
              ref={camera.videoRef}
              autoPlay
              muted
              playsInline
              data-aether-genie-camera-feed
              style={{
                width: 'min(80vw, 480px)',
                aspectRatio: '4 / 3',
                background: 'rgba(0,0,0,0.6)',
                borderRadius: 18,
                border: '2px solid var(--aether-palette-glow, #E8B777)',
                objectFit: 'cover',
              }}
            />
          ) : (
            // Frozen still preview after capture.
            <img
              src={camera.capturedDataUrl}
              alt="Captured still"
              data-aether-genie-camera-still
              style={{
                width: 'min(80vw, 480px)',
                aspectRatio: '4 / 3',
                borderRadius: 18,
                border: '2px solid var(--aether-palette-accent, #C2614A)',
                objectFit: 'cover',
              }}
            />
          )}
          <button
            type="button"
            data-aether-genie-capture
            aria-label={camera.capturedDataUrl === null ? 'Capture still' : 'Capture another still'}
            disabled={camera.capturedDataUrl === null && !canCaptureStill(camera.status)}
            onClick={() => {
              if (camera.capturedDataUrl !== null) {
                // Restart the live feed for the next shot.
                void camera.start();
              } else {
                camera.capture();
              }
            }}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '3px solid var(--aether-palette-accent, #C2614A)',
              background: 'transparent',
              color: 'var(--aether-palette-surface, #F2E8D5)',
              cursor: 'pointer',
              fontSize: 22,
            }}
          >
            {camera.capturedDataUrl === null ? '◯' : '↺'}
          </button>
          {camera.capturedDataUrl !== null && (
            <p
              data-aether-genie-detection-placeholder
              style={{
                fontSize: 12,
                opacity: 0.7,
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              {DETECTION_PLACEHOLDER_LABEL}
            </p>
          )}
          {camera.status === 'error' && camera.error !== null && (
            <p
              data-aether-genie-camera-error
              style={{
                fontSize: 12,
                color: '#E47A6B',
                margin: 0,
                textAlign: 'center',
              }}
            >
              {camera.error}
            </p>
          )}
        </div>
      )}
      {/* AE411 — live duration counter while recording. */}
      {mode === 'voice' && recorder.status === 'recording' && (
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
      {mode === 'voice' && recorder.status === 'error' && recorder.error !== null && (
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
      {/* AE413 — sr-only status line for the camera lane. */}
      <span
        role="status"
        aria-live="polite"
        data-aether-genie-camera-status
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
        {cameraStatusLabel(camera.status)}
      </span>
      {/* AE413 — mode toggle: Voice / Camera pill bar. */}
      <nav
        data-aether-genie-mode-toggle
        aria-label="Genie capture mode"
        style={{
          display: 'flex',
          gap: 6,
          padding: 4,
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.06)',
          marginTop: 8,
        }}
      >
        {GENIE_CAPTURE_MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              aria-label={captureModeDescription(m)}
              title={captureModeDescription(m)}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--aether-palette-accent, #C2614A)' : 'transparent',
                color: active
                  ? 'var(--aether-palette-ink, #1A0F09)'
                  : 'var(--aether-palette-surface, #F2E8D5)',
                fontSize: 12,
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.04em',
              }}
            >
              {captureModeGlyph(m)} {captureModeLabel(m)}
            </button>
          );
        })}
      </nav>
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          opacity: 0.6,
          margin: 0,
        }}
      >
        Phase 2 preview · {mode === 'voice' ? 'STT' : 'ML Kit'} lands later
      </p>
    </div>
  );
}

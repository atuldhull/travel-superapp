'use client';

/**
 * AE411 — `useGenieRecorder()` hook.
 *
 * Wraps `navigator.mediaDevices.getUserMedia({audio: true})` +
 * `MediaRecorder` around the AE411 pure helpers. Returns a small
 * façade the Genie modal calls from its pointer handlers:
 *
 *   const recorder = useGenieRecorder();
 *   ...
 *   onPointerDown={() => { transition(genieOnMicPress); void recorder.start(); }}
 *   onPointerUp={() => { transition(genieOnMicRelease); recorder.stop(); }}
 *
 * The hook tracks duration via an interval, auto-stops at
 * MAX_RECORDING_MS, releases the underlying media tracks on stop /
 * unmount, and exposes the resulting blob + chosen mime type for
 * the eventual `/v1/transcribe` POST (AE411b).
 *
 * SSR / jsdom safety: feature-detects MediaRecorder + matchMedia
 * up-front so this can be imported at the module boundary without
 * blowing up the test runner.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_RECORDING_MS,
  RECORDER_TICK_MS,
  pickAudioMimeType,
  shouldAutoStop,
  type GenieRecorderStatus,
} from './genie-recorder';

export interface GenieRecorderHandle {
  readonly status: GenieRecorderStatus;
  readonly durationMs: number;
  readonly mimeType: string | null;
  readonly blob: Blob | null;
  readonly error: string | null;
  start(): Promise<void>;
  stop(): void;
  reset(): void;
}

/** True when the environment exposes the bits we need to capture
 *  audio. Strict-mode safe: returns the same boolean in SSR (false)
 *  and the browser. */
function detectSupport(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.MediaRecorder !== 'function') return false;
  const mediaDevices = window.navigator?.mediaDevices;
  if (mediaDevices === undefined) return false;
  if (typeof mediaDevices.getUserMedia !== 'function') return false;
  return true;
}

export function useGenieRecorder(): GenieRecorderHandle {
  const [status, setStatus] = useState<GenieRecorderStatus>('idle');
  const [durationMs, setDurationMs] = useState<number>(0);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickIdRef = useRef<number | null>(null);

  const clearTick = useCallback(() => {
    if (tickIdRef.current !== null) {
      window.clearInterval(tickIdRef.current);
      tickIdRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current !== null) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec === null) return;
    if (rec.state === 'inactive') return;
    setStatus('stopping');
    try {
      rec.stop();
    } catch {
      // Some browsers throw if called twice; safe to swallow.
    }
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (!detectSupport()) {
      setError('MediaRecorder unavailable in this browser');
      setStatus('error');
      return;
    }
    if (status === 'requesting' || status === 'recording' || status === 'stopping') return;
    setError(null);
    setBlob(null);
    setDurationMs(0);
    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Microphone permission denied';
      setError(msg);
      setStatus('error');
      return;
    }
    streamRef.current = stream;
    const mime = pickAudioMimeType((m) => {
      try {
        // Static class method on MediaRecorder; guarded above by detect.
        return window.MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });
    setMimeType(mime);
    let rec: MediaRecorder;
    try {
      rec =
        mime === null ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType: mime });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create recorder';
      releaseStream();
      setError(msg);
      setStatus('error');
      return;
    }
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (ev: BlobEvent): void => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = (): void => {
      const final = new Blob(chunksRef.current, {
        type: mime ?? chunksRef.current[0]?.type ?? 'audio/webm',
      });
      setBlob(final);
      setStatus('stopped');
      clearTick();
      releaseStream();
      recorderRef.current = null;
    };
    rec.onerror = (): void => {
      setError('Recorder error');
      setStatus('error');
      clearTick();
      releaseStream();
      recorderRef.current = null;
    };
    startedAtRef.current = Date.now();
    try {
      rec.start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start recorder';
      releaseStream();
      setError(msg);
      setStatus('error');
      return;
    }
    setStatus('recording');
    clearTick();
    tickIdRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);
      if (shouldAutoStop(elapsed, MAX_RECORDING_MS)) {
        stop();
      }
    }, RECORDER_TICK_MS);
  }, [clearTick, releaseStream, status, stop]);

  const reset = useCallback(() => {
    stop();
    clearTick();
    releaseStream();
    chunksRef.current = [];
    setBlob(null);
    setError(null);
    setDurationMs(0);
    setStatus('idle');
  }, [clearTick, releaseStream, stop]);

  // Cleanup on unmount — never leak the mic stream past the modal close.
  useEffect(() => {
    return (): void => {
      clearTick();
      releaseStream();
      const rec = recorderRef.current;
      if (rec !== null && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          // best-effort
        }
      }
      recorderRef.current = null;
    };
  }, [clearTick, releaseStream]);

  return { status, durationMs, mimeType, blob, error, start, stop, reset };
}

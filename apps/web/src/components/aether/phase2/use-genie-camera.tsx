'use client';

/**
 * AE413 — `useGenieCamera()` hook.
 *
 * Wraps `navigator.mediaDevices.getUserMedia({video: {...}})` around
 * the AE413 pure helpers. Returns a small façade the modal calls when
 * the user flips to camera mode:
 *
 *   const cam = useGenieCamera();
 *   useEffect(() => { if (mode === 'camera') void cam.start(); else cam.stop(); }, [mode]);
 *
 * The hook owns a single `<video>` element by ref + a hidden canvas
 * for the still capture. The video tag is rendered in the modal's
 * JSX (caller controls layout); the hook just attaches `srcObject`
 * when the stream lands.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CAMERA_FACING_MODE,
  DEFAULT_CAPTURE_QUALITY,
  type GenieCameraStatus,
} from './genie-camera';

export interface GenieCameraHandle {
  readonly status: GenieCameraStatus;
  readonly stream: MediaStream | null;
  readonly capturedDataUrl: string | null;
  readonly error: string | null;
  /** Ref to attach to a `<video>` element. The hook writes its
   *  `srcObject` when the stream arrives. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start(): Promise<void>;
  stop(): void;
  capture(): void;
  reset(): void;
}

function detectSupport(): boolean {
  if (typeof window === 'undefined') return false;
  const md = window.navigator?.mediaDevices;
  if (md === undefined) return false;
  if (typeof md.getUserMedia !== 'function') return false;
  return true;
}

export function useGenieCamera(): GenieCameraHandle {
  const [status, setStatus] = useState<GenieCameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseStream = useCallback(() => {
    if (streamRef.current !== null) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    releaseStream();
    if (status === 'streaming') setStatus('idle');
  }, [releaseStream, status]);

  const start = useCallback(async (): Promise<void> => {
    if (!detectSupport()) {
      setError('Camera unavailable in this browser');
      setStatus('error');
      return;
    }
    if (status === 'requesting' || status === 'streaming') return;
    setError(null);
    setCapturedDataUrl(null);
    setStatus('requesting');
    let media: MediaStream;
    try {
      media = await window.navigator.mediaDevices.getUserMedia({
        video: { facingMode: DEFAULT_CAMERA_FACING_MODE },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera permission denied';
      setError(msg);
      setStatus('error');
      return;
    }
    streamRef.current = media;
    setStream(media);
    if (videoRef.current !== null) {
      videoRef.current.srcObject = media;
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay block — the browser will resume on user gesture.
      }
    }
    setStatus('streaming');
  }, [status]);

  const capture = useCallback((): void => {
    const video = videoRef.current;
    if (video === null) return;
    if (status !== 'streaming') return;
    if (typeof document === 'undefined') return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w <= 0 || h <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.drawImage(video, 0, 0, w, h);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', DEFAULT_CAPTURE_QUALITY);
      setCapturedDataUrl(dataUrl);
      setStatus('captured');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to capture still';
      setError(msg);
      setStatus('error');
    }
  }, [status]);

  const reset = useCallback(() => {
    releaseStream();
    setCapturedDataUrl(null);
    setError(null);
    setStatus('idle');
  }, [releaseStream]);

  // Unmount safety — never leak the camera stream.
  useEffect(() => {
    return (): void => {
      if (streamRef.current !== null) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, []);

  return {
    status,
    stream,
    capturedDataUrl,
    error,
    videoRef,
    start,
    stop,
    capture,
    reset,
  };
}

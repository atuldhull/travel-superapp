'use client';

/**
 * useVoiceInput — wraps the Web Speech API (SpeechRecognition / webkit
 * prefix) for Pulse's freeform field.
 *
 * The API ships in Chromium-family browsers (Chrome, Edge, Opera, Brave,
 * Arc) and on iOS Safari 14.5+. Firefox lacks it; the hook reports
 * `supported: false` and the mic button hides.
 *
 * Behaviour:
 *   • start() — kicks off a single recognition pass; interim results
 *     stream via onInterim(text). The final transcript fires onFinal(text).
 *   • stop()  — manual end. Some browsers auto-stop after silence; the
 *     hook still ends the listening state.
 *   • lang locked to en-IN. Phase 1 can add a settings flip for hi-IN /
 *     ta-IN / etc.
 *
 * The API is event-based, so we keep the recognition instance in a ref
 * and recreate it per start() — re-using a stale instance after stop()
 * is unreliable on Safari.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// SpeechRecognition isn't in standard TS lib defs — declare the
// subset we use. We never construct it server-side; window guards
// keep SSR safe.
interface SRResult {
  readonly transcript: string;
}
interface SRResultListItem {
  readonly 0: SRResult;
  readonly isFinal: boolean;
  readonly length: number;
}
interface SRResultList {
  readonly length: number;
  readonly [index: number]: SRResultListItem;
}
interface SREvent {
  readonly resultIndex: number;
  readonly results: SRResultList;
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SRConstructor {
  new (): SRInstance;
}

function getCtor(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SRConstructor | null;
}

export interface UseVoiceInputOpts {
  readonly lang?: string;
  /** Stream interim transcripts as the user speaks. */
  readonly onInterim?: (text: string) => void;
  /** Fired once at end with the final transcript. */
  readonly onFinal?: (text: string) => void;
}

export interface UseVoiceInputResult {
  readonly supported: boolean;
  readonly listening: boolean;
  readonly error: string | null;
  readonly start: () => void;
  readonly stop: () => void;
}

export function useVoiceInput(opts?: UseVoiceInputOpts): UseVoiceInputResult {
  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SRInstance | null>(null);
  const ctorRef = useRef<SRConstructor | null>(null);

  useEffect(() => {
    const ctor = getCtor();
    ctorRef.current = ctor;
    setSupported(ctor !== null);
    return () => {
      if (ref.current !== null) {
        try {
          ref.current.abort();
        } catch {
          /* ignore — already torn down */
        }
        ref.current = null;
      }
    };
  }, []);

  const start = useCallback((): void => {
    if (ctorRef.current === null) return;
    if (ref.current !== null) {
      // Already running — stop the prior session first.
      try {
        ref.current.abort();
      } catch {
        /* ignore */
      }
      ref.current = null;
    }
    setError(null);
    const inst = new ctorRef.current();
    inst.lang = opts?.lang ?? 'en-IN';
    inst.interimResults = true;
    inst.continuous = false;
    inst.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r === undefined) continue;
        const text = r[0].transcript;
        if (r.isFinal) final += text;
        else interim += text;
      }
      if (final !== '') opts?.onFinal?.(final);
      else if (interim !== '') opts?.onInterim?.(interim);
    };
    inst.onerror = (e) => {
      setError(typeof e.error === 'string' ? e.error : 'voice unavailable');
      setListening(false);
      ref.current = null;
    };
    inst.onend = () => {
      setListening(false);
      ref.current = null;
    };
    ref.current = inst;
    try {
      inst.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'voice failed to start');
      setListening(false);
      ref.current = null;
    }
  }, [opts]);

  const stop = useCallback((): void => {
    if (ref.current === null) return;
    try {
      ref.current.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}

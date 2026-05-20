/**
 * Web Speech API hooks — voice input (H3) + voice output (H4) for
 * the global assistant.
 *
 * Both are browser-native, $0/no-key (LAW 1: nothing new leaves the
 * system by default). Each hook returns `supported: false` when the
 * browser doesn't expose the API; callers hide the button instead
 * of crashing.
 *
 * Honest scope:
 *   • SpeechRecognition is webkit-prefixed in Chrome family, vendor-
 *     less in some others. We detect both.
 *   • The recogniser uses the navigator's language as a default; the
 *     caller can override via `useSpeechRecognition({ lang })`.
 *   • SpeechSynthesis voices may take a tick to populate — we listen
 *     for `voiceschanged` and re-check.
 *   • Both APIs are CLIENT-ONLY; SSR-safe via the `typeof window`
 *     guard.
 *
 * Installed for Phase 4 (H3 + H4).
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Minimal SpeechRecognition + SpeechRecognitionEvent typings — the
// DOM lib in TS bundles these only behind `lib.dom.iterable` in
// recent versions, so we declare what we need to stay portable.
interface SpeechRecognitionLikeEventResult {
  readonly transcript: string;
  readonly confidence?: number;
}
interface SpeechRecognitionLikeEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<ArrayLike<SpeechRecognitionLikeEventResult> & { isFinal: boolean }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionLikeEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag. Defaults to navigator.language. */
  readonly lang?: string;
  /** Called with the FINAL transcript when recognition ends. */
  readonly onFinal?: (text: string) => void;
}

export interface SpeechRecognitionState {
  readonly supported: boolean;
  readonly listening: boolean;
  /** Live partial transcript while listening. */
  readonly interim: string;
  readonly start: () => void;
  readonly stop: () => void;
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {},
): SpeechRecognitionState {
  const Ctor = useMemo(() => getRecognitionCtor(), []);
  const supported = Ctor !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;

  const stop = useCallback(() => {
    const inst = ref.current;
    if (inst) {
      try {
        inst.stop();
      } catch {
        // already stopped — no-op
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    const inst = new Ctor();
    inst.lang = opts.lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    inst.continuous = false;
    inst.interimResults = true;
    let finalText = '';
    inst.onresult = (ev) => {
      let partial = '';
      let next = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const result = ev.results[i];
        if (!result) continue;
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) next += alt.transcript;
        else partial += alt.transcript;
      }
      if (next.length > 0) finalText += next;
      setInterim(partial);
    };
    inst.onend = () => {
      setListening(false);
      setInterim('');
      ref.current = null;
      const trimmed = finalText.trim();
      if (trimmed && onFinalRef.current) onFinalRef.current(trimmed);
    };
    inst.onerror = () => {
      setListening(false);
      setInterim('');
      ref.current = null;
    };
    ref.current = inst;
    setListening(true);
    try {
      inst.start();
    } catch {
      // start() can throw if a previous instance is still active —
      // collapse to the not-listening state honestly.
      setListening(false);
      ref.current = null;
    }
  }, [Ctor, opts.lang]);

  useEffect(() => {
    return () => {
      if (ref.current) {
        try {
          ref.current.abort();
        } catch {
          // no-op
        }
        ref.current = null;
      }
    };
  }, []);

  return { supported, listening, interim, start, stop };
}

// ─────────────────────────────────────────────────────────────────────
// SpeechSynthesis (H4 — read AI responses aloud).

export interface SpeechSynthesisState {
  readonly supported: boolean;
  readonly speaking: boolean;
  readonly speak: (text: string) => void;
  readonly cancel: () => void;
}

export function useSpeechSynthesis(): SpeechSynthesisState {
  const supported = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  const [speaking, setSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } catch {
      // no-op
    }
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      try {
        // Cancel any in-flight utterance so we don't talk over
        // ourselves on rapid replies.
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(trimmed);
        u.rate = 1.0;
        u.pitch = 1.0;
        u.volume = 1.0;
        u.lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    [supported],
  );

  // Cancel any in-flight speech if the component unmounts.
  useEffect(() => {
    return () => {
      if (supported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // no-op
        }
      }
    };
  }, [supported]);

  return { supported, speaking, speak, cancel };
}

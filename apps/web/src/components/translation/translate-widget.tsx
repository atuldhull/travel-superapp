/**
 * V.UX.18 — floating translate widget. Persistent bottom-left
 * (the SOS FAB owns bottom-right). Opens a small panel with a
 * textarea + target-language select; calls the translation
 * surface via the typed SDK hook. Anonymous callers see the
 * button but tapping it does nothing — the api requires auth.
 *
 *   - Default target language is English; users pick from a short
 *     curated list (en/es/fr/de/it/ja/zh/hi/th/pt).
 *   - "Paste from clipboard" hydrates the textarea from
 *     `navigator.clipboard.readText()` when the API is available.
 *   - Result is read-only with a "Copy" button.
 *
 * Installed by prompt [V.UX.18].
 */
'use client';

import { useState } from 'react';
import {
  useTranslationControllerTranslate,
  type TranslateTextRequestDto,
  type TranslationDto,
} from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const TARGET_LANGS: readonly { code: string; label: string }[] = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'pt', label: '🇵🇹 Portuguese' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'th', label: '🇹🇭 Thai' },
];

export function TranslateWidget() {
  const token = useAuthToken();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('en');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationDto | null>(null);
  const [copied, setCopied] = useState(false);

  const translateMutation = useTranslationControllerTranslate({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as TranslationDto | undefined;
        setResult(body ?? null);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Translate failed.'}`,
        );
        setResult(null);
      },
    },
  });

  async function pasteFromClipboard() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.length > 0) setText(clip);
    } catch {
      // user denied — no-op
    }
  }

  async function copyResult() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function submit() {
    setErrorMsg(null);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setErrorMsg('Type or paste some text first.');
      return;
    }
    const data: TranslateTextRequestDto = { text: trimmed, targetLang: target };
    translateMutation.mutate({ data });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (token === null) return;
          setOpen((o) => !o);
        }}
        disabled={token === null}
        aria-label={token === null ? 'Sign in to translate' : 'Open translate widget'}
        title={token === null ? 'Sign in to translate' : 'Translate'}
        className={[
          'fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg transition focus:outline-none focus:ring-4',
          token === null
            ? 'bg-brand/40 text-white/70 cursor-not-allowed'
            : 'bg-brand text-brand-foreground hover:opacity-90 focus:ring-brand/40 active:scale-95',
        ].join(' ')}
      >
        <span aria-hidden="true">🌐</span>
        Translate
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="translate-widget-title"
          className="fixed bottom-20 left-4 z-50 w-[min(92vw,360px)] rounded-lg border border-muted/30 bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="translate-widget-title" className="text-sm font-bold">
              🌐 Translate
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-0.5 text-xs hover:bg-muted/10"
              aria-label="Close translate widget"
            >
              ✕
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={10_000}
            placeholder="Type or paste text…"
            className="w-full rounded-md border border-muted/30 bg-transparent px-2 py-1 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="rounded-md border border-muted/30 px-2 py-1 text-[11px] hover:bg-muted/10"
            >
              📋 Paste
            </button>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="flex-1 rounded-md border border-muted/30 bg-transparent px-2 py-1 text-xs"
              aria-label="Target language"
            >
              {TARGET_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  → {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={translateMutation.isPending}
              className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {translateMutation.isPending ? '…' : 'Go'}
            </button>
          </div>
          {errorMsg ? (
            <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-2 py-1 text-[11px] text-danger">
              {errorMsg}
            </p>
          ) : null}
          {result ? (
            <div className="mt-2 rounded-md border border-brand/20 bg-brand/5 p-2 text-sm">
              <p className="leading-relaxed">{result.translatedText}</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                <span>
                  {result.provider} · {result.targetLang}
                </span>
                <button
                  type="button"
                  onClick={copyResult}
                  className="rounded px-1.5 py-0.5 hover:bg-muted/10"
                >
                  {copied ? '✓ Copied' : '🔗 Copy'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

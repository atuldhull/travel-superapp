/**
 * V.UX.18 — translation result. v1 is a one-shot text translation;
 * a future slice may add caching + per-trip translation history.
 *
 * `provider` identifies the underlying translator (e.g. `'stub'`,
 * `'google'`, `'deepl'`). v1 ships only the stub; real adapters
 * land via the same port without touching the use-case.
 *
 * Installed by prompt [V.UX.18].
 */
export interface Translation {
  readonly sourceText: string;
  readonly translatedText: string;
  /**
   * BCP-47 source language tag. `null` when the caller didn't
   * provide one and the provider auto-detected.
   */
  readonly sourceLang: string | null;
  /** BCP-47 target language tag. */
  readonly targetLang: string;
  readonly provider: string;
}

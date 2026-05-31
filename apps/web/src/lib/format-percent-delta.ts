/**
 * AE303 — pure delta-percent formatter (signed + arrow glyph).
 *
 * Used by /aether/dispatch ops tiles + future analytics surfaces:
 *   formatPercentDelta(0.15)  → '↑ 15%'
 *   formatPercentDelta(-0.04) → '↓ 4%'
 *   formatPercentDelta(0)     → '· 0%'
 *
 * NaN / non-finite → '—'. Uses up/down arrows for screen-reader-
 * friendly distinction (arrow + sign word, not colour alone).
 */

export interface FormatPercentDeltaOptions {
  readonly decimals?: number;
}

export function formatPercentDelta(fraction: number, opts: FormatPercentDeltaOptions = {}): string {
  if (!Number.isFinite(fraction)) return '—';
  const digits = opts.decimals ?? 0;
  const abs = Math.abs(fraction) * 100;
  const pct = `${abs.toFixed(digits)}%`;
  if (fraction > 0) return `↑ ${pct}`;
  if (fraction < 0) return `↓ ${pct}`;
  return `· ${pct}`;
}

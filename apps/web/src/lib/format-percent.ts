/**
 * AE289 — pure 0..1 → "<n>%" formatter.
 *
 * Used by progress pills (AE226 checklist progress), share view
 * meters, and the AE189 copy-feedback subhead. Rounds to whole
 * percent by default; opts.decimals to keep precision. Clamps
 * input to [0,1].
 *
 * NaN / non-finite input → '—'.
 */
import { clamp01 } from './clamp';

export interface FormatPercentOptions {
  readonly decimals?: number;
}

export function formatPercent(fraction: number, opts: FormatPercentOptions = {}): string {
  if (!Number.isFinite(fraction)) return '—';
  // AE344 — clamp01 (was inline Math.max/Math.min). Behaviour identical.
  const clamped = clamp01(fraction);
  const n = clamped * 100;
  const digits = opts.decimals ?? 0;
  return `${n.toFixed(digits)}%`;
}

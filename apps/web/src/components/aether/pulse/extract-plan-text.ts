/**
 * AE213 — defensive unwrap of the sample-plan response payload.
 *
 * pulse.tsx used to cast the orval-generated response and read
 * `d?.plan` as `unknown`, then narrow via `typeof === 'string'`.
 * The pattern is correct but easy to mis-copy at a new call site.
 * This helper canonicalises:
 *
 *   - missing data (null / undefined) → ''
 *   - non-object payload → ''
 *   - data.plan is not a string → ''
 *   - data.plan is a string → that string (untrimmed, intentional —
 *     planner may emit leading whitespace meaningfully)
 *
 * The caller decides what to do with '' (the existing "Couldn't
 * sketch this one" fallback in pulse.tsx).
 */

export interface SamplePlanResponseLike {
  readonly data?: unknown;
}

export function extractPlanText(res: unknown): string {
  if (res === null || res === undefined) return '';
  if (typeof res !== 'object') return '';
  const data = (res as { data?: unknown }).data;
  if (data === null || data === undefined) return '';
  if (typeof data !== 'object') return '';
  const plan = (data as { plan?: unknown }).plan;
  return typeof plan === 'string' ? plan : '';
}

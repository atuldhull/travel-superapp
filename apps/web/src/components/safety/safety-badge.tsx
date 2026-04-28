/**
 * V.UX.13 — colour-coded safety pill. Reads a 0..100 composite score
 * (same score the `/safety/score` endpoint returns) and paints a
 * green / yellow / red badge so a glance answers "is it safe?"
 *
 *   ≥ 70 → green
 *   ≥ 40 → amber
 *   <  40 → red
 *
 * Thresholds are deliberately conservative: the safety-first persona
 * wants a clear "no" on borderline areas rather than a permissive
 * green that sets up a false sense of security.
 *
 * Installed by prompt [V.UX.13].
 */
'use client';

export interface SafetyBadgeProps {
  readonly score: number;
  readonly grade?: string;
  readonly compact?: boolean;
}

export function SafetyBadge({ score, grade, compact }: SafetyBadgeProps) {
  const tier = scoreTier(score);
  const cls =
    tier === 'green'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300'
      : tier === 'amber'
        ? 'bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300'
        : 'bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300';
  const padding = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  const label = compact
    ? `${Math.round(score)}`
    : `Safety ${Math.round(score)}${grade ? ` · ${grade}` : ''}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${padding} ${cls}`}
      aria-label={`Safety score ${Math.round(score)} of 100, tier ${tier}`}
      title={`Safety ${Math.round(score)}/100${grade ? ` (${grade})` : ''}`}
    >
      <span aria-hidden="true">{tier === 'green' ? '🟢' : tier === 'amber' ? '🟡' : '🔴'}</span>
      {label}
    </span>
  );
}

export type SafetyTier = 'green' | 'amber' | 'red';

export function scoreTier(score: number): SafetyTier {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

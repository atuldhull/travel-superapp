/**
 * V.UX.25 — karma pill. Renders next to a displayName everywhere
 * the reviewer's reputation matters. Compact (`Atul · 240`) by
 * default; pass `withIcon` for the leaderboard variant.
 *
 * Caller passes the score directly so this component can be a
 * pure render — no fetch — and drop in next to any displayName
 * without prop drilling.
 *
 * Installed by prompt [V.UX.25].
 */
'use client';

import Link from 'next/link';

interface KarmaPillProps {
  readonly displayName: string;
  readonly score: number;
  /** Optional userId — when present the pill links to /users/:userId. */
  readonly userId?: string;
  /** Show ⭐ glyph in front of the score. Defaults to off (compact). */
  readonly withIcon?: boolean;
  readonly className?: string;
}

export function KarmaPill({ displayName, score, userId, withIcon, className }: KarmaPillProps) {
  const inner = (
    <span className={`inline-flex items-baseline gap-1 ${className ?? ''}`}>
      <span className="font-medium">{displayName}</span>
      <span
        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
        title={`${score} karma`}
      >
        {withIcon ? '⭐ ' : '· '}
        {score}
      </span>
    </span>
  );
  if (userId) {
    return (
      <Link href={`/users/${userId}`} className="hover:underline">
        {inner}
      </Link>
    );
  }
  return inner;
}

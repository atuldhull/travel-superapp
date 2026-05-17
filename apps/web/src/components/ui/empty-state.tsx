/**
 * POST.8 — Empty state. Replaces the bare "No items." paragraph
 * that lives on /trips, /featured, /admin/audit, /inbox, /memory-books
 * with a friendlier card: an emoji or icon, a headline, a subline,
 * and an optional CTA.
 *
 * Pure presentation — caller decides emoji + copy + CTA href.
 * Theme-aware via Tailwind utilities.
 *
 * Usage:
 *   <EmptyState
 *     emoji="🧳"
 *     title="No trips yet"
 *     body="Plan your first one — it takes about 30 seconds."
 *     cta={{ href: '/trips/new', label: 'New trip →' }}
 *   />
 */
import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Single emoji or short icon. Decorative — `aria-hidden`. */
  readonly emoji?: string;
  /** Override the emoji with custom JSX (e.g. an inline SVG). */
  readonly icon?: ReactNode;
  readonly title: string;
  readonly body?: string;
  readonly cta?: {
    readonly href: Route | (string & {});
    readonly label: string;
  };
}

export function EmptyState({ emoji, icon, title, body, cta }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gold-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-3xl leading-none shadow-(--shadow-depth-1)"
      >
        {icon ?? emoji ?? '✨'}
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
        {title}
      </h2>
      {body ? <p className="max-w-sm text-sm leading-relaxed text-muted">{body}</p> : null}
      {cta ? (
        <Link
          href={cta.href as never}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

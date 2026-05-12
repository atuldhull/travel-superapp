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
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-muted/30 bg-muted/5 px-6 py-10 text-center">
      <div aria-hidden className="text-3xl leading-none">
        {icon ?? emoji ?? '✨'}
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {cta ? (
        <Link
          href={cta.href as never}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

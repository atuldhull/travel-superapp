/**
 * Landing-page trust strip — premium royal rebuild to match the hero
 * + value pillars. Gold eyebrow, champagne-hairline tiles, Playfair
 * labels. Pure presentational; no runtime calls.
 *
 * Installed by [V.UX.40]; premium rebuild for the royal frontend pass.
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { FileCheck2, GitBranch, ShieldCheck } from 'lucide-react';

const ITEMS: ReadonlyArray<{
  label: string;
  detail: string;
  icon: typeof ShieldCheck;
  href?: string;
}> = [
  {
    label: 'GDPR-ready',
    detail: 'Right-to-erasure + full data export shipped.',
    icon: ShieldCheck,
    href: '/account/privacy',
  },
  {
    label: 'SOC2 — in progress',
    detail: 'Audit underway. See the accessibility statement for current posture.',
    icon: FileCheck2,
    href: '/accessibility',
  },
  {
    label: 'Open source',
    detail: 'Source on GitHub. Contributions welcome.',
    icon: GitBranch,
    href: 'https://github.com/anthropics/travel-superapp',
  },
];

export function TrustStrip(): ReactElement {
  return (
    <section
      aria-label="Trust signals"
      className="rounded-2xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1) sm:p-6"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gold-700 dark:text-gold-300">
        Why you can trust us
      </p>
      <ul className="grid gap-3.5 sm:grid-cols-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const inner = (
            <div className="flex h-full flex-col gap-1.5">
              <p className="inline-flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-surface-foreground">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-gold-500/25 bg-gold-500/8 text-gold-600">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                {it.label}
              </p>
              <p className="text-xs leading-relaxed text-muted">{it.detail}</p>
            </div>
          );
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href as never}
                  className="block h-full rounded-xl border border-gold-600/15 bg-surface p-4 transition hover:-translate-y-0.5 hover:border-gold-600/30 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  {...(it.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {inner}
                </Link>
              ) : (
                <div className="block h-full rounded-xl border border-gold-600/15 p-4">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

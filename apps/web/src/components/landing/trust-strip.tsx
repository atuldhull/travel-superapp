/**
 * V.UX.40 — landing-page trust strip. Three signals: GDPR-ready,
 * SOC2 in progress, open-source links. Pure presentational; no
 * runtime calls.
 */
import type { ReactElement } from 'react';
import Link from 'next/link';

const ITEMS: ReadonlyArray<{
  label: string;
  detail: string;
  icon: string;
  href?: string;
}> = [
  {
    label: 'GDPR-ready',
    detail: 'Right-to-erasure + full data export shipped.',
    icon: '🛡️',
    href: '/account/privacy',
  },
  {
    label: 'SOC2 — in progress',
    detail: 'Audit underway. See accessibility statement for current posture.',
    icon: '📋',
    href: '/accessibility',
  },
  {
    label: 'Open source',
    detail: 'Source on GitHub. Contributions welcome.',
    icon: '🔓',
    href: 'https://github.com/anthropics/travel-superapp',
  },
];

export function TrustStrip(): ReactElement {
  return (
    <section
      aria-label="Trust signals"
      className="rounded-lg border border-muted/15 bg-surface p-4"
    >
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">Why you can trust us</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {ITEMS.map((it) => {
          const inner = (
            <div className="flex h-full flex-col gap-1">
              <p className="text-sm font-semibold">
                <span aria-hidden>{it.icon}</span> {it.label}
              </p>
              <p className="text-xs text-muted">{it.detail}</p>
            </div>
          );
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href as never}
                  className="block h-full rounded-md border border-muted/15 p-3 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                  {...(it.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {inner}
                </Link>
              ) : (
                <div className="block h-full rounded-md border border-muted/15 p-3">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

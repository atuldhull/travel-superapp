/**
 * Three-pillar feature grid below the fold. Each pillar = an icon,
 * a one-line headline, a 1-2 sentence elaboration. Server Component
 * (no client interactivity).
 *
 * Installed by prompt [V.UX.1].
 */
import React from 'react';

interface Pillar {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly body: string;
}

const PILLARS: readonly Pillar[] = [
  {
    icon: <span aria-hidden>✨</span>,
    title: 'AI itineraries',
    body: 'Tell us where and how long. Get a paced day-by-day plan with real venues, food spots, and travel times — not a list of links.',
  },
  {
    icon: <span aria-hidden>🛡</span>,
    title: 'Live safety',
    body: 'Crowd-sourced scam reports, crime layer, weather alerts, and a one-tap SOS that pings your trusted contacts with live location.',
  },
  {
    icon: <span aria-hidden>👥</span>,
    title: 'Group planning',
    body: "Mint a share link, vote on places, split expenses, settle up. Collaborators don't need an account — recipients can read for free.",
  },
];

export function ValuePillars() {
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three things we do better</h2>
        <p className="mt-1 text-sm text-muted sm:text-base">
          The same problems every traveler hits — solved end-to-end, not patched together.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <li
            key={p.title}
            className="rounded-xl border border-muted/15 bg-background p-5 transition hover:border-brand/30"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-xl text-brand">
              {p.icon}
            </div>
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * POST.2 — value-pillars rewrite.
 *
 * Three-pillar feature grid below the hero. Each pillar:
 *   • brand-tinted icon plate (rounded square, depth-1 shadow)
 *   • 1-line headline (text-lg, font-semibold)
 *   • 2-line elaboration (text-sm, leading-relaxed, text-muted)
 *   • subtle hover lift (depth-1 → depth-2; brand-300 border)
 *
 * Server Component. Inline SVG icons (no library dependency).
 */
import type { ReactNode } from 'react';

interface Pillar {
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
      <path d="M19 14l.7 1.7L21 16.5l-1.3.6L19 19l-.7-1.7L17 16.5l1.3-.6L19 14z" />
      <path d="M5 16l.7 1.7L7 18l-1.3.6L5 20l-.7-1.7L3 18l1.3-.6L5 16z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

const PILLARS: readonly Pillar[] = [
  {
    icon: <SparkleIcon />,
    title: 'AI itineraries',
    body: 'Tell us where and how long. Get a paced day-by-day plan with real venues, food spots, and travel times — not a list of links.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Live safety',
    body: 'Crowd-sourced scam reports, crime layer, weather alerts, and a one-tap SOS that pings your trusted contacts with live location.',
  },
  {
    icon: <UsersIcon />,
    title: 'Group planning',
    body: "Mint a share link, vote on places, split expenses, settle up. Collaborators don't need an account — recipients can read for free.",
  },
];

export function ValuePillars() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three things we do better</h2>
        <p className="max-w-2xl text-sm text-muted sm:text-base">
          The same problems every traveler hits — solved end-to-end, not patched together with
          spreadsheets and 40 browser tabs.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <li
            key={p.title}
            className="group rounded-xl border border-muted/15 bg-surface p-5 shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-(--shadow-depth-2)"
          >
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:bg-brand/15">
              {p.icon}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

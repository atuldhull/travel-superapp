/**
 * Three-pillar feature grid below the hero. Premium "Cinematic
 * Editorial" rebuild to sit cohesively under the royal hero: gold
 * eyebrow, Playfair (`font-display`) heading, champagne icon plates,
 * gold-hairline cards with a depth-lift on hover.
 *
 * Server Component (no client runtime) — inline SVG icons, zero
 * library dependency, pure CSS motion so it stays SSR-safe.
 *
 * Installed by [POST.2]; premium rebuild for the royal frontend pass.
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
      strokeWidth="1.8"
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
      strokeWidth="1.8"
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
      strokeWidth="1.8"
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
    <section className="space-y-7">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-gold-600/25 bg-gold-500/8 px-3 py-1 text-xs font-medium tracking-wide text-gold-700 dark:text-gold-300">
          Why TravelSuperApp
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-surface-foreground sm:text-4xl">
          Three things we do better
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          The same problems every traveller hits — solved end-to-end, not patched together with
          spreadsheets and 40 browser tabs.
        </p>
      </header>
      <ul className="grid gap-5 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <li
            key={p.title}
            className="group relative overflow-hidden rounded-2xl border border-gold-600/15 bg-surface p-6 shadow-(--shadow-depth-1) transition duration-200 hover:-translate-y-1 hover:border-gold-600/30 hover:shadow-(--shadow-depth-3)"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gold-500/10 blur-2xl transition group-hover:bg-gold-500/20"
            />
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-600 shadow-(--shadow-depth-1) transition group-hover:bg-gold-500/15">
              {p.icon}
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
              {p.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

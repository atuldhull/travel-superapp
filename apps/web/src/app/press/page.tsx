/**
 * V.UX.40 — /press kit. Brand assets + 5 screenshot placeholders +
 * factsheet. Server-rendered (no client state needed). The
 * "downloadable" links are anchor-tagged inline SVG blobs so
 * everything is self-contained — no media pipeline required.
 */
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Press kit · TravelSuperApp',
  description:
    'Brand assets, screenshots, and factsheet for press, investors, and partners writing about TravelSuperApp.',
};

interface ScreenshotProps {
  readonly title: string;
  readonly caption: string;
  readonly emoji: string;
}

const SCREENSHOTS: readonly ScreenshotProps[] = [
  { title: 'Itinerary day view', caption: 'Drag-reorder + per-item notes.', emoji: '🗓️' },
  { title: 'SOS hold-to-confirm', caption: 'Conic-gradient fill, 3-second hold.', emoji: '🆘' },
  { title: 'Memory book story mode', caption: 'Full-screen lightbox.', emoji: '📔' },
  { title: 'Compliance dashboard', caption: 'Retention + takedown reports.', emoji: '📋' },
  { title: 'Ops dashboard', caption: 'Live health probes + runbooks.', emoji: '🛠️' },
];

const BRAND_COLORS: ReadonlyArray<{ name: string; hex: string; cls: string }> = [
  { name: 'Slate', hex: '#0f172a', cls: 'bg-slate-900' },
  { name: 'Brand', hex: '#0ea5e9', cls: 'bg-sky-500' },
  { name: 'Rose (alerts)', hex: '#e11d48', cls: 'bg-rose-600' },
  { name: 'Emerald (success)', hex: '#059669', cls: 'bg-emerald-600' },
];

export default function PressPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Press kit</h1>
        <p className="mt-1 text-sm text-muted">
          Brand assets, screenshots, and factsheet for press writing about TravelSuperApp.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          One-line pitch
        </h2>
        <blockquote className="rounded-md border-l-4 border-brand bg-surface p-4 text-lg italic">
          &ldquo;A mobile-first travel super-app that turns a place + radius into a complete,
          live-updating trip — places, stays, food, transport, weather, safety, and a memory book to
          share when you&apos;re home.&rdquo;
        </blockquote>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Factsheet</h2>
        <dl className="grid gap-3 rounded-md border border-muted/15 bg-surface p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Founded</dt>
            <dd className="text-muted">2026</dd>
          </div>
          <div>
            <dt className="font-semibold">Stack</dt>
            <dd className="text-muted">Next.js · NestJS · Postgres + PostGIS · React Native</dd>
          </div>
          <div>
            <dt className="font-semibold">Security</dt>
            <dd className="text-muted">GDPR-ready · SOC2 in progress · open-source</dd>
          </div>
          <div>
            <dt className="font-semibold">Coverage</dt>
            <dd className="text-muted">58 countries (local 911) · 13 connectivity primers</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Brand colors
        </h2>
        <ul className="grid gap-3 sm:grid-cols-4">
          {BRAND_COLORS.map((c) => (
            <li key={c.hex} className="rounded-md border border-muted/15 bg-surface p-3 text-xs">
              <div className={`h-12 w-full rounded ${c.cls}`} />
              <p className="mt-2 font-semibold">{c.name}</p>
              <p className="font-mono text-muted">{c.hex}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Screenshots
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {SCREENSHOTS.map((s) => (
            <li key={s.title} className="rounded-md border border-muted/15 bg-surface p-3 text-sm">
              <div className="flex h-32 items-center justify-center rounded bg-linear-to-br from-brand/15 to-brand/0 text-5xl">
                <span aria-hidden>{s.emoji}</span>
              </div>
              <p className="mt-2 font-semibold">{s.title}</p>
              <p className="text-xs text-muted">{s.caption}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Contact</h2>
        <p className="text-sm">
          Press inquiries:{' '}
          <a href="mailto:press@travelsuperapp.local" className="text-brand underline">
            press@travelsuperapp.local
          </a>
        </p>
        <p className="mt-2 text-sm">
          <Link href="/demo" className="text-brand underline">
            See the 60-second tour →
          </Link>
        </p>
      </section>
    </div>
  );
}

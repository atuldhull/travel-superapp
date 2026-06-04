/**
 * V.UX.40 — /press kit. Brand assets + 5 screenshot placeholders +
 * factsheet. Server-rendered (no client state needed). The
 * "downloadable" links are anchor-tagged inline SVG blobs so
 * everything is self-contained — no media pipeline required.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band, Card primitives).
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { Mail, Newspaper, Quote } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

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

const FACTSHEET: ReadonlyArray<{ term: string; detail: string }> = [
  { term: 'Founded', detail: '2026' },
  { term: 'Stack', detail: 'Next.js · NestJS · Postgres + PostGIS · React Native' },
  { term: 'Security', detail: 'GDPR-ready · SOC2 in progress · open-source' },
  { term: 'Coverage', detail: '58 countries (local 911) · 13 connectivity primers' },
];

export default function PressPage() {
  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Newspaper aria-hidden className="h-3.5 w-3.5" /> For the press
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Press kit
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Brand assets, screenshots, and factsheet for press, investors, and partners writing about
          TravelSuperApp.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote aria-hidden className="h-4 w-4 text-gold-600" /> One-line pitch
          </CardTitle>
        </CardHeader>
        <blockquote className="rounded-2xl border-l-4 border-gold-500 bg-gold-500/5 p-4 text-lg italic text-surface-foreground">
          &ldquo;A mobile-first travel super-app that turns a place + radius into a complete,
          live-updating trip — places, stays, food, transport, weather, safety, and a memory book to
          share when you&apos;re home.&rdquo;
        </blockquote>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Factsheet</CardTitle>
          <CardSubtitle>The numbers, at a glance.</CardSubtitle>
        </CardHeader>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {FACTSHEET.map((f) => (
            <div
              key={f.term}
              className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <dt className="font-display font-semibold text-surface-foreground">{f.term}</dt>
              <dd className="mt-0.5 text-muted">{f.detail}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Brand colors</CardTitle>
          <CardSubtitle>Copy a swatch hex straight into your deck.</CardSubtitle>
        </CardHeader>
        <ul className="grid gap-3 sm:grid-cols-4">
          {BRAND_COLORS.map((c) => (
            <li
              key={c.hex}
              className="rounded-2xl border border-gold-600/12 bg-surface p-3 text-xs shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className={`h-12 w-full rounded-xl ${c.cls}`} />
              <p className="mt-2 font-display font-semibold text-surface-foreground">{c.name}</p>
              <p className="font-mono text-muted">{c.hex}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
          <CardSubtitle>Five surfaces that show the product end to end.</CardSubtitle>
        </CardHeader>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {SCREENSHOTS.map((s) => (
            <li
              key={s.title}
              className="rounded-2xl border border-gold-600/12 bg-surface p-3 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className="flex h-32 items-center justify-center rounded-xl bg-linear-to-br from-gold-500/15 to-gold-500/0 text-5xl">
                <span aria-hidden>{s.emoji}</span>
              </div>
              <p className="mt-2 font-display font-semibold text-surface-foreground">{s.title}</p>
              <p className="text-xs text-muted">{s.caption}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardSubtitle>We answer press inquiries fast.</CardSubtitle>
        </CardHeader>
        <p className="text-sm text-surface-foreground">
          Press inquiries:{' '}
          <a
            href="mailto:press@travelsuperapp.local"
            className="inline-flex items-center gap-1 font-medium text-gold-700 underline-offset-2 transition hover:text-gold-600 hover:underline dark:text-gold-300"
          >
            <Mail aria-hidden className="h-3.5 w-3.5" /> press@travelsuperapp.local
          </a>
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/demo"
            className="font-medium text-gold-700 underline-offset-2 transition hover:text-gold-600 hover:underline dark:text-gold-300"
          >
            See the 60-second tour →
          </Link>
        </p>
      </Card>
    </main>
  );
}

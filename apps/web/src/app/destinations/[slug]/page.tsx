/**
 * /destinations/[slug] — long-form destination guide.
 *
 * Server component. Reads the curated destination from the shared data
 * file (the same dataset the landing + AI planner use), 404s on unknown
 * slug. Renders the editorial guide — hero, facts, lede, "moments worth
 * the journey", and suggested itineraries that deep-link into the AI
 * planner — in the v2 royal/gold design. generateStaticParams ships
 * every guide as static HTML.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Sparkles } from 'lucide-react';
import { ALL_SLUGS, DESTINATIONS } from '../../../components/aether/destinations/data';
import { V2Photo } from '../../../components/v2/photo';
import { Eyebrow } from '../../../components/v2/kit';

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = DESTINATIONS[slug];
  if (d === undefined) return { title: 'Destination not found · TravelSuperApp' };
  return { title: `${d.name} · TravelSuperApp`, description: d.tagline };
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const d = DESTINATIONS[slug];
  if (d === undefined) notFound();

  const planHref = `/trips/new?title=${encodeURIComponent(d.name)}` as const;

  return (
    <main className="space-y-10">
      <Link
        href="/destinations"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> All destinations
      </Link>

      {/* Hero */}
      <header className="relative isolate overflow-hidden rounded-3xl border border-gold-600/15 shadow-(--shadow-depth-2)">
        <V2Photo
          id={d.hero.id}
          alt={d.hero.alt}
          priority
          scrim
          rounded="rounded-3xl"
          width={1600}
          className="aspect-4/5 w-full sm:aspect-2/1"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <span className="inline-flex rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {d.state}
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {d.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{d.tagline}</p>
          <Link
            href={planHref as never}
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            style={{ backgroundImage: 'var(--gradient-gold)' }}
          >
            <Sparkles aria-hidden className="h-4 w-4" /> Plan this trip
          </Link>
        </div>
      </header>

      {/* Facts */}
      <ul className="grid gap-3 sm:grid-cols-3">
        {d.facts.map((f) => (
          <li
            key={f.label}
            className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1)"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</p>
            <p className="mt-1 font-display text-lg font-semibold tracking-tight text-surface-foreground">
              {f.value}
            </p>
          </li>
        ))}
      </ul>

      {/* Lede */}
      <div className="relative max-w-2xl border-l-2 border-gold-500/40 pl-5">
        <p className="text-lg leading-relaxed text-surface-foreground/90">{d.lede}</p>
      </div>

      {/* Moments */}
      <section className="space-y-6">
        <div className="space-y-2">
          <Eyebrow>Moments worth the journey</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-surface-foreground">
            What to do in {d.name}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {d.moments.map((m) => (
            <article
              key={m.title}
              className="overflow-hidden rounded-2xl border border-gold-600/12 bg-surface shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)"
            >
              <V2Photo
                id={m.photo.id}
                alt={m.photo.alt}
                rounded="rounded-none"
                className="aspect-16/9 w-full"
              />
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
                  {m.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{m.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Itineraries */}
      <section className="space-y-6">
        <div className="space-y-2">
          <Eyebrow>Suggested itineraries</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-surface-foreground">
            How long to stay
          </h2>
        </div>
        <ul className="space-y-3">
          {d.itineraries.map((it) => (
            <li
              key={it.name}
              className="flex flex-col gap-4 rounded-2xl border border-gold-600/12 bg-surface p-5 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2) sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold-600 dark:text-gold-400">
                  <CalendarDays aria-hidden className="h-3.5 w-3.5" /> {it.days} days
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-surface-foreground">
                  {it.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{it.lede}</p>
              </div>
              <Link
                href={planHref as never}
                className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-gold-600/30 px-4 py-2 text-sm font-semibold text-gold-700 transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5" /> Plan this
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA */}
      <section
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-10 text-center shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white">
          Ready for {d.name}?
        </h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-white/70">
          Get a full day-by-day itinerary, written by AI in seconds — then live re-planning while
          you travel.
        </p>
        <Link
          href={planHref as never}
          className="relative mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Sparkles aria-hidden className="h-4 w-4" /> Plan {d.name} with AI
        </Link>
      </section>
    </main>
  );
}

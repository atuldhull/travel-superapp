/**
 * /journal/[slug] — long-form article reader.
 *
 * Server component. Renders the body blocks (paragraph / pull-quote /
 * h2) in the v2 editorial style, plus two bridges that make the
 * editorial content actionable:
 *   • "Plan a trip like this" → the AI planner, seeded with the
 *     article's place (from its kicker).
 *   • "Places in this story" → links to the destination guides the
 *     article actually mentions.
 * Static-rendered for every known slug.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MapPin, Sparkles } from 'lucide-react';
import { ALL_JOURNAL_SLUGS, JOURNAL_ARTICLES } from '../../../components/aether/journal/data';
import { DESTINATIONS } from '../../../components/aether/destinations/data';
import { V2Photo } from '../../../components/v2/photo';

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_JOURNAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = JOURNAL_ARTICLES[slug];
  if (a === undefined) return { title: 'Story not found · TravelSuperApp' };
  return { title: `${a.title} · TravelSuperApp`, description: a.dek };
}

/** The place a story is set in — the part of the kicker after the "·". */
function placeFromKicker(kicker: string): string {
  const parts = kicker.split('·');
  return (parts[1] ?? parts[0] ?? '').trim();
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const a = JOURNAL_ARTICLES[slug];
  if (a === undefined) notFound();

  const place = placeFromKicker(a.kicker);
  const planHref = `/trips/new?title=${encodeURIComponent(place || a.title)}` as const;

  // Destinations this story actually mentions (by name) → guide links.
  const haystack = `${a.title} ${a.dek} ${a.body.map((b) => b.text).join(' ')}`.toLowerCase();
  const related = Object.values(DESTINATIONS).filter((d) =>
    haystack.includes(d.name.toLowerCase()),
  );

  return (
    <main className="space-y-8">
      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> The Journal
      </Link>

      {/* Masthead */}
      <header className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
          {a.kicker}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-surface-foreground sm:text-[2.6rem]">
          {a.title}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">{a.dek}</p>
        <p className="text-sm text-muted/80">
          {a.author} · {a.publishedOn} · {a.readMins} min read
        </p>
      </header>

      <V2Photo
        id={a.hero.id}
        alt={a.hero.alt}
        priority
        rounded="rounded-3xl"
        width={1600}
        className="aspect-16/10 w-full sm:aspect-2/1"
      />

      {/* Body */}
      <article className="mx-auto max-w-2xl space-y-5">
        {a.body.map((block, i) => {
          if (block.kind === 'h2') {
            return (
              <h2
                key={i}
                className="pt-3 font-display text-2xl font-semibold tracking-tight text-surface-foreground"
              >
                {block.text}
              </h2>
            );
          }
          if (block.kind === 'pull') {
            return (
              <blockquote
                key={i}
                className="border-l-2 border-gold-500/50 pl-5 font-display text-xl italic leading-relaxed text-surface-foreground"
              >
                {block.text}
              </blockquote>
            );
          }
          return (
            <p key={i} className="text-base leading-relaxed text-surface-foreground/90">
              {block.text}
            </p>
          );
        })}
      </article>

      {/* Places in this story */}
      {related.length > 0 ? (
        <section className="mx-auto max-w-2xl space-y-3 border-t border-gold-600/15 pt-6">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <MapPin aria-hidden className="h-3.5 w-3.5" /> Places in this story
          </p>
          <ul className="flex flex-wrap gap-2">
            {related.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/destinations/${d.slug}` as never}
                  className="inline-flex items-center rounded-full bg-gold-500/12 px-3.5 py-1.5 text-sm font-medium text-gold-700 ring-1 ring-inset ring-gold-500/30 transition hover:bg-gold-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Plan a trip like this */}
      <section
        className="relative isolate mx-auto max-w-2xl overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 text-center shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <h2 className="relative font-display text-2xl font-semibold tracking-tight text-white">
          A trip in the spirit of this story
        </h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-white/70">
          Let the AI draft a day-by-day itinerary{place ? ` around ${place}` : ''} — free, in
          seconds.
        </p>
        <Link
          href={planHref as never}
          className="relative mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Sparkles aria-hidden className="h-4 w-4" /> Plan a trip like this
        </Link>
      </section>
    </main>
  );
}

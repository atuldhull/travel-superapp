/**
 * /journal — "Stories", the long-form editorial magazine.
 *
 * Re-surfaces the aether journal capability in the new web (v2 design,
 * no aether dependency): a curated archive of hand-written travel
 * journalism. Reads the shared article data; newest piece is featured.
 * RSS + Atom feeds live at /journal/feed.xml and /journal/feed.atom.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { JOURNAL_ARTICLES } from '../../components/aether/journal/data';
import { V2Photo } from '../../components/v2/photo';

const TITLE = 'Stories · TravelSuperApp';
const DESC = 'Long-form notes from the road — field notes, craft stories, and pilgrim trails.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: {
    types: {
      'application/rss+xml': '/journal/feed.xml',
      'application/atom+xml': '/journal/feed.atom',
    },
  },
};

// Newest first (publishedOn is a friendly date string, e.g. "14 Aug 2026").
const ARTICLES = Object.values(JOURNAL_ARTICLES).sort(
  (a, b) => new Date(b.publishedOn).getTime() - new Date(a.publishedOn).getTime(),
);

export default function JournalIndexPage(): React.ReactElement {
  const [featured, ...rest] = ARTICLES;

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
            <BookOpenText aria-hidden className="h-3.5 w-3.5" /> Stories from the road
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            The Journal
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/65">
            Field notes, craft stories, and pilgrim trails — long-form travel writing worth the
            read.
          </p>
        </div>
      </header>

      {/* Featured */}
      {featured ? (
        <Link
          href={`/journal/${featured.slug}` as never}
          className="group relative block overflow-hidden rounded-3xl border border-gold-600/12 shadow-(--shadow-depth-2) transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <V2Photo
            id={featured.hero.id}
            alt={featured.hero.alt}
            scrim
            rounded="rounded-3xl"
            priority
            className="aspect-16/10 w-full transition duration-700 group-hover:scale-105 sm:aspect-2/1"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-200">
              {featured.kicker}
            </p>
            <h2 className="mt-1.5 max-w-2xl font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/75">{featured.dek}</p>
            <p className="mt-3 text-xs text-white/60">
              {featured.author} · {featured.readMins} min read
            </p>
          </div>
        </Link>
      ) : null}

      {/* The rest */}
      {rest.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {rest.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/journal/${a.slug}` as never}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold-600/12 bg-surface shadow-(--shadow-depth-1) transition hover:-translate-y-1 hover:border-gold-600/25 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <V2Photo
                  id={a.hero.id}
                  alt={a.hero.alt}
                  rounded="rounded-none"
                  className="aspect-16/9 w-full transition duration-500 group-hover:scale-105"
                />
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
                    {a.kicker}
                  </p>
                  <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug tracking-tight text-surface-foreground">
                    {a.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{a.dek}</p>
                  <p className="mt-3 text-xs text-muted/80">
                    {a.author} · {a.readMins} min read
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

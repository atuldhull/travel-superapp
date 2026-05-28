/**
 * /aether/journal/[slug] — journal article detail page.
 *
 * Server Component: env-gate + slug lookup + notFound() on miss.
 * Hands off to <JournalLazy> (Client wrapper, ssr:false) for the
 * actual article rendering. Pre-renders all 3 known slugs at build.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ALL_JOURNAL_SLUGS, JOURNAL_ARTICLES } from '@/components/aether/journal/data';
import { JournalLazy } from '@/components/aether/journal/journal-lazy';
import { aetherOg } from '@/lib/aether-og';

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
  if (a === undefined) return { title: 'Aether · Not found' };
  const title = `Aether journal · ${a.title}`;
  return {
    title,
    description: a.dek,
    robots: { index: false, follow: false },
    ...aetherOg(title, a.dek, { photoId: a.hero.id }),
  };
}

export default async function JournalRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  const { slug } = await params;
  const article = JOURNAL_ARTICLES[slug];
  if (article === undefined) notFound();
  return <JournalLazy article={article} />;
}

/**
 * /aether/destinations/[slug] — destination detail page.
 *
 * Server Component: reads the slug, looks up the destination from
 * the data file, calls notFound() if unknown or env-gate off.
 * Hands off to <DestinationLazy> (Client Component wrapper) which
 * does the ssr:false dynamic import — same pattern Drift uses, for
 * the same reason: motion / window / audio hooks need DOM.
 *
 * generateStaticParams pre-renders all 6 known destinations so they
 * ship as static HTML on the first request — fast first paint, no
 * blocking on a database (Phase 0 data is a TS literal).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ALL_SLUGS, DESTINATIONS } from '@/components/aether/destinations/data';
import { DestinationLazy } from '@/components/aether/destinations/destination-lazy';
import { aetherOg } from '@/lib/aether-og';

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
  if (d === undefined) {
    return { title: 'Aether · Not found' };
  }
  const title = `Aether · ${d.name}`;
  return {
    title,
    description: d.tagline,
    robots: { index: false, follow: false },
    ...aetherOg(title, d.tagline, { photoId: d.hero.id }),
  };
}

export default async function DestinationRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  const { slug } = await params;
  const destination = DESTINATIONS[slug];
  if (destination === undefined) {
    notFound();
  }
  return <DestinationLazy destination={destination} />;
}

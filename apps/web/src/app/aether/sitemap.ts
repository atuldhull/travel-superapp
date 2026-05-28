/**
 * /aether/sitemap.xml — section-specific sitemap for the Aether preview.
 *
 * Lists all Aether routes (8 static + 15 destinations + 6 journal
 * articles = 29 URLs). The main /sitemap.xml stays untouched; this
 * one is opt-in for crawlers that want to discover the Aether
 * surface specifically.
 *
 * Note: Aether routes still emit `robots: { index: false }` on every
 * page.tsx Phase 0. This sitemap is here so when Phase 1 flips the
 * gate, discovery is already wired — no migration cost at launch.
 *
 * Env-gated identical to the route pages — returns an empty sitemap
 * when the feature flag is off, so crawlers don't index a half-built
 * surface that's about to 404.
 */
import type { MetadataRoute } from 'next';
import { ALL_SLUGS } from '@/components/aether/destinations/data';
import { ALL_JOURNAL_SLUGS } from '@/components/aether/journal/data';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://travelsuperapp.local';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    return [];
  }

  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/aether/drift`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/aether/atlas`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/aether/destinations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/aether/journal`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/aether/about`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/aether/plan`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/aether/onboarding`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const destinationRoutes: MetadataRoute.Sitemap = ALL_SLUGS.map((slug) => ({
    url: `${SITE_URL}/aether/destinations/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const journalRoutes: MetadataRoute.Sitemap = ALL_JOURNAL_SLUGS.map((slug) => ({
    url: `${SITE_URL}/aether/journal/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...destinationRoutes, ...journalRoutes];
}

/**
 * V.UX.39 — robots.txt for crawlers. Allows the public surface,
 * disallows api + auth-gated routes (account, admin, compliance,
 * ops, agent, inbox, trips/me, etc.) so search engines don't
 * waste crawl budget on 401-walled pages.
 */
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travelsuperapp.local';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/featured', '/accessibility', '/memory-books/', '/shared/', '/users/'],
        disallow: [
          '/api/',
          '/account/',
          '/admin/',
          '/compliance/',
          '/ops/',
          '/agent/',
          '/inbox',
          '/onboarding',
          '/trips',
          '/auth/',
          '/login/reset/',
          '/login/forgot',
          '/login/mfa-recover',
          '/appeal',
          '/discover',
          '/near-me',
          '/connectivity/',
          '/eateries/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

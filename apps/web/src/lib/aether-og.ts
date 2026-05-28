/**
 * Shared Open Graph + Twitter Card builder for Aether routes.
 *
 * Every Aether `page.tsx` calls `aetherOg(...)` and spreads the result
 * into its Metadata object. Keeps the social cards consistent across
 * the whole surface without each route hand-rolling its own.
 *
 * Photo IDs are pulled from `apps/web/src/components/aether/photos.ts`
 * — same Unsplash IDs used in-page, sized 1200×630 for OG cards.
 *
 * robots stays `noindex` on every Aether route (Phase 0 preview).
 */
import type { Metadata } from 'next';

interface AetherOgOpts {
  /** Photo id (Unsplash) to use for the og:image. Defaults to the
   *  Aether hero photo. */
  readonly photoId?: string;
  /** Site path the card links back to. Used by both OG + Twitter. */
  readonly pathname?: string;
}

const DEFAULT_HERO_ID = '1564507592333-c60657eea523'; // Taj Mahal sunrise.

function ogImageUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1200&h=630&q=85`;
}

export function aetherOg(
  title: string,
  description: string,
  opts?: AetherOgOpts,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const photoId = opts?.photoId ?? DEFAULT_HERO_ID;
  const image = ogImageUrl(photoId);
  return {
    openGraph: {
      title,
      description,
      siteName: 'TravelSuperApp · Aether',
      type: 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

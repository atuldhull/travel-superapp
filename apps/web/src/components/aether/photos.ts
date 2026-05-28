/**
 * Phase 0 photography manifest — India edition.
 *
 * Curated Unsplash IDs of Indian travel scenes. The Warm Italian palette
 * (terracotta + ochre + olive + cream + espresso) translates without
 * change to the Indian context — Jaipur sandstone, saffron / turmeric /
 * marigold, henna / paddy / palm, ivory / limestone, teakwood.
 *
 * All photos under the Unsplash License (free commercial + editorial,
 * modification allowed; credits encouraged + shown in the page footer).
 * Phase 2 swaps to commissioned editorial photography.
 *
 * Url shape: cropped to width=W, focus center, auto-format (webp where
 * supported), quality 85. If any specific id 404s, replace inline below;
 * the page already attributes by Unsplash credit in the footer.
 */

interface Photo {
  /** Unsplash photo id (used to build url + credit link). */
  readonly id: string;
  /** Photographer name as displayed by Unsplash. */
  readonly by: string;
  /** Alt text — describe the scene for screen-readers + image-search. */
  readonly alt: string;
}

const U = (id: string, w: number): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=85`;

export const photoUrl = (p: Photo, w: number): string => U(p.id, w);

export const creditUrl = (p: Photo): string =>
  `https://unsplash.com/photos/${p.id}?utm_source=travelsuperapp&utm_medium=referral`;

/** Hero — Taj Mahal at sunrise, full-bleed. */
export const HERO: Photo = {
  id: '1564507592333-c60657eea523',
  by: 'Sylwia Bartyzel',
  alt: 'The Taj Mahal at sunrise, soft pink light on white marble reflected in the long pool.',
};

/** Four "Our experiences" cards: Heritage / Cuisine / Mountains / Coast. */
export const EXPERIENCES: readonly Photo[] = [
  {
    id: '1599661046289-e31897846e41',
    by: 'Annie Spratt',
    alt: 'The pink lattice façade of Hawa Mahal in Jaipur glowing at golden hour.',
  },
  {
    id: '1585937421612-70a008356fbe',
    by: 'Bimo Luki',
    alt: 'A South Indian thali served on a banana leaf — rice, dal, sambar, chutneys and papad.',
  },
  {
    id: '1626621341517-bbf3d9990a23',
    by: 'Saurav Rastogi',
    alt: 'Snow-capped Himalayan peaks rising above a quiet alpine valley at dawn.',
  },
  {
    id: '1602216056096-3b40cc0c9944',
    by: 'Tom Vining',
    alt: 'A traditional Kerala houseboat drifting through palm-lined backwaters.',
  },
];

/** The "Swaad — taste of India" full-bleed band: a vibrant spice market. */
export const GUSTARE: Photo = {
  id: '1596797038530-2c107229654b',
  by: 'Calvin Hanson',
  alt: 'Mounds of vivid spice powders — turmeric, paprika, cumin, coriander — at an Indian bazaar.',
};

/**
 * Phase 0 photography manifest.
 *
 * Curated Unsplash IDs evoking Warm Italian. All photos are licensed
 * under the Unsplash License (free for commercial + editorial use,
 * modification allowed, no attribution required but encouraged).
 *
 * Replace with original / licensed editorial photography in Phase 2
 * (when the brand commissions actual shoots). For now these provide
 * the visual texture the design language requires.
 *
 * Url shape: cropped to width=W, focus center, auto-format (webp where
 * supported), quality 85. Add `&dpr=2` for retina if Next/Image isn't
 * doing it for you.
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

/** Hero — full-bleed golden-hour Italian landscape. */
export const HERO: Photo = {
  id: '1523906834658-6e24ef2386f9',
  by: 'Damiano Baschiera',
  alt: 'A rolling Tuscan landscape at golden hour, cypress trees and a single farmhouse on a hill.',
};

/** Four "Le nostre esperienze" cards. */
export const EXPERIENCES: readonly Photo[] = [
  {
    id: '1601361302506-86bf2c66bb46',
    by: 'Henrique Ferreira',
    alt: 'Pastel-coloured houses lining a narrow stone street in a hilltop borgo.',
  },
  {
    id: '1551183053-bf91a1d81141',
    by: 'Carlo Verso',
    alt: 'A bowl of hand-rolled pasta dressed with tomato and basil, served on rustic ceramic.',
  },
  {
    id: '1474900088600-6e23a76e2af3',
    by: 'Tim Mossholder',
    alt: 'Rows of vines stretching toward the horizon under a soft afternoon sky.',
  },
  {
    id: '1543429776-2782fc8e1acd',
    by: 'Henrique Ferreira',
    alt: 'The Florence Duomo dome rising above terracotta rooftops at sunset.',
  },
];

/** The "Italia da gustare" full-bleed band. */
export const GUSTARE: Photo = {
  id: '1592486058517-36236ba247c8',
  by: 'Madeleine Maguire',
  alt: 'Old olive trees in a sun-dappled grove with a stone wall in the background.',
};

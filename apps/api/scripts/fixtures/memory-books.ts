/**
 * POST.1 — 8 published memory books spread across users + cities.
 * Each book carries 4-6 attached MediaAsset rows whose s3KeyRaw
 * is the Unsplash CDN URL (the public viewer's <img> tag works
 * directly against arbitrary URLs — the storage adapter would
 * normally hand back presigned S3 URLs, but for demo seeds the
 * direct URL is simpler + lets /featured render real photos
 * without a real S3 round-trip).
 *
 * Each MediaAsset.variants persists Unsplash photo id + photographer
 * credit per row so the public viewer can render attribution.
 *
 * Position is set so story-mode renders in a sensible order.
 */

import { photosForCity } from './photos';

export interface DemoMemoryBook {
  /** Owner email (must match a DEMO_USERS entry). */
  readonly ownerEmail: string;
  readonly title: string;
  /** Theme matches one of the 5 hand-tuned themes from V.UX.12. */
  readonly theme: 'classic' | 'vintage' | 'minimal' | 'sunset' | 'forest';
  readonly cityKey: string;
  /** Subtitle / tagline persisted as the book description. */
  readonly subtitle: string;
}

export const DEMO_BOOKS: readonly DemoMemoryBook[] = [
  {
    ownerEmail: 'demo@travel.local',
    title: 'Tokyo through the rain',
    theme: 'minimal',
    cityKey: 'tokyo',
    subtitle: 'Shibuya, Yanaka, and back-alley ramen.',
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'Lisbon yellow trams',
    theme: 'sunset',
    cityKey: 'lisbon',
    subtitle: 'A long weekend in tile and pastel.',
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'CDMX coffee crawl',
    theme: 'classic',
    cityKey: 'mexico-city',
    subtitle: 'One week, 14 cafés, infinite tacos.',
  },
  {
    ownerEmail: 'alice@travel.local',
    title: 'A month in Tbilisi',
    theme: 'vintage',
    cityKey: 'tbilisi',
    subtitle: 'Old town, new wine, slow mornings.',
  },
  {
    ownerEmail: 'alice@travel.local',
    title: 'Chiang Mai mornings',
    theme: 'forest',
    cityKey: 'chiang-mai',
    subtitle: 'Doi Suthep at sunrise, café-hopping by noon.',
  },
  {
    ownerEmail: 'bob@travel.local',
    title: 'Reykjavik in green',
    theme: 'forest',
    cityKey: 'reykjavik',
    subtitle: 'Aurora hunt + the Golden Circle.',
  },
  {
    ownerEmail: 'carol@travel.local',
    title: 'Lisbon with kids',
    theme: 'classic',
    cityKey: 'lisbon',
    subtitle: 'Oceanário, Sintra, and a lot of pastéis.',
  },
  {
    ownerEmail: 'premium@travel.local',
    title: 'CDMX, slowly',
    theme: 'sunset',
    cityKey: 'mexico-city',
    subtitle: 'A guided week in colonia Roma.',
  },
];

export interface DemoBookAsset {
  readonly photoId: string;
  readonly url: string;
  readonly credit: string;
  readonly position: number;
  readonly caption: string;
}

const CAPTIONS: Record<string, readonly string[]> = {
  tokyo: [
    'Shibuya at golden hour.',
    'Tsukiji breakfast — egg roll, tuna handroll.',
    'Yanaka cat patrol.',
    'Late-night Omoide Yokocho.',
    'A quiet shrine off the main strip.',
    'Train view, somewhere on the Yamanote.',
  ],
  lisbon: [
    'Tram 28 weaving through Alfama.',
    'Tile + sun.',
    'Pastéis de Belém, still warm.',
    'Sunset at Miradouro da Senhora do Monte.',
    'A blue door I had to stop for.',
  ],
  'mexico-city': [
    'Roma Norte morning light.',
    'Almanegra Café.',
    'Frida’s blue house.',
    'Centro Histórico arches.',
    'Quentin Café — Condesa.',
  ],
  bangkok: [
    'Yaowarat after dark.',
    'Wat Arun across the river.',
    'Skytrain platform.',
    'Lumphini at dawn.',
    'Cooking class haul.',
  ],
  marrakesh: [
    'The medina maze.',
    'Bahia Palace courtyard.',
    'Spice stack at the souk.',
    'Sunset over Jemaa el-Fnaa.',
  ],
  tbilisi: [
    'Old town from above.',
    'Mtkvari river.',
    'Wine tasting at Vino Underground.',
    'Sunset, peace.',
  ],
  'chiang-mai': [
    'Doi Suthep at dawn.',
    'Old city moat.',
    'Café morning.',
    'Sunday Walking Street.',
  ],
  reykjavik: ['Aurora.', 'Geyser at Strokkur.', 'Black sand beach.', 'Sun voyager sculpture.'],
};

/** Attach 4-6 photos to each book in deterministic order. */
export function assetsForBook(book: DemoMemoryBook): readonly DemoBookAsset[] {
  const photos = photosForCity(book.cityKey);
  const captions = CAPTIONS[book.cityKey] ?? [];
  return photos.map((p, i) => ({
    photoId: p.id,
    url: p.url,
    credit: p.credit,
    position: i,
    caption: captions[i] ?? '',
  }));
}

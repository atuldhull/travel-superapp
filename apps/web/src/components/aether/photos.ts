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

/** "Discover by region" — six iconic destinations across the country. */
export const REGIONS: readonly Photo[] = [
  {
    id: '1477587458883-47465968ef79',
    by: 'Liam Baldock',
    alt: 'A pastel Jaipur street with elaborate sandstone façades and an autorickshaw passing by.',
  },
  {
    id: '1593693411515-c20261bcad6e',
    by: 'Anirban Mahapatra',
    alt: 'A Kerala backwater at dusk with rice barges silhouetted against the sky.',
  },
  {
    id: '1567619313084-90c11abfbe53',
    by: 'Suket Dedhia',
    alt: 'Buddhist prayer flags fluttering above a monastery in the Ladakhi mountains.',
  },
  {
    id: '1512100356356-de1b84283e18',
    by: 'Lewis J Goetz',
    alt: 'A quiet Goan beach at golden hour with red-roofed Portuguese houses behind palms.',
  },
  {
    id: '1561361513-2d000a50f0dc',
    by: 'Akshay Nanavati',
    alt: 'The carved stone temples of Hampi at dawn, scattered across a granite landscape.',
  },
  {
    id: '1561361398-a8f8d1f54bd1',
    by: 'Akshay Patil',
    alt: 'Pilgrims at the Ganga ghats in Varanasi at sunrise, oil lamps and morning prayer.',
  },
];

export const REGION_LABELS: ReadonlyArray<{
  name: string;
  state: string;
  tagline: string;
  slug: string;
}> = [
  { name: 'Jaipur', state: 'Rajasthan', tagline: 'Pink city of forts & palaces.', slug: 'jaipur' },
  {
    name: 'Alleppey',
    state: 'Kerala',
    tagline: 'Backwaters, houseboats, slow time.',
    slug: 'alleppey',
  },
  { name: 'Leh', state: 'Ladakh', tagline: 'High monasteries, thin air, vast sky.', slug: 'leh' },
  { name: 'Anjuna', state: 'Goa', tagline: 'Susegad — the art of doing nothing.', slug: 'anjuna' },
  { name: 'Hampi', state: 'Karnataka', tagline: 'Vijayanagara stones in the sun.', slug: 'hampi' },
  {
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    tagline: 'The oldest living city on earth.',
    slug: 'varanasi',
  },
];

/** "Stories from the road" — three editorial article cards. */
export const JOURNAL: readonly Photo[] = [
  {
    id: '1545048702-79362596cdc9',
    by: 'Sandy Ravaloniaina',
    alt: 'A street vendor in Old Delhi serving steaming chai into small clay cups at dawn.',
  },
  {
    id: '1518002171953-a080ee817e1f',
    by: 'Sylwia Bartyzel',
    alt: 'A monastery courtyard in the Himalayas, monks crossing in maroon robes.',
  },
  {
    id: '1532375810709-75b1da00537c',
    by: 'Saurav Rastogi',
    alt: 'A weaver at a handloom in a sunlit Banaras workshop, gold thread catching the light.',
  },
];

export const JOURNAL_LABELS: ReadonlyArray<{
  kicker: string;
  title: string;
  read: string;
}> = [
  {
    kicker: 'Field notes · Old Delhi',
    title: 'Chai at first light: a morning with the kulhad walas.',
    read: '6 min read',
  },
  {
    kicker: 'Pilgrim trail · Ladakh',
    title: 'How the monks of Hemis count the seasons.',
    read: '9 min read',
  },
  {
    kicker: 'Craft · Banaras',
    title: 'The vanishing language of the Benarasi loom.',
    read: '12 min read',
  },
];

/** Featured chips strip in the hero — what's in season right now. */
export const SEASON_CHIPS: ReadonlyArray<{ label: string; place: string }> = [
  { label: 'In season', place: 'Diwali · Varanasi' },
  { label: 'Trending', place: 'Holi · Mathura' },
  { label: 'Quiet now', place: 'Monsoon · Kerala' },
  { label: 'Festival', place: 'Pushkar Mela · Rajasthan' },
];

/**
 * POST.1 — real travel photo URLs from Unsplash CDN.
 *
 * These are direct CDN URLs (no API key needed for hot-link).
 * Each entry carries Unsplash photo id + photographer attribution
 * which we persist on `MediaAsset.variants` so the credit can render
 * on the public memory-book viewer in a follow-up.
 *
 * Unsplash licence: free for commercial + non-commercial use without
 * permission. Attribution recommended (we comply by storing it on the
 * row).
 */

export interface DemoPhoto {
  /** Stable Unsplash photo id (URL slug). */
  readonly id: string;
  /** Direct CDN URL — 1200w jpeg variant. */
  readonly url: string;
  /** Photographer display name. */
  readonly credit: string;
  /** City slug this photo belongs to (for grouping into memory books). */
  readonly city: string;
}

const u = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  // Tokyo (Japan) — 6 photos
  {
    id: '1540959733332-eab4deabeeaf',
    url: u('1540959733332-eab4deabeeaf'),
    credit: 'Jezael Melgoza',
    city: 'tokyo',
  },
  {
    id: '1493997181344-712f2f19d87a',
    url: u('1493997181344-712f2f19d87a'),
    credit: 'Sora Sagano',
    city: 'tokyo',
  },
  {
    id: '1554797589-7241bb691973',
    url: u('1554797589-7241bb691973'),
    credit: 'Su San Lee',
    city: 'tokyo',
  },
  {
    id: '1480796927426-f609979314bd',
    url: u('1480796927426-f609979314bd'),
    credit: 'Manuel Cosentino',
    city: 'tokyo',
  },
  {
    id: '1542051841857-5f90071e7989',
    url: u('1542051841857-5f90071e7989'),
    credit: 'Erik Eastman',
    city: 'tokyo',
  },
  {
    id: '1528360983277-13d401cdc186',
    url: u('1528360983277-13d401cdc186'),
    credit: 'Tianshu Liu',
    city: 'tokyo',
  },

  // Lisbon (Portugal) — 5 photos
  {
    id: '1555881400-74d7acaacd8b',
    url: u('1555881400-74d7acaacd8b'),
    credit: 'Aayush Gupta',
    city: 'lisbon',
  },
  {
    id: '1588535900924-bca77a37c50d',
    url: u('1588535900924-bca77a37c50d'),
    credit: 'Liam McKay',
    city: 'lisbon',
  },
  {
    id: '1518730518541-d0843268c287',
    url: u('1518730518541-d0843268c287'),
    credit: 'Jorge Fernández Salas',
    city: 'lisbon',
  },
  {
    id: '1580323956656-26bbb1206e34',
    url: u('1580323956656-26bbb1206e34'),
    credit: 'Daniel Seßler',
    city: 'lisbon',
  },
  {
    id: '1586500036706-41963de24d8b',
    url: u('1586500036706-41963de24d8b'),
    credit: 'Tom Byrom',
    city: 'lisbon',
  },

  // Mexico City — 5 photos
  {
    id: '1518105779142-d975f22f1b0a',
    url: u('1518105779142-d975f22f1b0a'),
    credit: 'Jezael Melgoza',
    city: 'mexico-city',
  },
  {
    id: '1568404636411-a0a7b46a4c91',
    url: u('1568404636411-a0a7b46a4c91'),
    credit: 'Bryan E.',
    city: 'mexico-city',
  },
  {
    id: '1585464231875-d9ef1f5ad396',
    url: u('1585464231875-d9ef1f5ad396'),
    credit: 'Christian Velitchkov',
    city: 'mexico-city',
  },
  {
    id: '1574491493442-4c0f3b9d9f7e',
    url: u('1574491493442-4c0f3b9d9f7e'),
    credit: 'Roman Lopez',
    city: 'mexico-city',
  },
  {
    id: '1518533954129-7774297db60a',
    url: u('1518533954129-7774297db60a'),
    credit: 'Carl Campbell',
    city: 'mexico-city',
  },

  // Bangkok (Thailand) — 5 photos
  {
    id: '1508009603885-50cf7c579365',
    url: u('1508009603885-50cf7c579365'),
    credit: 'Lisheng Chang',
    city: 'bangkok',
  },
  {
    id: '1563492065599-3520f775eeed',
    url: u('1563492065599-3520f775eeed'),
    credit: 'Florian Wehde',
    city: 'bangkok',
  },
  {
    id: '1528181304800-259b08848526',
    url: u('1528181304800-259b08848526'),
    credit: 'Mathew Schwartz',
    city: 'bangkok',
  },
  {
    id: '1467139840830-cd5b3c11e6f9',
    url: u('1467139840830-cd5b3c11e6f9'),
    credit: 'Geoff Greenwood',
    city: 'bangkok',
  },
  {
    id: '1554189097-ffe88e998a2b',
    url: u('1554189097-ffe88e998a2b'),
    credit: 'Robin Noguier',
    city: 'bangkok',
  },

  // Marrakesh (Morocco) — 4 photos
  {
    id: '1539020140153-e479b8c5db5d',
    url: u('1539020140153-e479b8c5db5d'),
    credit: 'Sergey Pesterev',
    city: 'marrakesh',
  },
  {
    id: '1597212720128-ae8f9bbe8b51',
    url: u('1597212720128-ae8f9bbe8b51'),
    credit: 'Louis Hansel',
    city: 'marrakesh',
  },
  {
    id: '1518181830704-f7d2bcd43abc',
    url: u('1518181830704-f7d2bcd43abc'),
    credit: 'Calin Stan',
    city: 'marrakesh',
  },
  {
    id: '1555486571-d12d51e4bc5d',
    url: u('1555486571-d12d51e4bc5d'),
    credit: 'Annie Spratt',
    city: 'marrakesh',
  },

  // Tbilisi (Georgia) — 4 photos
  {
    id: '1565008576549-57569a49371d',
    url: u('1565008576549-57569a49371d'),
    credit: 'Andrey Andreyev',
    city: 'tbilisi',
  },
  {
    id: '1601999671999-43e3afac4e9b',
    url: u('1601999671999-43e3afac4e9b'),
    credit: 'Bogdan Pasca',
    city: 'tbilisi',
  },
  {
    id: '1542051841857-5f90071e7989',
    url: u('1542051841857-5f90071e7989'),
    credit: 'Erik Eastman',
    city: 'tbilisi',
  },
  {
    id: '1581338834647-b0fb40704e21',
    url: u('1581338834647-b0fb40704e21'),
    credit: 'Anna Auza',
    city: 'tbilisi',
  },

  // Chiang Mai (Thailand) — 4 photos
  {
    id: '1528181304800-259b08848526',
    url: u('1528181304800-259b08848526'),
    credit: 'Mathew Schwartz',
    city: 'chiang-mai',
  },
  {
    id: '1571115764595-644a1f56a55c',
    url: u('1571115764595-644a1f56a55c'),
    credit: 'Mark Stosberg',
    city: 'chiang-mai',
  },
  {
    id: '1583225214464-9296029427aa',
    url: u('1583225214464-9296029427aa'),
    credit: 'Mark Boss',
    city: 'chiang-mai',
  },
  {
    id: '1551244072-5d12893278ab',
    url: u('1551244072-5d12893278ab'),
    credit: 'Nico Smit',
    city: 'chiang-mai',
  },

  // Reykjavik (Iceland) — 4 photos
  {
    id: '1539635746810-9c781bdf0626',
    url: u('1539635746810-9c781bdf0626'),
    credit: 'Anders Jildén',
    city: 'reykjavik',
  },
  {
    id: '1552072092-7f9b8d63efcb',
    url: u('1552072092-7f9b8d63efcb'),
    credit: 'Cosmic Timetraveler',
    city: 'reykjavik',
  },
  {
    id: '1518837695005-2083093ee35b',
    url: u('1518837695005-2083093ee35b'),
    credit: 'Jonatan Pie',
    city: 'reykjavik',
  },
  {
    id: '1493975325914-c0bc26eea03c',
    url: u('1493975325914-c0bc26eea03c'),
    credit: 'Robert Lukeman',
    city: 'reykjavik',
  },
];

export function photosForCity(city: string): readonly DemoPhoto[] {
  return DEMO_PHOTOS.filter((p) => p.city === city);
}

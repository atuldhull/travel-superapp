/**
 * AE182 — Atlas pin catalogue, extracted from atlas-canvas.tsx so the
 * data is reachable from tests without booting Leaflet / jsdom.
 *
 * Order is intentional: North → South for the destination list under
 * the map. The map itself auto-fits all markers regardless.
 */

export interface Pin {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
  /** Real lat/lng — used by Leaflet + makes the map navigate-able. */
  readonly lat: number;
  readonly lng: number;
}

export const PINS: readonly Pin[] = [
  {
    slug: 'leh',
    name: 'Leh',
    state: 'Ladakh',
    tagline: 'High monasteries, thin air.',
    lat: 34.1526,
    lng: 77.5771,
  },
  {
    slug: 'spiti',
    name: 'Spiti',
    state: 'Himachal Pradesh',
    tagline: 'Trans-Himalayan high desert.',
    lat: 32.2455,
    lng: 78.0341,
  },
  {
    slug: 'darjeeling',
    name: 'Darjeeling',
    state: 'West Bengal',
    tagline: 'Tea & Kanchenjunga.',
    lat: 27.041,
    lng: 88.2663,
  },
  {
    slug: 'shillong',
    name: 'Shillong',
    state: 'Meghalaya',
    tagline: 'Scotland of the East.',
    lat: 25.5788,
    lng: 91.8933,
  },
  {
    slug: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    tagline: 'Pink city of forts.',
    lat: 26.9124,
    lng: 75.7873,
  },
  {
    slug: 'udaipur',
    name: 'Udaipur',
    state: 'Rajasthan',
    tagline: 'The City of Lakes.',
    lat: 24.5854,
    lng: 73.7125,
  },
  {
    slug: 'bhuj',
    name: 'Bhuj',
    state: 'Gujarat',
    tagline: 'The white Rann of Kutch.',
    lat: 23.2419,
    lng: 69.6669,
  },
  {
    slug: 'varanasi',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    tagline: 'The oldest living city.',
    lat: 25.3176,
    lng: 82.9739,
  },
  {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    tagline: 'A city of seven islands.',
    lat: 19.076,
    lng: 72.8777,
  },
  {
    slug: 'anjuna',
    name: 'Anjuna',
    state: 'Goa',
    tagline: 'Susegad — beach & cafés.',
    lat: 15.5736,
    lng: 73.74,
  },
  {
    slug: 'hampi',
    name: 'Hampi',
    state: 'Karnataka',
    tagline: 'A vanished empire in granite.',
    lat: 15.335,
    lng: 76.46,
  },
  {
    slug: 'coorg',
    name: 'Coorg',
    state: 'Karnataka',
    tagline: 'Coffee country in the mist.',
    lat: 12.3375,
    lng: 75.8069,
  },
  {
    slug: 'pondicherry',
    name: 'Pondicherry',
    state: 'Tamil Nadu',
    tagline: 'A French quarter on the bay.',
    lat: 11.9416,
    lng: 79.8083,
  },
  {
    slug: 'madurai',
    name: 'Madurai',
    state: 'Tamil Nadu',
    tagline: 'The Athens of the East.',
    lat: 9.9252,
    lng: 78.1198,
  },
  {
    slug: 'alleppey',
    name: 'Alleppey',
    state: 'Kerala',
    tagline: 'Backwaters & houseboats.',
    lat: 9.4981,
    lng: 76.3388,
  },
];

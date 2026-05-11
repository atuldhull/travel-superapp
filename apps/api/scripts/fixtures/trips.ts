/**
 * POST.1 — 12 trips across 8 cities, distributed across 6 demo
 * users. Date ranges include past (for /trips Active vs Archived
 * tab demonstration), present (for the welcome-back hero), and
 * near-future (for the planning surface).
 *
 * `centerLat / centerLng` are inserted via raw SQL (PostGIS
 * geography(Point, 4326)) — we don't go through GeoQueries here
 * because the seed runs once at boot and we want zero coupling
 * to the running app.
 */

import type { TripStatus } from '@prisma/client';

export interface DemoTrip {
  /** Owner email (must match a DEMO_USERS entry). */
  readonly ownerEmail: string;
  readonly title: string;
  readonly cityKey: string; // matches photos.ts city + memory-books.ts city
  readonly centerLat: number;
  readonly centerLng: number;
  readonly radiusKm: number;
  /** ISO date strings; null = undated draft. */
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: TripStatus;
  /** Items to seed under the first day (the seed creates a single
   *  ItineraryDay per trip — keeps the seed simple but lets /trips/[id]
   *  render real day cards). */
  readonly items: ReadonlyArray<{ position: number; title: string; notes?: string }>;
}

export const DEMO_TRIPS: readonly DemoTrip[] = [
  // demo@travel.local owns 5 trips (the headline user)
  {
    ownerEmail: 'demo@travel.local',
    title: 'Tokyo neighbourhoods',
    cityKey: 'tokyo',
    centerLat: 35.6762,
    centerLng: 139.6503,
    radiusKm: 12,
    startsOn: '2026-09-12',
    endsOn: '2026-09-18',
    status: 'published',
    items: [
      { position: 0, title: 'Shibuya Crossing dawn run' },
      { position: 1, title: 'Tsukiji outer market breakfast' },
      {
        position: 2,
        title: 'Yanaka old-town walk',
        notes: 'Stop at Tennoji temple for the giant Buddha.',
      },
      { position: 3, title: 'Omoide Yokocho dinner' },
    ],
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'Lisbon weekend',
    cityKey: 'lisbon',
    centerLat: 38.7223,
    centerLng: -9.1393,
    radiusKm: 8,
    startsOn: '2026-10-03',
    endsOn: '2026-10-06',
    status: 'published',
    items: [
      { position: 0, title: 'Tram 28 to Alfama' },
      { position: 1, title: 'Pastéis de Belém' },
      { position: 2, title: 'Sunset at Miradouro da Senhora do Monte' },
    ],
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'CDMX coffee crawl',
    cityKey: 'mexico-city',
    centerLat: 19.4326,
    centerLng: -99.1332,
    radiusKm: 6,
    startsOn: '2026-11-15',
    endsOn: '2026-11-22',
    status: 'draft',
    items: [
      { position: 0, title: 'Buna 42 — Roma Norte' },
      { position: 1, title: 'Almanegra Café — Roma Norte' },
      { position: 2, title: 'Quentin Café — Condesa' },
    ],
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'Bangkok food tour',
    cityKey: 'bangkok',
    centerLat: 13.7563,
    centerLng: 100.5018,
    radiusKm: 10,
    startsOn: '2026-12-01',
    endsOn: '2026-12-08',
    status: 'draft',
    items: [
      { position: 0, title: 'Chinatown street food at Yaowarat' },
      { position: 1, title: 'Cooking class — Silom Thai Cooking' },
    ],
  },
  {
    ownerEmail: 'demo@travel.local',
    title: 'Marrakesh souks (last year)',
    cityKey: 'marrakesh',
    centerLat: 31.6295,
    centerLng: -7.9811,
    radiusKm: 5,
    startsOn: '2025-04-12',
    endsOn: '2025-04-19',
    status: 'archived',
    items: [
      { position: 0, title: 'Jemaa el-Fnaa at sunset' },
      { position: 1, title: 'Bahia Palace tour' },
    ],
  },

  // alice@travel.local — 2 trips
  {
    ownerEmail: 'alice@travel.local',
    title: 'Tbilisi nomad month',
    cityKey: 'tbilisi',
    centerLat: 41.7151,
    centerLng: 44.8271,
    radiusKm: 8,
    startsOn: '2026-08-01',
    endsOn: '2026-08-30',
    status: 'published',
    items: [
      { position: 0, title: 'Coworking at Impact Hub' },
      { position: 1, title: 'Wine tasting at Vino Underground' },
    ],
  },
  {
    ownerEmail: 'alice@travel.local',
    title: 'Chiang Mai retreat',
    cityKey: 'chiang-mai',
    centerLat: 18.7883,
    centerLng: 98.9853,
    radiusKm: 6,
    startsOn: '2026-09-20',
    endsOn: '2026-09-30',
    status: 'draft',
    items: [{ position: 0, title: 'Doi Suthep temple at dawn' }],
  },

  // bob@travel.local — 2 trips
  {
    ownerEmail: 'bob@travel.local',
    title: 'Reykjavik northern lights',
    cityKey: 'reykjavik',
    centerLat: 64.1466,
    centerLng: -21.9426,
    radiusKm: 15,
    startsOn: '2026-10-15',
    endsOn: '2026-10-22',
    status: 'published',
    items: [
      { position: 0, title: 'Golden Circle day trip' },
      { position: 1, title: 'Aurora hunt with Reykjavik Excursions' },
    ],
  },
  {
    ownerEmail: 'bob@travel.local',
    title: 'Tokyo deep dive',
    cityKey: 'tokyo',
    centerLat: 35.6762,
    centerLng: 139.6503,
    radiusKm: 15,
    startsOn: '2026-11-01',
    endsOn: '2026-11-12',
    status: 'draft',
    items: [
      { position: 0, title: 'Daikanyama T-Site bookstore' },
      { position: 1, title: 'Daytrip to Kamakura' },
    ],
  },

  // carol@travel.local — 1 trip
  {
    ownerEmail: 'carol@travel.local',
    title: 'Lisbon family trip',
    cityKey: 'lisbon',
    centerLat: 38.7223,
    centerLng: -9.1393,
    radiusKm: 10,
    startsOn: '2026-09-25',
    endsOn: '2026-10-02',
    status: 'published',
    items: [
      { position: 0, title: 'Oceanário de Lisboa' },
      { position: 1, title: 'Sintra day trip' },
    ],
  },

  // premium@travel.local — 1 concierge-tier trip
  {
    ownerEmail: 'premium@travel.local',
    title: 'CDMX with concierge',
    cityKey: 'mexico-city',
    centerLat: 19.4326,
    centerLng: -99.1332,
    radiusKm: 10,
    startsOn: '2026-11-08',
    endsOn: '2026-11-15',
    status: 'published',
    items: [
      { position: 0, title: 'Frida Kahlo Museum private tour' },
      { position: 1, title: 'Xochimilco trajinera with chef' },
    ],
  },

  // dave@travel.local — 1 trip
  {
    ownerEmail: 'dave@travel.local',
    title: 'Bangkok nomad week',
    cityKey: 'bangkok',
    centerLat: 13.7563,
    centerLng: 100.5018,
    radiusKm: 8,
    startsOn: '2026-08-15',
    endsOn: '2026-08-22',
    status: 'published',
    items: [
      { position: 0, title: 'The Hive coworking — Phrom Phong' },
      { position: 1, title: 'Lumphini park run' },
    ],
  },
];

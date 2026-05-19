/**
 * Curated continent → country → famous-destination dataset for the
 * upgraded Create-Trip flow (Phase 2, E2).
 *
 * Honest scope: these are *popular picks*, not an exhaustive atlas —
 * enough to pick a continent (or several), see nearby countries, and
 * jump to a marquee destination. Coordinates are baked in so there is
 * ZERO network/geocoding cost ($0, instant, offline-safe). Anything
 * not listed is still reachable via the free place search.
 *
 * Installed for Phase 2 — Create-Trip upgrade.
 */

export interface FamousDestination {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}
export interface DestCountry {
  readonly country: string;
  readonly destinations: readonly FamousDestination[];
}

export const DESTINATIONS: Readonly<Record<string, readonly DestCountry[]>> = {
  Europe: [
    {
      country: 'France',
      destinations: [
        { name: 'Paris', lat: 48.8566, lng: 2.3522 },
        { name: 'Nice', lat: 43.7102, lng: 7.262 },
        { name: 'Lyon', lat: 45.764, lng: 4.8357 },
      ],
    },
    {
      country: 'Italy',
      destinations: [
        { name: 'Rome', lat: 41.9028, lng: 12.4964 },
        { name: 'Venice', lat: 45.4408, lng: 12.3155 },
        { name: 'Florence', lat: 43.7696, lng: 11.2558 },
      ],
    },
    {
      country: 'Spain',
      destinations: [
        { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
        { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
        { name: 'Seville', lat: 37.3891, lng: -5.9845 },
      ],
    },
    {
      country: 'Portugal',
      destinations: [
        { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },
        { name: 'Porto', lat: 41.1579, lng: -8.6291 },
      ],
    },
    {
      country: 'Switzerland',
      destinations: [
        { name: 'Zurich', lat: 47.3769, lng: 8.5417 },
        { name: 'Interlaken', lat: 46.6863, lng: 7.8632 },
      ],
    },
  ],
  Asia: [
    {
      country: 'Japan',
      destinations: [
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { name: 'Kyoto', lat: 35.0116, lng: 135.7681 },
        { name: 'Osaka', lat: 34.6937, lng: 135.5023 },
      ],
    },
    {
      country: 'India',
      destinations: [
        { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
        { name: 'Goa', lat: 15.2993, lng: 74.124 },
        { name: 'Rishikesh', lat: 30.0869, lng: 78.2676 },
      ],
    },
    {
      country: 'Thailand',
      destinations: [
        { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
        { name: 'Chiang Mai', lat: 18.7883, lng: 98.9853 },
        { name: 'Phuket', lat: 7.8804, lng: 98.3923 },
      ],
    },
    {
      country: 'Indonesia',
      destinations: [
        { name: 'Bali', lat: -8.3405, lng: 115.092 },
        { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
      ],
    },
    {
      country: 'UAE',
      destinations: [{ name: 'Dubai', lat: 25.2048, lng: 55.2708 }],
    },
  ],
  Africa: [
    {
      country: 'Morocco',
      destinations: [
        { name: 'Marrakesh', lat: 31.6295, lng: -7.9811 },
        { name: 'Fez', lat: 34.0181, lng: -5.0078 },
      ],
    },
    {
      country: 'Egypt',
      destinations: [
        { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
        { name: 'Luxor', lat: 25.6872, lng: 32.6396 },
      ],
    },
    {
      country: 'South Africa',
      destinations: [
        { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
        { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
      ],
    },
    {
      country: 'Tanzania',
      destinations: [{ name: 'Zanzibar', lat: -6.1659, lng: 39.2026 }],
    },
  ],
  'North America': [
    {
      country: 'United States',
      destinations: [
        { name: 'New York', lat: 40.7128, lng: -74.006 },
        { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
        { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
      ],
    },
    {
      country: 'Mexico',
      destinations: [
        { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
        { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
      ],
    },
    {
      country: 'Canada',
      destinations: [
        { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
        { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
      ],
    },
  ],
  'South America': [
    {
      country: 'Peru',
      destinations: [
        { name: 'Cusco', lat: -13.5319, lng: -71.9675 },
        { name: 'Lima', lat: -12.0464, lng: -77.0428 },
      ],
    },
    {
      country: 'Brazil',
      destinations: [
        { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
        { name: 'São Paulo', lat: -23.5558, lng: -46.6396 },
      ],
    },
    {
      country: 'Argentina',
      destinations: [{ name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 }],
    },
  ],
  Oceania: [
    {
      country: 'Australia',
      destinations: [
        { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
      ],
    },
    {
      country: 'New Zealand',
      destinations: [
        { name: 'Queenstown', lat: -45.0312, lng: 168.6626 },
        { name: 'Auckland', lat: -36.8485, lng: 174.7633 },
      ],
    },
  ],
};

export const CONTINENTS: readonly string[] = Object.keys(DESTINATIONS);

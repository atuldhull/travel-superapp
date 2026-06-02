/**
 * Sample Echo feed for the Aether mobile preview (Phase 4 AE548).
 *
 * Until the Echo route wires to the real social feed (the WebTransport
 * feed channel is operator-owed), the preview renders this fixed set so
 * the card stack demos on a fresh install. Shape matches `EchoItem`
 * from `@app/aether-canvas-shared` exactly.
 *
 * `photoUrl` is null for every entry — the first-cut mobile Echo scene
 * paints palette-tinted cards from `dominantColor` (via the AE420
 * palette re-derivation) rather than textures.
 */
import type { EchoItem } from '@app/aether-canvas-shared';

export const SAMPLE_ECHO_FEED: ReadonlyArray<EchoItem> = [
  {
    id: 'e-1',
    traveller: 'Meera K.',
    travellerHandle: 'meera',
    placeName: 'Pangong Tso',
    destinationSlug: 'leh',
    photoUrl: null,
    dominantColor: '#3E6B8A',
    diary: 'The lake changes colour every hour. Stayed past sunset just to watch it turn.',
    postedAt: '2026-06-11T18:20:00.000Z',
  },
  {
    id: 'e-2',
    traveller: 'Arjun R.',
    travellerHandle: 'arjun',
    placeName: 'Anjuna Beach',
    destinationSlug: 'anjuna',
    photoUrl: null,
    dominantColor: '#C2854A',
    diary: 'Scooter to the flea market, then nothing but the tide for the rest of the day.',
    postedAt: '2026-06-10T15:05:00.000Z',
  },
  {
    id: 'e-3',
    traveller: 'Sara P.',
    travellerHandle: 'sara',
    placeName: 'Varanasi Ghats',
    destinationSlug: 'varanasi',
    photoUrl: null,
    dominantColor: '#A14B3C',
    diary: 'The morning aarti at Assi Ghat is the most awake the city ever feels.',
    postedAt: '2026-06-09T05:40:00.000Z',
  },
  {
    id: 'e-4',
    traveller: 'Dev S.',
    travellerHandle: 'dev',
    placeName: 'Alleppey Backwaters',
    destinationSlug: 'alleppey',
    photoUrl: null,
    dominantColor: '#4A7C59',
    diary: 'Houseboat for two nights. The only schedule was the next meal.',
    postedAt: '2026-06-08T12:30:00.000Z',
  },
  {
    id: 'e-5',
    traveller: 'Nila T.',
    travellerHandle: 'nila',
    placeName: 'Hampi Boulders',
    destinationSlug: 'hampi',
    photoUrl: null,
    dominantColor: '#B0764A',
    diary: 'Climbed Matanga Hill for sunrise. The ruins go on further than any photo shows.',
    postedAt: '2026-06-07T06:15:00.000Z',
  },
];

/**
 * A sample itinerary for the Aether mobile preview surfaces (Phase 4
 * AE540).
 *
 * Until the Aether mobile routes wire to real trips via
 * `useTripControllerGetItinerary`, the preview routes render this fixed
 * 4-day Leh itinerary so Drift / Atlas demo meaningfully on a fresh
 * install + on a simulator with no account. Shape matches
 * `AtlasDayLike` from `@app/aether-canvas-shared` exactly.
 *
 * The placeIds are synthetic (`place-<n>`) — the orb field only needs
 * the count + ordering, not real place rows. When the routes wire to a
 * real trip this fixture is dropped.
 */
import type { AtlasDayLike } from '@app/aether-canvas-shared';

export const SAMPLE_LEH_TRIP: ReadonlyArray<AtlasDayLike> = [
  {
    id: 'day-1',
    dayIndex: 0,
    date: '2026-06-10',
    items: [
      { id: 'i-1', position: 0, placeId: 'place-leh-market' },
      { id: 'i-2', position: 1, placeId: 'place-shanti-stupa' },
      { id: 'i-3', position: 2, placeId: 'place-leh-palace' },
    ],
  },
  {
    id: 'day-2',
    dayIndex: 1,
    date: '2026-06-11',
    items: [
      { id: 'i-4', position: 0, placeId: 'place-nubra-valley' },
      { id: 'i-5', position: 1, placeId: 'place-diskit-monastery' },
    ],
  },
  {
    id: 'day-3',
    dayIndex: 2,
    date: '2026-06-12',
    items: [
      { id: 'i-6', position: 0, placeId: 'place-pangong-lake' },
      { id: 'i-7', position: 1, placeId: 'place-chang-la' },
      { id: 'i-8', position: 2, placeId: 'place-spangmik' },
      { id: 'i-9', position: 3, placeId: 'place-lukung' },
    ],
  },
  {
    id: 'day-4',
    dayIndex: 3,
    date: '2026-06-13',
    items: [{ id: 'i-10', position: 0, placeId: 'place-hemis-monastery' }],
  },
];

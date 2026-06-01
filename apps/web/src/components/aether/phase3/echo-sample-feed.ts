/**
 * AE418 — sample Echo feed.
 *
 * 5 curated fixtures so the Phase 3 scaffold can render an actual feed
 * without yet wiring `useFeedController*` from the 1.0 SDK. Each
 * fixture's dominant colour is picked deliberately so the AE420
 * palette re-derivation reads as "the room re-tints when I scroll".
 * Real social feed adapter lands in a b-slice.
 */
import type { EchoItem } from './echo-feed';

export const SAMPLE_ECHO_FEED: ReadonlyArray<EchoItem> = Object.freeze([
  {
    id: 'echo-leh-prayer',
    traveller: 'Asha Verma',
    travellerHandle: 'asha',
    placeName: 'Diskit Monastery',
    destinationSlug: 'leh',
    photoUrl:
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1600&q=80',
    dominantColor: '#5C84B4',
    diary: 'The prayer flags above Diskit make the whole valley feel like a held breath.',
    postedAt: '2026-05-30T08:24:00.000Z',
  },
  {
    id: 'echo-goa-sunset',
    traveller: 'Vikrant K.',
    travellerHandle: 'vikrantk',
    placeName: 'Anjuna Cliff Walk',
    destinationSlug: 'goa',
    photoUrl:
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1600&q=80',
    dominantColor: '#E8814D',
    diary: 'Sun melts into the Arabian sea while the surf throws orange foam at the basalt.',
    postedAt: '2026-05-29T17:51:00.000Z',
  },
  {
    id: 'echo-jaipur-court',
    traveller: 'Aisha Roy',
    travellerHandle: 'aisha',
    placeName: 'Jal Mahal courtyard',
    destinationSlug: 'jaipur',
    photoUrl:
      'https://images.unsplash.com/photo-1599661046827-dacde6976549?auto=format&fit=crop&w=1600&q=80',
    dominantColor: '#D6A05F',
    diary: 'Pink walls humming, the courtyard cool by lamplight, and somewhere a sitar starts.',
    postedAt: '2026-05-28T20:12:00.000Z',
  },
  {
    id: 'echo-alleppey-houseboat',
    traveller: 'Maya Iyer',
    travellerHandle: 'maya',
    placeName: 'Kuttanad backwaters',
    destinationSlug: 'alleppey',
    photoUrl:
      'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=80',
    dominantColor: '#5C9B7A',
    diary: 'The houseboat glides past a heron. Coconut palms tip their long bows in the wind.',
    postedAt: '2026-05-27T06:02:00.000Z',
  },
  {
    id: 'echo-varanasi-aarti',
    traveller: 'Ravi Joshi',
    travellerHandle: 'ravij',
    placeName: 'Dashashwamedh Ghat',
    destinationSlug: 'varanasi',
    photoUrl:
      'https://images.unsplash.com/photo-1561361398-a8a8e72df96f?auto=format&fit=crop&w=1600&q=80',
    dominantColor: '#B0644A',
    diary: 'A thousand diyas float at the aarti — saffron, smoke, and the river beneath.',
    postedAt: '2026-05-26T18:43:00.000Z',
  },
]);

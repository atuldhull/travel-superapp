/**
 * Real hotel/booking deep links.
 *
 * We do NOT resell or store hotel inventory (that would need paid
 * provider APIs + partnerships). Instead we send the traveller straight
 * to a trusted booking site with their search — destination + dates +
 * guests + rooms — pre-filled in the URL, so they see live prices and
 * book on that site. Honest by construction: nothing here is faked.
 *
 * The major OTAs (Booking, Agoda, Airbnb, Expedia, Hotels.com, KAYAK,
 * Hostelworld) accept full date+guest params; a few (the India OTAs,
 * Trivago, Google) reliably accept the destination and open their search
 * for it. All open in a new tab.
 */

export interface StaySearch {
  readonly destination: string;
  readonly checkIn: string; // YYYY-MM-DD
  readonly checkOut: string; // YYYY-MM-DD
  readonly guests: number;
  readonly rooms: number;
}

export interface BookingPartner {
  readonly key: string;
  readonly name: string;
  readonly blurb: string;
  /** Brand colour for the card accent. */
  readonly accent: string;
  /** Builds the deep-link search URL for this site. */
  readonly build: (q: StaySearch) => string;
}

const enc = (s: string): string => encodeURIComponent(s.trim());

export const BOOKING_PARTNERS: readonly BookingPartner[] = [
  {
    key: 'booking',
    name: 'Booking.com',
    blurb: 'Hotels, apartments & homes worldwide',
    accent: '#003580',
    build: (q) =>
      `https://www.booking.com/searchresults.html?ss=${enc(q.destination)}&checkin=${q.checkIn}&checkout=${q.checkOut}&group_adults=${q.guests}&no_rooms=${q.rooms}&group_children=0`,
  },
  {
    key: 'agoda',
    name: 'Agoda',
    blurb: 'Sharp rates across Asia & India',
    accent: '#ff5a1f',
    build: (q) =>
      `https://www.agoda.com/search?textToSearch=${enc(q.destination)}&checkIn=${q.checkIn}&checkOut=${q.checkOut}&adults=${q.guests}&rooms=${q.rooms}`,
  },
  {
    key: 'airbnb',
    name: 'Airbnb',
    blurb: 'Homes, villas & unique stays',
    accent: '#ff385c',
    build: (q) =>
      `https://www.airbnb.com/s/${enc(q.destination)}/homes?checkin=${q.checkIn}&checkout=${q.checkOut}&adults=${q.guests}`,
  },
  {
    key: 'expedia',
    name: 'Expedia',
    blurb: 'Hotels, plus flight + stay bundles',
    accent: '#1668e3',
    build: (q) =>
      `https://www.expedia.com/Hotel-Search?destination=${enc(q.destination)}&startDate=${q.checkIn}&endDate=${q.checkOut}&adults=${q.guests}`,
  },
  {
    key: 'hotels',
    name: 'Hotels.com',
    blurb: 'Collect 10 nights, get 1 reward night',
    accent: '#d32f2f',
    build: (q) =>
      `https://www.hotels.com/Hotel-Search?destination=${enc(q.destination)}&startDate=${q.checkIn}&endDate=${q.checkOut}&adults=${q.guests}`,
  },
  {
    key: 'makemytrip',
    name: 'MakeMyTrip',
    blurb: 'India’s big OTA — hotels & homestays',
    accent: '#eb2026',
    build: (q) =>
      `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${enc(q.destination)}`,
  },
  {
    key: 'goibibo',
    name: 'Goibibo',
    blurb: 'Hotels & resorts across India',
    accent: '#f37021',
    build: (q) => `https://www.goibibo.com/hotels/find-hotels/?query=${enc(q.destination)}`,
  },
  {
    key: 'kayak',
    name: 'KAYAK',
    blurb: 'Metasearch — compares many sites',
    accent: '#ff690f',
    build: (q) =>
      `https://www.kayak.com/hotels/${enc(q.destination)}/${q.checkIn}/${q.checkOut}/${q.guests}adults`,
  },
  {
    key: 'trivago',
    name: 'Trivago',
    blurb: 'Compare one hotel across sites',
    accent: '#007faf',
    build: (q) => `https://www.trivago.com/en-US/srl?query=${enc(q.destination)}`,
  },
  {
    key: 'hostelworld',
    name: 'Hostelworld',
    blurb: 'Best for hostels & budget beds',
    accent: '#f6a623',
    build: (q) =>
      `https://www.hostelworld.com/search?search_keywords=${enc(q.destination)}&date_from=${q.checkIn}&date_to=${q.checkOut}&number_of_guests=${q.guests}`,
  },
  {
    key: 'google',
    name: 'Google Hotels',
    blurb: 'Quick overview across providers',
    accent: '#4285f4',
    build: (q) => `https://www.google.com/travel/search?q=${enc(`hotels in ${q.destination}`)}`,
  },
];

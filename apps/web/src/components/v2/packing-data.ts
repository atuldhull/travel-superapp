/**
 * Destination-aware packing/prep starter packs (ported from the aether
 * journey checklist, AE114 — but pure data, no aether-core dependency).
 *
 * Keys are the same lowercase destination slugs used across the app.
 * `starterForSlug` returns a fresh copy each call so callers can mutate
 * without cross-talk, falling back to the generic STARTER list.
 */

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

const STARTER: ReadonlyArray<ChecklistItem> = [
  { id: 'k1', text: 'Photo ID + photocopy', done: false },
  { id: 'k2', text: 'Cash + UPI app working offline', done: false },
  { id: 'k3', text: 'Power bank + the right plug', done: false },
  { id: 'k4', text: 'A long sleeve for monasteries / temples', done: false },
  { id: 'k5', text: 'One book, one notebook', done: false },
];

const STARTER_PACKS: Readonly<Record<string, ReadonlyArray<ChecklistItem>>> = {
  leh: [
    { id: 'p-leh-1', text: 'Down jacket + thermal base layer', done: false },
    { id: 'p-leh-2', text: 'Diamox / altitude pills (consult doctor)', done: false },
    { id: 'p-leh-3', text: 'Inner Line Permit printouts', done: false },
    { id: 'p-leh-4', text: 'Lip balm + SPF 50 (UV is brutal at 3500m)', done: false },
    { id: 'p-leh-5', text: 'Cash — ATMs are sparse beyond town', done: false },
    { id: 'p-leh-6', text: 'Offline maps + downloaded routes', done: false },
  ],
  spiti: [
    { id: 'p-spi-1', text: 'Down jacket + windproof shell', done: false },
    { id: 'p-spi-2', text: 'Altitude meds + electrolytes', done: false },
    { id: 'p-spi-3', text: 'Cash — networks die past Kaza', done: false },
    { id: 'p-spi-4', text: 'Solid shoes — gravel roads, river crossings', done: false },
    { id: 'p-spi-5', text: 'Powerbank for cold-killed phones', done: false },
  ],
  darjeeling: [
    { id: 'p-dar-1', text: 'Light woollens + a waterproof', done: false },
    { id: 'p-dar-2', text: 'Walking shoes for steep lanes', done: false },
    { id: 'p-dar-3', text: 'A flask — the tea here is the point', done: false },
    { id: 'p-dar-4', text: 'Camera + extra battery for Kanchenjunga dawn', done: false },
    { id: 'p-dar-5', text: 'Cash — small shops, no card terminals', done: false },
  ],
  shillong: [
    { id: 'p-shi-1', text: 'Waterproof jacket — Meghalaya means rain', done: false },
    { id: 'p-shi-2', text: 'Quick-dry shoes', done: false },
    { id: 'p-shi-3', text: 'Dry-bag for camera + phone', done: false },
    { id: 'p-shi-4', text: 'Cash for shared sumos', done: false },
  ],
  jaipur: [
    { id: 'p-jai-1', text: 'Loose cottons + a scarf (palace floors, dust)', done: false },
    { id: 'p-jai-2', text: 'SPF + hat — the sun is honest here', done: false },
    { id: 'p-jai-3', text: 'Refillable water bottle', done: false },
    { id: 'p-jai-4', text: 'A long sleeve for temples', done: false },
    { id: 'p-jai-5', text: 'UPI ready — even autos take it', done: false },
  ],
  udaipur: [
    { id: 'p-uda-1', text: 'Sandals + something for boat rides', done: false },
    { id: 'p-uda-2', text: 'SPF + sunglasses', done: false },
    { id: 'p-uda-3', text: 'Modest cover for temples', done: false },
    { id: 'p-uda-4', text: 'Cash for small ferry tickets', done: false },
  ],
  bhuj: [
    { id: 'p-bhu-1', text: 'SPF + sunglasses (white salt = mirror)', done: false },
    { id: 'p-bhu-2', text: 'Light layers — desert night is cold', done: false },
    { id: 'p-bhu-3', text: 'Closed shoes for the Rann walk', done: false },
    { id: 'p-bhu-4', text: 'Cash — villages run on it', done: false },
  ],
  varanasi: [
    { id: 'p-var-1', text: 'Slip-on shoes (ghat etiquette)', done: false },
    { id: 'p-var-2', text: 'A long sleeve for the ghats at dawn', done: false },
    { id: 'p-var-3', text: 'Bottled water + ORS sachets', done: false },
    { id: 'p-var-4', text: 'A camera for the aarti', done: false },
    { id: 'p-var-5', text: 'Small notes for boatmen + offerings', done: false },
  ],
  mumbai: [
    { id: 'p-mum-1', text: 'A foldable raincoat (June–Sept)', done: false },
    { id: 'p-mum-2', text: 'Walking shoes — South Bombay is on foot', done: false },
    { id: 'p-mum-3', text: 'Metro / local card topped up', done: false },
    { id: 'p-mum-4', text: 'Power bank for a long day', done: false },
  ],
  anjuna: [
    { id: 'p-anj-1', text: 'Swimwear + a beach towel', done: false },
    { id: 'p-anj-2', text: 'Reef-safe SPF 50', done: false },
    { id: 'p-anj-3', text: 'Helmet — scooter is the way here', done: false },
    { id: 'p-anj-4', text: 'Mosquito repellent', done: false },
    { id: 'p-anj-5', text: 'A dry-bag for sunset rides', done: false },
  ],
  hampi: [
    { id: 'p-ham-1', text: 'Closed shoes for boulder climbs', done: false },
    { id: 'p-ham-2', text: 'SPF + a hat — there is no shade', done: false },
    { id: 'p-ham-3', text: '2L of water minimum', done: false },
    { id: 'p-ham-4', text: 'A long sleeve for the temples', done: false },
    { id: 'p-ham-5', text: 'Cash — the river crossing is informal', done: false },
  ],
  coorg: [
    { id: 'p-coo-1', text: 'A light fleece — hills get cold at night', done: false },
    { id: 'p-coo-2', text: 'Waterproof shoes for plantation walks', done: false },
    { id: 'p-coo-3', text: 'Insect repellent', done: false },
    { id: 'p-coo-4', text: 'A flask + ground coffee from the estate', done: false },
  ],
  pondicherry: [
    { id: 'p-pon-1', text: 'Cycle-friendly shoes for White Town', done: false },
    { id: 'p-pon-2', text: 'A swim cover for Auroville beach', done: false },
    { id: 'p-pon-3', text: 'SPF + a light hat', done: false },
    { id: 'p-pon-4', text: 'A long sleeve for the ashram', done: false },
  ],
  madurai: [
    { id: 'p-mad-1', text: 'A long sleeve + sarong for Meenakshi', done: false },
    { id: 'p-mad-2', text: 'Closed shoes you can take off easily', done: false },
    { id: 'p-mad-3', text: 'ORS + a refillable bottle (it is hot)', done: false },
    { id: 'p-mad-4', text: 'Cash for filter coffee + flowers', done: false },
  ],
  alleppey: [
    { id: 'p-all-1', text: 'Mosquito repellent + a long sleeve', done: false },
    { id: 'p-all-2', text: 'Swimwear + a quick-dry towel', done: false },
    { id: 'p-all-3', text: 'Power bank — houseboat sockets are rare', done: false },
    { id: 'p-all-4', text: 'Cash for backwater stops', done: false },
    { id: 'p-all-5', text: 'A dry-bag for canoe trips', done: false },
  ],
  // International packs.
  santorini: [
    { id: 'p-san-1', text: 'Reef-safe SPF + sunglasses', done: false },
    { id: 'p-san-2', text: 'Good sandals for caldera steps', done: false },
    { id: 'p-san-3', text: 'A light layer for the evening breeze', done: false },
    { id: 'p-san-4', text: 'EU plug adapter (Type C/F)', done: false },
  ],
  kyoto: [
    { id: 'p-kyo-1', text: 'Slip-on shoes (temples = shoes off)', done: false },
    { id: 'p-kyo-2', text: 'IC card (Suica/ICOCA) for trains', done: false },
    { id: 'p-kyo-3', text: 'A coin purse — cash is still king', done: false },
    { id: 'p-kyo-4', text: 'Type A plug adapter', done: false },
  ],
  bali: [
    { id: 'p-bal-1', text: 'A sarong for temple visits', done: false },
    { id: 'p-bal-2', text: 'Reef-safe SPF 50 + after-sun', done: false },
    { id: 'p-bal-3', text: 'Mosquito repellent', done: false },
    { id: 'p-bal-4', text: 'Scooter helmet + offline maps', done: false },
  ],
  maldives: [
    { id: 'p-mal-1', text: 'Snorkel mask + reef-safe SPF', done: false },
    { id: 'p-mal-2', text: 'A rash guard for long swims', done: false },
    { id: 'p-mal-3', text: 'Dry-bag for the seaplane / boat', done: false },
    { id: 'p-mal-4', text: 'USD cash for tips', done: false },
  ],
  paris: [
    { id: 'p-par-1', text: 'Comfortable walking shoes', done: false },
    { id: 'p-par-2', text: 'A smart layer for dinners', done: false },
    { id: 'p-par-3', text: 'Navigo / transit pass', done: false },
    { id: 'p-par-4', text: 'EU plug adapter', done: false },
  ],
  dubai: [
    { id: 'p-dub-1', text: 'Light, modest clothing for malls/mosques', done: false },
    { id: 'p-dub-2', text: 'SPF + sunglasses', done: false },
    { id: 'p-dub-3', text: 'A layer for fierce A/C', done: false },
    { id: 'p-dub-4', text: 'UK-style Type G plug adapter', done: false },
  ],
  interlaken: [
    { id: 'p-int-1', text: 'Layers + a waterproof shell', done: false },
    { id: 'p-int-2', text: 'Proper hiking shoes', done: false },
    { id: 'p-int-3', text: 'Sunglasses + SPF (glacier glare)', done: false },
    { id: 'p-int-4', text: 'Swiss Travel Pass / half-fare card', done: false },
  ],
  iceland: [
    { id: 'p-ice-1', text: 'Waterproof jacket + trousers', done: false },
    { id: 'p-ice-2', text: 'Thermal base layers + warm hat', done: false },
    { id: 'p-ice-3', text: 'Swimsuit (for the hot springs)', done: false },
    { id: 'p-ice-4', text: 'Eye mask (midnight sun) / aurora app', done: false },
  ],
  marrakech: [
    { id: 'p-mar-1', text: 'Modest, breathable clothing', done: false },
    { id: 'p-mar-2', text: 'A scarf for sun + dust', done: false },
    { id: 'p-mar-3', text: 'Small cash for the souks', done: false },
    { id: 'p-mar-4', text: 'Hand sanitiser + tissues', done: false },
  ],
  rome: [
    { id: 'p-rom-1', text: 'Comfortable shoes for cobbles', done: false },
    { id: 'p-rom-2', text: 'Shoulders/knees cover for churches', done: false },
    { id: 'p-rom-3', text: 'Refillable bottle (free nasoni taps)', done: false },
    { id: 'p-rom-4', text: 'EU plug adapter', done: false },
  ],
  bangkok: [
    { id: 'p-ban-1', text: 'Long sleeves + sarong for temples', done: false },
    { id: 'p-ban-2', text: 'Light, quick-dry clothing', done: false },
    { id: 'p-ban-3', text: 'Mosquito repellent + ORS', done: false },
    { id: 'p-ban-4', text: 'Cash for street food + tuk-tuks', done: false },
  ],
  cappadocia: [
    { id: 'p-cap-1', text: 'Warm layers for the dawn balloon', done: false },
    { id: 'p-cap-2', text: 'Sturdy shoes for valley hikes', done: false },
    { id: 'p-cap-3', text: 'SPF + sunglasses', done: false },
    { id: 'p-cap-4', text: 'Cash for cave-hotel extras', done: false },
  ],
};

/** Pick the starter pack for a destination slug, else the generic one.
 *  Returns a fresh copy so callers can mutate freely. */
export function starterForSlug(slug: string | undefined): ChecklistItem[] {
  if (slug === undefined) return [...STARTER];
  const hit = STARTER_PACKS[slug.toLowerCase()];
  return hit !== undefined ? [...hit] : [...STARTER];
}

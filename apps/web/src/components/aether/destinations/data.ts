/**
 * Phase 0 destination data — Aether destination detail pages.
 *
 * Six destinations, each with:
 *   • Hero photo (Unsplash id) + tagline
 *   • Three "what to know" facts (season / pace / budget)
 *   • Long-form lede (one editorial paragraph)
 *   • Five "moments" — small editorial cards under the lede
 *   • Three suggested itineraries (name + days + lede)
 *
 * Real CMS-backed content lands in Phase 2. Until then these
 * placeholders prove the editorial layout end-to-end.
 */

interface Photo {
  readonly id: string;
  readonly by: string;
  readonly alt: string;
}

export interface Moment {
  readonly title: string;
  readonly body: string;
  readonly photo: Photo;
}

export interface Itinerary {
  readonly name: string;
  readonly days: number;
  readonly lede: string;
}

export interface Destination {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
  readonly hero: Photo;
  readonly facts: ReadonlyArray<{ label: string; value: string }>;
  readonly lede: string;
  readonly moments: readonly Moment[];
  readonly itineraries: readonly Itinerary[];
}

export const DESTINATIONS: Record<string, Destination> = {
  jaipur: {
    slug: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    tagline: 'The pink city — forts, palaces, and a thousand windows.',
    hero: {
      id: '1599661046289-e31897846e41',
      by: 'Annie Spratt',
      alt: 'Hawa Mahal in Jaipur glowing pink at golden hour.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Heritage & craft' },
      { label: 'Budget', value: 'From ₹6k / day' },
    ],
    lede: 'Founded in 1727 and painted pink in 1876 for a visiting Prince of Wales, Jaipur is a working museum — the Amber and Nahargarh forts crown the desert ridges, the City Palace still hosts the descendants of its kings, and the bazaars of Johari and Bapu still sell the world its colour.',
    moments: [
      {
        title: 'Amber Fort at dawn',
        body: 'Arrive at 6:30am before the buses. The sandstone turns honey-gold, the elephants are at home.',
        photo: {
          id: '1477587458883-47465968ef79',
          by: 'Liam Baldock',
          alt: 'Amber Fort over the lake at dawn.',
        },
      },
      {
        title: 'Hawa Mahal up close',
        body: '953 lattice windows built for the queens — best seen from the chai shop opposite.',
        photo: { id: '1599661046289-e31897846e41', by: 'Annie Spratt', alt: 'Hawa Mahal lattice.' },
      },
      {
        title: 'Block-printing studios',
        body: 'Sanganer & Bagru villages, twenty minutes out. Two days with a master printer changes how you see fabric.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'Hand block printer at work.',
        },
      },
      {
        title: 'Dal-baati-churma at home',
        body: 'Skip the hotel buffet. Find a Marwari family who hosts dinners.',
        photo: { id: '1585937421612-70a008356fbe', by: 'Bimo Luki', alt: 'A Rajasthani thali.' },
      },
      {
        title: 'Sunset from Nahargarh',
        body: 'The whole pink city below, in three colours of fading light.',
        photo: {
          id: '1477587458883-47465968ef79',
          by: 'Liam Baldock',
          alt: 'Jaipur sunset from the hilltop fort.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Quick royal',
        days: 3,
        lede: 'Amber Fort + City Palace + Hawa Mahal + one block-printing day. Right pace for a long weekend.',
      },
      {
        name: 'Craft & cuisine',
        days: 5,
        lede: 'Add Sanganer, a cooking class in a Marwari home, and a half-day at the gem workshops in Johari.',
      },
      {
        name: 'Rajasthan loop',
        days: 12,
        lede: 'Jaipur → Pushkar → Jodhpur → Jaisalmer → Udaipur. The classic desert circuit.',
      },
    ],
  },
  alleppey: {
    slug: 'alleppey',
    name: 'Alleppey',
    state: 'Kerala',
    tagline: 'Houseboats, backwaters, and afternoons that refuse to end.',
    hero: {
      id: '1602216056096-3b40cc0c9944',
      by: 'Tom Vining',
      alt: 'A Kerala houseboat drifting through palm-lined backwaters.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Feb' },
      { label: 'Pace', value: 'Slow water, slower' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: 'The Venice of the East, the locals say, and the comparison nearly holds — except the canals are wider, the boats are roofed in coconut thatch, and the rhythm is half the speed. A kettuvallam houseboat for one night, paddy fields and toddy shops the rest.',
    moments: [
      {
        title: 'A kettuvallam overnight',
        body: 'Find one with a cook on board. Karimeen pollichathu (pearl spot in banana leaf) at dusk.',
        photo: { id: '1602216056096-3b40cc0c9944', by: 'Tom Vining', alt: 'Houseboat at dusk.' },
      },
      {
        title: 'Snake-boat racing season',
        body: 'August–September. Hundred rowers in perfect sync, drums beating, villages roaring.',
        photo: {
          id: '1593693411515-c20261bcad6e',
          by: 'Anirban Mahapatra',
          alt: 'Kerala water race.',
        },
      },
      {
        title: 'Toddy at a kallu shaap',
        body: 'Roadside palm-wine bars. Tapioca, fish curry, plastic chair. Pure Kerala.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A Kerala backwater shop.',
        },
      },
      {
        title: 'Marari beach reset',
        body: 'Twenty minutes from Alleppey town. Empty fishing villages, hammocks, no plans.',
        photo: {
          id: '1512100356356-de1b84283e18',
          by: 'Lewis J Goetz',
          alt: 'A quiet Kerala beach.',
        },
      },
      {
        title: 'Mundu & a temple morning',
        body: 'Borrow a mundu. Visit the Sree Krishna temple at 5am. The chants travel over the water.',
        photo: { id: '1561361398-a8f8d1f54bd1', by: 'Akshay Patil', alt: 'Temple at sunrise.' },
      },
    ],
    itineraries: [
      {
        name: 'The 36-hour float',
        days: 2,
        lede: 'One houseboat night, two long meals, an early morning paddle through the narrow canals.',
      },
      {
        name: 'Backwaters & beaches',
        days: 5,
        lede: 'Add Marari + Kumarakom. A full week of nothing, in the best possible way.',
      },
      {
        name: 'Kerala arc',
        days: 14,
        lede: 'Kochi → Alleppey → Munnar → Thekkady → Varkala. Hill stations and coast in one loop.',
      },
    ],
  },
  leh: {
    slug: 'leh',
    name: 'Leh',
    state: 'Ladakh',
    tagline: 'High monasteries, thin air, sky that goes on forever.',
    hero: {
      id: '1567619313084-90c11abfbe53',
      by: 'Suket Dedhia',
      alt: 'Buddhist prayer flags fluttering above a Ladakhi monastery.',
    },
    facts: [
      { label: 'Best season', value: 'Jun – Sep' },
      { label: 'Pace', value: 'Acclimatise · meditate' },
      { label: 'Budget', value: 'From ₹5k / day' },
    ],
    lede: 'At 11,500ft, Leh asks for two things before it gives anything back: time and stillness. Take 48 hours of doing nothing. The mountains will introduce themselves on day three — first the Stok range, then Khardung La, then the long valleys that lead to Nubra and Pangong.',
    moments: [
      {
        title: 'Thiksey at morning prayer',
        body: "5:30am, the conch shells call. Monks file in. You sit at the back. Don't bring a camera.",
        photo: {
          id: '1518002171953-a080ee817e1f',
          by: 'Sylwia Bartyzel',
          alt: 'Monks at morning prayer.',
        },
      },
      {
        title: 'Pangong Tso overnight',
        body: '4.5 hours from Leh. The lake changes colour ten times between sunrise and sunset.',
        photo: {
          id: '1567619313084-90c11abfbe53',
          by: 'Suket Dedhia',
          alt: 'Prayer flags by a high lake.',
        },
      },
      {
        title: 'Nubra Valley camel ride',
        body: 'Bactrian double-humps in the cold desert dunes. Diskit monastery looks down.',
        photo: {
          id: '1626621341517-bbf3d9990a23',
          by: 'Saurav Rastogi',
          alt: 'Cold desert mountains.',
        },
      },
      {
        title: 'Apricot harvest in Leh village',
        body: 'August. Roof drying. Apricot oil cold-pressed by hand. Tea with the family.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'Ladakhi home in the mountains.',
        },
      },
      {
        title: 'Khardung La pass',
        body: '17,582ft. Stay 15 minutes max. Drink the chai. Take the photo. Descend.',
        photo: {
          id: '1626621341517-bbf3d9990a23',
          by: 'Saurav Rastogi',
          alt: 'High mountain pass.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Leh proper',
        days: 5,
        lede: 'Acclimatise day 1-2. Thiksey + Hemis day 3. Day 4 Sangam + Magnetic Hill. Day 5 buffer.',
      },
      {
        name: 'Lakes & valleys',
        days: 8,
        lede: 'Add Pangong + Nubra. Two overnight excursions, one buffer day for altitude.',
      },
      {
        name: 'Trans-Himalayan',
        days: 14,
        lede: 'Manali → Leh by road (3 days). Full Ladakh loop including Tso Moriri. Bring layers.',
      },
    ],
  },
  anjuna: {
    slug: 'anjuna',
    name: 'Anjuna',
    state: 'Goa',
    tagline: 'Susegad — the art of doing nothing, perfected.',
    hero: {
      id: '1512100356356-de1b84283e18',
      by: 'Lewis J Goetz',
      alt: 'A quiet Goan beach at golden hour with palm trees and Portuguese houses.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Feb' },
      { label: 'Pace', value: 'Cafés & coast' },
      { label: 'Budget', value: 'From ₹3.5k / day' },
    ],
    lede: 'There is south Goa for stillness, north Goa for motion, and Anjuna which somehow holds both. The Wednesday flea market is still going forty years on. The cliffs at the south end of the beach are still the right place to watch sunset. The cafés have changed three generations of owners and held the same character.',
    moments: [
      {
        title: 'Wednesday flea market',
        body: 'Started by the hippies in the 60s. Now part bazaar, part festival. Go at noon. Stay till sundown.',
        photo: {
          id: '1596797038530-2c107229654b',
          by: 'Calvin Hanson',
          alt: 'A vibrant market with textiles and lamps.',
        },
      },
      {
        title: 'Curlies cliff at sunset',
        body: 'South end of Anjuna beach. Toes in sand, kingfisher in hand. The light does the rest.',
        photo: {
          id: '1512100356356-de1b84283e18',
          by: 'Lewis J Goetz',
          alt: 'Goan sunset on the beach.',
        },
      },
      {
        title: 'Saturday Night Market',
        body: 'Arpora, ten minutes north. Live music, food, every kind of person Goa attracts.',
        photo: { id: '1596797038530-2c107229654b', by: 'Calvin Hanson', alt: 'A market at night.' },
      },
      {
        title: 'Old Goa churches',
        body: 'Bom Jesus, Sé Cathedral. Portuguese baroque on the Mandovi river. Half a day.',
        photo: {
          id: '1512100356356-de1b84283e18',
          by: 'Lewis J Goetz',
          alt: 'Old Portuguese architecture.',
        },
      },
      {
        title: 'Spice plantation lunch',
        body: 'Tropical Spice Plantation in Ponda. Tour, banana-leaf thali, hammock in the shade.',
        photo: {
          id: '1592486058517-36236ba247c8',
          by: 'Madeleine Maguire',
          alt: 'A spice plantation.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Long weekend',
        days: 3,
        lede: 'Anjuna + Vagator. One sunset, one flea market, one boat trip. Fly Monday morning.',
      },
      {
        name: 'North & south',
        days: 7,
        lede: 'Anjuna for motion days 1-4, Palolem for slow days 5-7. The full Goan range.',
      },
      {
        name: 'Konkan coast',
        days: 12,
        lede: 'Mumbai → Alibaug → Gokarna → Goa → Karwar. The whole coastline at its slowest.',
      },
    ],
  },
  hampi: {
    slug: 'hampi',
    name: 'Hampi',
    state: 'Karnataka',
    tagline: 'A vanished empire in granite, scattered across a moon-like landscape.',
    hero: {
      id: '1561361513-2d000a50f0dc',
      by: 'Akshay Nanavati',
      alt: 'The carved stone temples of Hampi at dawn.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Feb' },
      { label: 'Pace', value: 'Ruins & rocks' },
      { label: 'Budget', value: 'From ₹3k / day' },
    ],
    lede: 'In 1500 Hampi was one of the largest cities on earth — capital of the Vijayanagara empire, half a million people, mango groves and elephant stables. In 1565 it was destroyed and emptied in five months. What remains is six hundred years of stone, dropped across thirty square kilometres of boulder-strewn landscape.',
    moments: [
      {
        title: 'Sunrise from Matanga Hill',
        body: 'Steep but short climb. Best view of the temple complex in the soft light.',
        photo: {
          id: '1561361513-2d000a50f0dc',
          by: 'Akshay Nanavati',
          alt: 'Hampi temple ruins at dawn.',
        },
      },
      {
        title: 'Vittala Temple stone chariot',
        body: 'The 16th-century musical pillars still ring when struck. The chariot is on every ₹50 note.',
        photo: {
          id: '1561361513-2d000a50f0dc',
          by: 'Akshay Nanavati',
          alt: 'A carved stone chariot.',
        },
      },
      {
        title: 'Coracle ride on the Tungabhadra',
        body: 'Round basket-boats. Local boatmen know every cave and shrine on the riverbank.',
        photo: {
          id: '1593693411515-c20261bcad6e',
          by: 'Anirban Mahapatra',
          alt: 'A river crossing.',
        },
      },
      {
        title: 'Anegundi village across the river',
        body: 'Pre-Vijayanagara settlement. Banana plantations, mud-walled homes. Stay the night.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A south Indian village.',
        },
      },
      {
        title: 'Bouldering at Hemakuta',
        body: "Hampi is one of India's great climbing landscapes. Crash pads + chai shops everywhere.",
        photo: { id: '1561361513-2d000a50f0dc', by: 'Akshay Nanavati', alt: 'Granite boulders.' },
      },
    ],
    itineraries: [
      {
        name: 'Hampi essential',
        days: 3,
        lede: 'Two days for the ruins, one for Anegundi village across the river. Bike rental + walking.',
      },
      {
        name: 'Stones & coast',
        days: 6,
        lede: 'Hampi 3 days + Gokarna 3 days. Heritage and beach in the same trip.',
      },
      {
        name: 'Deccan loop',
        days: 10,
        lede: 'Bangalore → Mysore → Belur/Halebid → Hampi → Badami. The Karnataka heritage spine.',
      },
    ],
  },
  varanasi: {
    slug: 'varanasi',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    tagline: 'The oldest living city on earth — best entered at dawn, from the river.',
    hero: {
      id: '1561361398-a8f8d1f54bd1',
      by: 'Akshay Patil',
      alt: 'Pilgrims at the Ganga ghats in Varanasi at sunrise.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Intense · spiritual' },
      { label: 'Budget', value: 'From ₹3k / day' },
    ],
    lede: 'Varanasi is older than recorded history — Mark Twain said older than tradition itself. The ghats meet the Ganga in a 6km arc; the cremation grounds at Manikarnika have burned without break for 3,000 years. It can break you and it can remake you. Best to arrive open.',
    moments: [
      {
        title: 'Dawn boat from Assi Ghat',
        body: 'Sun rises behind you, the city wakes up across the water, the bell rings on Dashashwamedh.',
        photo: {
          id: '1561361398-a8f8d1f54bd1',
          by: 'Akshay Patil',
          alt: 'A dawn boat on the Ganga.',
        },
      },
      {
        title: 'Ganga Aarti at Dashashwamedh',
        body: 'Every evening at sunset. Seven priests, fifty oil lamps, thousands of pilgrims. Bring a blanket.',
        photo: {
          id: '1561361398-a8f8d1f54bd1',
          by: 'Akshay Patil',
          alt: 'Oil lamps on the ghats.',
        },
      },
      {
        title: 'Banarasi sari workshop',
        body: 'Visit a master weaver. The art is in the hands. Most workshops welcome respectful visitors.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A weaver at a handloom.',
        },
      },
      {
        title: 'Sarnath day trip',
        body: '10km out. Where the Buddha gave his first sermon. Quiet stupas, the deer park, museum.',
        photo: {
          id: '1518002171953-a080ee817e1f',
          by: 'Sylwia Bartyzel',
          alt: 'A Buddhist monastery.',
        },
      },
      {
        title: 'Kachori-sabzi breakfast',
        body: "The Kashi Chat Bhandar near Godowlia. 5-rupee deep-fried glory. Don't skip.",
        photo: {
          id: '1545048702-79362596cdc9',
          by: 'Sandy Ravaloniaina',
          alt: 'An Indian street food vendor.',
        },
      },
    ],
    itineraries: [
      {
        name: 'The 48 hours',
        days: 2,
        lede: 'One dawn boat, one evening aarti, one walking tour of the back lanes. Sarnath if time allows.',
      },
      {
        name: 'Banaras deep',
        days: 5,
        lede: 'Add Sarnath, a weaver visit, an evening with the classical-music gharanas.',
      },
      {
        name: 'Ganga circuit',
        days: 10,
        lede: 'Lucknow → Ayodhya → Varanasi → Allahabad → Bodhgaya. Mughal & Buddhist arc.',
      },
    ],
  },
};

export const ALL_SLUGS: readonly string[] = Object.keys(DESTINATIONS);

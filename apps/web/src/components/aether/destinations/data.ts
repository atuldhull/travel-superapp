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
  mumbai: {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    tagline: 'A city of seven islands — bombay duck, art deco, monsoon rain.',
    hero: {
      id: '1570168007204-dfb528c6958f',
      by: 'Aniket Deole',
      alt: 'The Gateway of India at dusk with the Arabian Sea behind it.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Feb' },
      { label: 'Pace', value: 'Energy & art' },
      { label: 'Budget', value: 'From ₹5k / day' },
    ],
    lede: 'Bombay was seven fishing islands joined by Portuguese and British landfill, and the seams still show — Bandra was an island, Mahim was a swamp, Marine Drive was the sea. It is the only Indian city whose architecture argues with itself: Gothic Victoria Terminus, Art Deco Marine Drive, Indo-Saracenic Gateway, and the modern towers of BKC, all within an hour.',
    moments: [
      {
        title: 'Sunrise at Banganga Tank',
        body: 'A 12th-century stepwell in the middle of Walkeshwar. Brahmin priests still bathe at dawn.',
        photo: { id: '1561361398-a8f8d1f54bd1', by: 'Akshay Patil', alt: 'A stepwell at dawn.' },
      },
      {
        title: 'Kala Ghoda art walk',
        body: 'The southern crescent — Jehangir, NGMA, Rhythm House, Kitab Khana. Half a Saturday.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A South Bombay street.',
        },
      },
      {
        title: 'Bohri thal in Bhendi Bazaar',
        body: 'Eight people, one giant tray, eight courses, no cutlery. The most underrated meal in India.',
        photo: {
          id: '1585937421612-70a008356fbe',
          by: 'Bimo Luki',
          alt: 'A communal Indian feast.',
        },
      },
      {
        title: 'Bandra-Worli sea bridge at dusk',
        body: 'Drive both ways. The city skyline from the middle is unforgettable.',
        photo: { id: '1570168007204-dfb528c6958f', by: 'Aniket Deole', alt: 'A bridge at sunset.' },
      },
      {
        title: 'Elephanta Caves day trip',
        body: 'Catch the 9am ferry. The 6th-century rock-cut Shiva trimurti is the artistic highlight of western India.',
        photo: {
          id: '1561361513-2d000a50f0dc',
          by: 'Akshay Nanavati',
          alt: 'Ancient rock-cut sculpture.',
        },
      },
    ],
    itineraries: [
      {
        name: 'South Bombay weekend',
        days: 3,
        lede: 'Colaba causeway, Kala Ghoda, Marine Drive, the Bombay you imagined. Two iconic restaurants.',
      },
      {
        name: 'Bombay & the coast',
        days: 6,
        lede: 'Add Alibaug + Kashid for two beach days. The classic Bombayite weekender.',
      },
      {
        name: 'Maharashtra spine',
        days: 10,
        lede: 'Mumbai → Aurangabad (Ajanta + Ellora) → Pune → Mahabaleshwar. Heritage + hill stations.',
      },
    ],
  },
  coorg: {
    slug: 'coorg',
    name: 'Coorg',
    state: 'Karnataka',
    tagline: 'The Scotland of India — coffee, mist, and quiet hill folk.',
    hero: {
      id: '1571745544682-143ea663cf2c',
      by: 'Lazar Gugleta',
      alt: 'Coorg hill country covered in mist and coffee plantations.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Slow · misty' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: "Kodagu — the locals' name — is the smallest district in Karnataka and one of the most distinct cultures in India. The Kodavas have their own language, their own martial dance, their own dress, and they make 60% of India's coffee. Three valleys, a hundred homestays, weather that turns on a dime.",
    moments: [
      {
        title: 'A homestay in Madikeri',
        body: 'Skip the resorts. Stay with a Kodava family — pandhi curry for dinner, coffee at dawn.',
        photo: { id: '1571745544682-143ea663cf2c', by: 'Lazar Gugleta', alt: 'A misty hill home.' },
      },
      {
        title: 'Abbey Falls in monsoon',
        body: 'October overflows. Walk the 15 minutes from the road. Get drenched. Worth it.',
        photo: {
          id: '1593693411515-c20261bcad6e',
          by: 'Anirban Mahapatra',
          alt: 'A waterfall in monsoon.',
        },
      },
      {
        title: 'Coffee plantation tour at Kaapi Royale',
        body: 'See the bean from cherry to roast. Buy 2kg of single-origin arabica. Take it home.',
        photo: {
          id: '1545048702-79362596cdc9',
          by: 'Sandy Ravaloniaina',
          alt: 'Coffee beans and a cup.',
        },
      },
      {
        title: 'Talacauvery sunrise',
        body: 'The source of the Kaveri river. 4,500ft. Drive up in the dark — the temple opens at 5am.',
        photo: {
          id: '1571745544682-143ea663cf2c',
          by: 'Lazar Gugleta',
          alt: 'A hill temple at dawn.',
        },
      },
      {
        title: 'Dubare elephant camp',
        body: 'Forty minutes from Madikeri. Help bathe the rescued elephants in the river. Pure joy.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'An elephant in a river.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Coorg recharge',
        days: 3,
        lede: 'One homestay, three meals, a waterfall, a plantation walk. Phones away.',
      },
      {
        name: 'Coorg & coast',
        days: 7,
        lede: 'Hills first, then 4 hours west to Gokarna for beach reset. The full Karnataka exhale.',
      },
      {
        name: 'Western Ghats sweep',
        days: 12,
        lede: 'Bangalore → Coorg → Wayanad → Munnar → Thekkady → Periyar. Coffee + tea + cardamom country.',
      },
    ],
  },
  pondicherry: {
    slug: 'pondicherry',
    name: 'Pondicherry',
    state: 'Tamil Nadu',
    tagline: 'A French quarter on the Bay of Bengal — pastel walls, bouganvillea, sea breeze.',
    hero: {
      id: '1582625313996-0d4ad2c79ff3',
      by: 'Sankaranarayanan G',
      alt: 'The pastel French Quarter of Pondicherry with colonial architecture.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Café · pétanque · sea' },
      { label: 'Budget', value: 'From ₹3.5k / day' },
    ],
    lede: 'Pondichéry was French until 1954 and still keeps the rond-points, the police kepi, the bouganvillea, and a school where children learn French as a first language. Walk the White Town in the morning before the sun rises high. The Tamil Quarter on the other side of the canal is louder, older, and just as worth your hours.',
    moments: [
      {
        title: 'Sunrise at the Promenade',
        body: '5:30am. Joggers, the Gandhi statue, the rocks against the Bay of Bengal. Coffee at Le Café.',
        photo: {
          id: '1582625313996-0d4ad2c79ff3',
          by: 'Sankaranarayanan G',
          alt: 'Promenade at dawn.',
        },
      },
      {
        title: 'Auroville utopia',
        body: '10km north. The Matrimandir golden sphere, no money, no religion, an experiment in human unity.',
        photo: {
          id: '1567619313084-90c11abfbe53',
          by: 'Suket Dedhia',
          alt: 'A meditative sphere.',
        },
      },
      {
        title: 'Bouganvillea & croissants on Rue Romain Rolland',
        body: "Just walk. Café des Arts. Baker Street. The yellow walls catch every hour's light differently.",
        photo: {
          id: '1582625313996-0d4ad2c79ff3',
          by: 'Sankaranarayanan G',
          alt: 'Pastel French Quarter walls.',
        },
      },
      {
        title: 'A bicycle through the Tamil Quarter',
        body: 'Cross the canal. Temple bells, fish markets, kolam patterns at every door. The real Pondicherry.',
        photo: {
          id: '1561361398-a8f8d1f54bd1',
          by: 'Akshay Patil',
          alt: 'An old Tamil neighbourhood.',
        },
      },
      {
        title: 'Paradise Beach by ferry',
        body: 'Boat ride south. Empty beach, only-coconut-water rules, return at sunset.',
        photo: {
          id: '1512100356356-de1b84283e18',
          by: 'Lewis J Goetz',
          alt: 'A quiet southern beach.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Pondi weekend',
        days: 3,
        lede: 'Two nights in the White Town. One Auroville day. Long meals, sea breeze, cycle around.',
      },
      {
        name: 'East coast loop',
        days: 6,
        lede: 'Add Mahabalipuram (UNESCO shore temple) + Chennai. The Coromandel coast in one arc.',
      },
      {
        name: 'Tamil heritage',
        days: 12,
        lede: 'Chennai → Mahabalipuram → Pondicherry → Tanjavur → Madurai → Rameshwaram. Temple country.',
      },
    ],
  },
  spiti: {
    slug: 'spiti',
    name: 'Spiti',
    state: 'Himachal Pradesh',
    tagline: 'Trans-Himalayan high desert — fossil-strewn rivers, monasteries on cliffs.',
    hero: {
      id: '1606044466411-207e6e72b39e',
      by: 'Akshay Nanavati',
      alt: 'The barren Spiti Valley with snow peaks and a riverbed.',
    },
    facts: [
      { label: 'Best season', value: 'May – Oct' },
      { label: 'Pace', value: 'Remote · meditative' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: 'Spiti means "middle land" — the buffer between India and Tibet. Altitude 12,000ft minimum, 24 hours by road from anywhere, no chain hotels, no malls. What it offers is silence so deep you can hear your blood, monasteries that have run continuously for a thousand years, and the kind of stars no city dweller has ever seen.',
    moments: [
      {
        title: 'Key Monastery at dawn',
        body: 'Built in the 11th century, 13,500ft. Get there before the tourists. The puja begins at 6am.',
        photo: {
          id: '1518002171953-a080ee817e1f',
          by: 'Sylwia Bartyzel',
          alt: 'A Buddhist monastery on a cliff.',
        },
      },
      {
        title: "Chicham bridge — Asia's highest",
        body: "14,000ft, a slim suspension over a 300ft gorge. You drive across it. Don't look down.",
        photo: {
          id: '1626621341517-bbf3d9990a23',
          by: 'Saurav Rastogi',
          alt: 'High Himalayan road.',
        },
      },
      {
        title: 'Fossils at Langza village',
        body: 'Marine fossils in a high-altitude desert — Spiti was sea floor 100 million years ago.',
        photo: {
          id: '1606044466411-207e6e72b39e',
          by: 'Akshay Nanavati',
          alt: 'A high mountain village.',
        },
      },
      {
        title: 'Homestay in Kibber',
        body: "World's highest motorable village. Stay with a family. Eat thukpa. Watch the stars come out.",
        photo: {
          id: '1567619313084-90c11abfbe53',
          by: 'Suket Dedhia',
          alt: 'A Himalayan family home.',
        },
      },
      {
        title: 'Pin Valley snow leopard tracking',
        body: 'Feb–March only. Trained spotters, layered like a parka. Patience required. Reward, immense.',
        photo: {
          id: '1626621341517-bbf3d9990a23',
          by: 'Saurav Rastogi',
          alt: 'A snowy high valley.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Spiti loop short',
        days: 7,
        lede: 'Shimla → Kalpa → Tabo → Kaza → Chandratal → Manali. The classic 1,000km circuit.',
      },
      {
        name: 'Spiti deep',
        days: 10,
        lede: 'Add Pin Valley + Kibber + Komic + Hikkim. Time for actual immersion.',
      },
      {
        name: 'Himachal grand',
        days: 14,
        lede: 'Add Shimla, Kalpa, Manali at top and tail. The full Himachal arc, monastery to monastery.',
      },
    ],
  },
  darjeeling: {
    slug: 'darjeeling',
    name: 'Darjeeling',
    state: 'West Bengal',
    tagline: 'Tea gardens, a toy train, and Kanchenjunga at sunrise.',
    hero: {
      id: '1593348820055-1ca6db415be3',
      by: 'Abhishek Koli',
      alt: 'Mist over Darjeeling tea gardens with a colonial bungalow at sunrise.',
    },
    facts: [
      { label: 'Best season', value: 'Mar – Jun, Sep – Nov' },
      { label: 'Pace', value: 'Misty · contemplative' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: "Darjeeling sits at 6,700ft on a Himalayan ridge — close enough to Kanchenjunga that on a clear morning the world's third-highest peak is just there. The British built it as a sanatorium in 1835 because the air healed lung disease; the tea industry followed, and the narrow-gauge railway followed that. Three things ride together up the hill: the train, the mist, and a 188-year-old habit of slow afternoons.",
    moments: [
      {
        title: 'Tiger Hill sunrise',
        body: '4:30am alarm. 11km drive. 12,000-pilgrim viewpoint. When Kanchenjunga lights, nobody speaks.',
        photo: { id: '1593348820055-1ca6db415be3', by: 'Abhishek Koli', alt: 'Himalayan dawn.' },
      },
      {
        title: 'Toy Train Ghum loop',
        body: 'UNESCO since 1999. The blue-painted steam loco still climbs at 16km/h. Two-hour joyride.',
        photo: { id: '1626621341517-bbf3d9990a23', by: 'Saurav Rastogi', alt: 'Mountain train.' },
      },
      {
        title: 'Happy Valley Tea Estate tour',
        body: "Operating since 1854. Walk the bushes, watch the rolling room, taste a first-flush in the manager's bungalow.",
        photo: { id: '1571745544682-143ea663cf2c', by: 'Lazar Gugleta', alt: 'A tea garden.' },
      },
      {
        title: "Glenary's on Mall Road",
        body: 'A British bakery since 1885. Marbled rum cake, Darjeeling first flush, the only acceptable post-walk reward.',
        photo: {
          id: '1545048702-79362596cdc9',
          by: 'Sandy Ravaloniaina',
          alt: 'A bakery counter.',
        },
      },
      {
        title: 'Padmaja Naidu Zoo for the red panda',
        body: "The only successful red-panda breeding program in India. Best at 9am when they're active.",
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A Himalayan meadow.',
        },
      },
    ],
    itineraries: [
      {
        name: 'The hill long weekend',
        days: 3,
        lede: 'Tiger Hill sunrise, toy train loop, one tea estate, lots of bakery hours.',
      },
      {
        name: 'Tea & dzongs',
        days: 6,
        lede: 'Add Sikkim border + Rangit valley. Six gompas, three tea gardens, two passes.',
      },
      {
        name: 'Eastern Himalaya arc',
        days: 12,
        lede: 'Darjeeling → Kalimpong → Pelling → Gangtok → Lachung. The full ridgeline.',
      },
    ],
  },
  udaipur: {
    slug: 'udaipur',
    name: 'Udaipur',
    state: 'Rajasthan',
    tagline: 'The City of Lakes — palaces on water, Mewar light, the colour of dusk.',
    hero: {
      id: '1568797629192-5c34d4a4f54e',
      by: 'Anubhav Saxena',
      alt: 'The City Palace of Udaipur reflected in Lake Pichola at dusk.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Slow · royal' },
      { label: 'Budget', value: 'From ₹6k / day' },
    ],
    lede: "Founded by Maharana Udai Singh II in 1559 — after the third sack of Chittor finally convinced the Mewar court that hill-and-lake was harder to siege than fort-and-plain. Five centuries on, Lake Pichola still mirrors the City Palace, and the Mewar lineage (the world's oldest surviving royal family) still hosts dinners in it. Of all Rajasthan, Udaipur is the city you slow down for.",
    moments: [
      {
        title: 'Lake Pichola at sunset',
        body: 'Ferry from Bansi Ghat. Forty minutes around the lake. Jag Niwas (Taj Lake Palace) floats past.',
        photo: {
          id: '1568797629192-5c34d4a4f54e',
          by: 'Anubhav Saxena',
          alt: 'A lake palace at dusk.',
        },
      },
      {
        title: 'The City Palace by morning',
        body: '11 separate palaces, 4 courtyards. Get there at 9am, before the heat + the tour buses.',
        photo: {
          id: '1477587458883-47465968ef79',
          by: 'Liam Baldock',
          alt: 'Rajasthani palace architecture.',
        },
      },
      {
        title: 'A miniature painting class',
        body: 'Mewar school, 16th-century technique. Half a day with a master in his Brahmpol home.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A craftsperson at work.',
        },
      },
      {
        title: 'Bagore-ki-Haveli folk dance',
        body: 'Every evening at 7pm. Rajasthani folk: ghoomar, kathputli, the chari with seven brass pots on a head.',
        photo: { id: '1561361398-a8f8d1f54bd1', by: 'Akshay Patil', alt: 'A traditional dance.' },
      },
      {
        title: 'Saheliyon-ki-Bari at golden hour',
        body: 'The Garden of the Maidens. Lotus pools, marble pavilions, an audience of just you and a dozen pigeons.',
        photo: {
          id: '1599661046289-e31897846e41',
          by: 'Annie Spratt',
          alt: 'A formal Mughal garden.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Udaipur essential',
        days: 4,
        lede: 'City Palace, two lake rides, one folk dance, two long meals on a haveli rooftop.',
      },
      {
        name: 'Mewar arc',
        days: 8,
        lede: 'Add Kumbhalgarh fort + Ranakpur Jain temple + Eklingji. The full Mewar heritage spine.',
      },
      {
        name: 'Rajasthan loop',
        days: 14,
        lede: 'Udaipur → Jodhpur → Jaisalmer → Pushkar → Jaipur. The classic desert circuit.',
      },
    ],
  },
  madurai: {
    slug: 'madurai',
    name: 'Madurai',
    state: 'Tamil Nadu',
    tagline: 'The Athens of the East — 2,500 years of continuous temple worship.',
    hero: {
      id: '1582625313996-0d4ad2c79ff3',
      by: 'Sankaranarayanan G',
      alt: 'The towering gopuram of Meenakshi Amman Temple in Madurai at dawn.',
    },
    facts: [
      { label: 'Best season', value: 'Oct – Mar' },
      { label: 'Pace', value: 'Intense · spiritual' },
      { label: 'Budget', value: 'From ₹3k / day' },
    ],
    lede: 'Madurai is older than Athens. The Pandya kings ruled here from the 3rd century BCE. The Meenakshi Amman Temple — fourteen gopurams, the tallest 170 feet, every inch carved with 33,000 figures — has held a continuous puja for 2,500 years. The old city around it is a maze of jasmine markets, brass-pot kitchens, and chai shops that still cost ₹10.',
    moments: [
      {
        title: 'The 9pm Meenakshi closing puja',
        body: "Lord Sundareswarar is carried in a palanquin to Goddess Meenakshi's chamber. Drums, conch, every night for 800 years.",
        photo: {
          id: '1582625313996-0d4ad2c79ff3',
          by: 'Sankaranarayanan G',
          alt: 'A South Indian temple at night.',
        },
      },
      {
        title: 'Jasmine market at dawn',
        body: "East Veli Street, 5am. Madurai supplies most of India's jasmine garlands. Truckloads of white flowers.",
        photo: { id: '1596797038530-2c107229654b', by: 'Calvin Hanson', alt: 'A flower market.' },
      },
      {
        title: 'Thirumalai Nayakkar Palace',
        body: '1636. Half the original survives — but the half that stands is breathtaking. Roman arches in a Dravidian palace.',
        photo: {
          id: '1561361513-2d000a50f0dc',
          by: 'Akshay Nanavati',
          alt: 'Old palace architecture.',
        },
      },
      {
        title: 'Jigarthanda at Famous Jigarthanda',
        body: 'A 70-year-old shop on West Masi Street. Cooled milk, almond gum, ice cream. The only acceptable drink at 2pm.',
        photo: {
          id: '1585937421612-70a008356fbe',
          by: 'Bimo Luki',
          alt: 'Cold South Indian dessert.',
        },
      },
      {
        title: 'A weaver visit at Sungudi village',
        body: '15km out. Sungudi tie-dye saris have a Geographical Indication tag. The dyers work in family courtyards.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A weaver dyeing fabric.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Madurai immersive',
        days: 3,
        lede: 'Two temple evenings, one palace morning, one jasmine dawn, three Jigarthanda stops.',
      },
      {
        name: 'Temple trail',
        days: 7,
        lede: 'Add Rameshwaram + Thanjavur + Tiruchirappalli. The Chola heritage circuit.',
      },
      {
        name: 'Tamil deep',
        days: 12,
        lede: 'Chennai → Mahabalipuram → Tanjavur → Madurai → Rameshwaram → Kanyakumari. The full state.',
      },
    ],
  },
  bhuj: {
    slug: 'bhuj',
    name: 'Bhuj',
    state: 'Gujarat',
    tagline: 'The Great Rann of Kutch — a white salt desert that disappears in monsoon.',
    hero: {
      id: '1606044466411-207e6e72b39e',
      by: 'Akshay Nanavati',
      alt: 'The white salt flats of the Rann of Kutch under a full moon.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Feb (Rann Utsav)' },
      { label: 'Pace', value: 'Surreal · slow' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: "For eight months a year, the Rann is a salt flat — 30,000 km² of pure white, flat to the horizon, salt crystals on every footstep. For four months it's the Arabian Sea. The transition between the two — the dust storms, the flamingos arriving by the million, the herders driving their dromedaries across the crust — is the strangest landscape in India. The Rann Utsav from November to February makes it visitable; the rest of the year you need a permit and a guide who knows the salt.",
    moments: [
      {
        title: 'Full moon at White Rann',
        body: 'The salt mirrors the moon. The horizon disappears. You can walk for an hour and still be in the same view.',
        photo: {
          id: '1606044466411-207e6e72b39e',
          by: 'Akshay Nanavati',
          alt: 'White salt flats at night.',
        },
      },
      {
        title: 'Hodka village handicrafts',
        body: 'Banni grasslands, 60km from Bhuj. Live with a Meghwal family. Mirror embroidery, mud-and-mirror houses, camel milk.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A village craft demonstration.',
        },
      },
      {
        title: 'Flamingo City at Khadir',
        body: 'November–February. Half a million greater flamingos breed here. The largest flamingo gathering on earth.',
        photo: { id: '1593693411515-c20261bcad6e', by: 'Anirban Mahapatra', alt: 'Wetland birds.' },
      },
      {
        title: 'Aaina Mahal in Bhuj town',
        body: "The Hall of Mirrors. Survived two earthquakes. The Maharao's private chambers reopened in 2018.",
        photo: { id: '1599661046289-e31897846e41', by: 'Annie Spratt', alt: 'An ornate hall.' },
      },
      {
        title: 'Mandvi beach sunset',
        body: "Bhuj's coastal twin, 60km south. Vijay Vilas palace, a working dhow shipyard, an empty Arabian beach.",
        photo: { id: '1512100356356-de1b84283e18', by: 'Lewis J Goetz', alt: 'A coastal sunset.' },
      },
    ],
    itineraries: [
      {
        name: 'Rann weekend',
        days: 3,
        lede: 'Two nights at a Rann Utsav tent camp. One white-Rann full-moon walk. One craft village.',
      },
      {
        name: 'Kutch craft trail',
        days: 6,
        lede: 'Add Hodka + Nirona + Bhujodi. Bell-makers, lacquer, copper bells, mirror embroidery.',
      },
      {
        name: 'Gujarat arc',
        days: 12,
        lede: 'Ahmedabad → Bhuj → Junagadh → Somnath → Diu. Heritage + Gir lions + coast.',
      },
    ],
  },
  shillong: {
    slug: 'shillong',
    name: 'Shillong',
    state: 'Meghalaya',
    tagline:
      'The Scotland of the East — rock music, living root bridges, monsoon rain that ends the world.',
    hero: {
      id: '1593348820055-1ca6db415be3',
      by: 'Abhishek Koli',
      alt: 'Pine-clad hills around Shillong with monsoon clouds rolling in.',
    },
    facts: [
      { label: 'Best season', value: 'Mar – May, Oct – Nov' },
      { label: 'Pace', value: 'Music · forest · wet' },
      { label: 'Budget', value: 'From ₹4k / day' },
    ],
    lede: 'Cherrapunji, an hour south of Shillong, is the wettest place on earth. Mawsynram, the next valley over, is wetter. The hills are pine-and-cloud all year; the rivers cut limestone canyons that the Khasi people have woven living rubber-fig roots into bridges across for 500 years. Shillong itself is a small university town with a disproportionate rock-music scene — Bob Dylan & Beatles covers in every chai-stained café.',
    moments: [
      {
        title: 'A living root bridge at Nongriat',
        body: 'Cherrapunji → 3,500 steps down. Two bridges, one double-decker, both still growing. Stay the night, walk back at dawn.',
        photo: {
          id: '1567619313084-90c11abfbe53',
          by: 'Suket Dedhia',
          alt: 'A living-root forest bridge.',
        },
      },
      {
        title: 'Café Shillong on Police Bazaar',
        body: 'Live music every night. Half the bands you hear at Indian music festivals started on this stage.',
        photo: { id: '1545048702-79362596cdc9', by: 'Sandy Ravaloniaina', alt: 'A café interior.' },
      },
      {
        title: "Mawlynnong, Asia's cleanest village",
        body: '90km southeast. Bamboo dustbins in every yard. Stay at a Khasi homestay. Smoke-fish breakfast.',
        photo: {
          id: '1532375810709-75b1da00537c',
          by: 'Saurav Rastogi',
          alt: 'A clean hill village.',
        },
      },
      {
        title: 'Krang Suri falls',
        body: 'The turquoise pool. 100m drop. Cliff-jumping platforms at three heights. Best Apr–May before monsoon.',
        photo: {
          id: '1593693411515-c20261bcad6e',
          by: 'Anirban Mahapatra',
          alt: 'A turquoise waterfall pool.',
        },
      },
      {
        title: 'Don Bosco Centre for Indigenous Cultures',
        body: 'Two floors, eight major tribes of Northeast India, the most underrated museum in the country.',
        photo: {
          id: '1518002171953-a080ee817e1f',
          by: 'Sylwia Bartyzel',
          alt: 'A regional museum.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Shillong & Cherrapunji',
        days: 4,
        lede: 'Two days in Shillong, one root-bridge trek, one Mawlynnong overnight.',
      },
      {
        name: 'Seven Sisters lite',
        days: 8,
        lede: 'Add Kaziranga (rhinos) + Majuli (river island). Three states.',
      },
      {
        name: 'Full Northeast arc',
        days: 16,
        lede: 'Guwahati → Shillong → Kaziranga → Majuli → Tawang → Bomdila. The far-east loop.',
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

  // ─── International ─────────────────────────────────────────────────
  // Curated world destinations so the app isn't all-India. Same shape
  // as the domestic set. Photos are verified Unsplash ids (subject
  // checked) credited to Unsplash; <V2Photo> degrades to a royal
  // gradient if any ever fails to load. Budgets are honest local-
  // currency ballparks, not invented prices.
  santorini: {
    slug: 'santorini',
    name: 'Santorini',
    state: 'Greece',
    tagline: 'Whitewashed caldera villages perched above a drowned volcano.',
    hero: {
      id: '1570077188670-e3a8d69ac5ff',
      by: 'Unsplash',
      alt: 'Whitewashed Santorini houses cascading down the caldera cliffs at dusk.',
    },
    facts: [
      { label: 'Best season', value: 'May – Oct' },
      { label: 'Pace', value: 'Slow · cliffside' },
      { label: 'Budget', value: 'From €160 / day' },
    ],
    lede: 'Santorini is the rim of a volcano that blew its heart out 3,600 years ago — the caldera you sail into is the flooded crater, and the white villages of Oia and Fira cling to its 300-metre cliffs. The Aegean light bounces off whitewash and black-sand beaches until the whole island glows. Come for the sunset; stay for the volcanic wine.',
    moments: [
      {
        title: 'Sunset from Oia',
        body: 'The whole island turns to face the sea at 7pm. Arrive an hour early — or watch from a quieter terrace up in Imerovigli.',
        photo: {
          id: '1570077188670-e3a8d69ac5ff',
          by: 'Unsplash',
          alt: 'Santorini sunset over the caldera.',
        },
      },
      {
        title: 'Blue domes of Fira',
        body: 'The most photographed churches in Greece. Walk the caldera path at 8am, before the cruise crowds climb up from the old port.',
        photo: {
          id: '1613395877344-13d4a8e0d49e',
          by: 'Unsplash',
          alt: 'Blue-domed white church above the Aegean.',
        },
      },
      {
        title: 'Volcanic wine tasting',
        body: 'Assyrtiko grown in ash, vines coiled into baskets against the wind. Santo Wines for the view, Venetsanos for the cellar.',
        photo: {
          id: '1601581875309-fafbf2d3ed3a',
          by: 'Unsplash',
          alt: 'A Santorini waterfront village.',
        },
      },
      {
        title: 'Akrotiri & the Red Beach',
        body: "The Minoan town buried under ash in 1600 BC — Greece's own Pompeii — then a swim off the red volcanic cliffs.",
        photo: {
          id: '1601581875309-fafbf2d3ed3a',
          by: 'Unsplash',
          alt: 'Santorini volcanic coastline.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Caldera long weekend',
        days: 3,
        lede: 'Oia sunset, a Fira-to-Imerovigli cliff walk, one wine afternoon, one black-sand beach day.',
      },
      {
        name: 'Cyclades hop',
        days: 7,
        lede: 'Add Naxos + Paros by ferry. Beaches, mountain villages, and far fewer crowds than the rim.',
      },
      {
        name: 'Greece classic',
        days: 12,
        lede: 'Athens → Santorini → Milos → Crete. Antiquities, islands, and Mediterranean food at its best.',
      },
    ],
  },
  kyoto: {
    slug: 'kyoto',
    name: 'Kyoto',
    state: 'Japan',
    tagline: 'A thousand temples, ten thousand torii, and the slow art of the season.',
    hero: {
      id: '1545569341-9eb8b30979d9',
      by: 'Unsplash',
      alt: 'The Yasaka Pagoda glowing at dusk in the Higashiyama district of Kyoto.',
    },
    facts: [
      { label: 'Best season', value: 'Apr (sakura), Nov (koyo)' },
      { label: 'Pace', value: 'Contemplative · refined' },
      { label: 'Budget', value: 'From ¥18k / day' },
    ],
    lede: "Kyoto was Japan's capital for a thousand years, and it kept everything the rest of the country modernised away — 1,600 Buddhist temples, 400 Shinto shrines, geisha districts, imperial gardens, and a cuisine raised to ceremony. It rewards slowness: a single temple at dawn beats five at noon. Move with the season — cherry blossom in April, blazing maples in November.",
    moments: [
      {
        title: 'Fushimi Inari at dawn',
        body: 'Ten thousand vermilion torii up a sacred mountain. Start at 6:30am and you can walk the whole 4km loop nearly alone.',
        photo: {
          id: '1478436127897-769e1b3f0f36',
          by: 'Unsplash',
          alt: 'A tunnel of red torii gates at Fushimi Inari.',
        },
      },
      {
        title: 'A night in Gion',
        body: 'Wooden machiya teahouses, paper lanterns, the click of geta on stone. Be respectful — these are working streets, not a set.',
        photo: {
          id: '1493976040374-85c8e12f0c0e',
          by: 'Unsplash',
          alt: 'A lantern-lit old street in Kyoto at night.',
        },
      },
      {
        title: 'Arashiyama bamboo & maples',
        body: 'The towering bamboo grove at 8am, then Tenryu-ji temple garden — unchanged in its design since 1339.',
        photo: {
          id: '1624253321171-1be53e12f5f4',
          by: 'Unsplash',
          alt: 'A Japanese pagoda framed by autumn maples.',
        },
      },
      {
        title: 'Kaiseki dinner',
        body: 'A dozen tiny seasonal courses, each plated like a haiku. Book a counter seat and let the chef lead.',
        photo: {
          id: '1545569341-9eb8b30979d9',
          by: 'Unsplash',
          alt: 'The Yasaka pagoda at dusk.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Kyoto essential',
        days: 4,
        lede: 'Fushimi Inari, Arashiyama, the Higashiyama temple walk, one Gion evening, one kaiseki dinner.',
      },
      {
        name: 'Kansai loop',
        days: 8,
        lede: 'Add Nara (the deer + Todai-ji), Osaka street food, and a Koyasan temple-stay overnight.',
      },
      {
        name: 'Golden Route',
        days: 14,
        lede: 'Tokyo → Hakone → Kyoto → Osaka by Shinkansen. Neon, hot springs, temples, and Mt Fuji.',
      },
    ],
  },
  bali: {
    slug: 'bali',
    name: 'Bali',
    state: 'Indonesia',
    tagline: 'Rice terraces, cliff temples, and an island that runs on ceremony.',
    hero: {
      id: '1604999565976-8913ad2ddb7c',
      by: 'Unsplash',
      alt: 'A turquoise cove framed by green cliffs on the Bali coast.',
    },
    facts: [
      { label: 'Best season', value: 'Apr – Oct (dry)' },
      { label: 'Pace', value: 'Spiritual · tropical' },
      { label: 'Budget', value: 'From $60 / day' },
    ],
    lede: 'Bali is one small Hindu island in the largest Muslim nation on earth, and it has kept its own gods, its own calendar, and a daily rhythm of offerings woven from palm leaves. Ubud is the green, arty heart; the Bukit peninsula has the surf and the cliff temples; the north and east stay slow. Whatever you came for, the island asks you to slow to its pace.',
    moments: [
      {
        title: 'Tegallalang rice terraces',
        body: 'The subak irrigation here is a UNESCO-listed, 1,000-year-old cooperative system. Go at sunrise, before the swings and the buses.',
        photo: {
          id: '1604999565976-8913ad2ddb7c',
          by: 'Unsplash',
          alt: 'Green Bali landscape.',
        },
      },
      {
        title: 'Lempuyang — the Gates of Heaven',
        body: 'A split temple gate framing Mount Agung. Arrive before 7am or face a three-hour queue for the photo.',
        photo: {
          id: '1537953773345-d172ccf13cf1',
          by: 'Unsplash',
          alt: 'Two figures in a dramatic Balinese temple gateway.',
        },
      },
      {
        title: 'Uluwatu sunset & kecak',
        body: 'A 1,000-year-old temple on a 70-metre sea cliff, then the fire-and-chant kecak dance as the sun drops into the Indian Ocean.',
        photo: {
          id: '1518548419970-58e3b4079ab2',
          by: 'Unsplash',
          alt: 'A Balinese temple silhouette at sunset.',
        },
      },
      {
        title: 'A Nusa Penida day',
        body: 'Boat across to the cliffs of Kelingking and the natural infinity pool at Angel’s Billabong. Rough roads, unreal coastline.',
        photo: {
          id: '1604999565976-8913ad2ddb7c',
          by: 'Unsplash',
          alt: 'A turquoise Bali cove.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Ubud & the cliffs',
        days: 5,
        lede: 'Three Ubud days for rice fields + temples, two on the Bukit for surf, cliffs, and sunsets.',
      },
      {
        name: 'Bali & the islands',
        days: 8,
        lede: 'Add Nusa Penida + the Gili islands for snorkelling, turtles, and no motorbikes at all.',
      },
      {
        name: 'Indonesia arc',
        days: 14,
        lede: 'Bali → Komodo (the dragons + pink beach) → Flores. Volcanoes, reefs, and far-east villages.',
      },
    ],
  },
  maldives: {
    slug: 'maldives',
    name: 'Maldives',
    state: 'Maldives',
    tagline: 'Twelve hundred coral islands strung across the equator.',
    hero: {
      id: '1514282401047-d79a71a590e8',
      by: 'Unsplash',
      alt: 'Overwater villas above a turquoise Maldivian lagoon, seen from the air.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Apr (dry)' },
      { label: 'Pace', value: 'Barefoot · still' },
      { label: 'Budget', value: 'From $450 / day' },
    ],
    lede: 'The Maldives is the lowest-lying nation on earth — 1,192 coral islands averaging 1.5 metres above a sea that is the whole point of coming. The model is one-island-one-resort, but a quiet guesthouse revolution on the local islands has put the lagoons within reach of mortals. Either way the water does the work: it is the clearest, warmest, most reef-rich you will ever float in.',
    moments: [
      {
        title: 'Snorkel the house reef',
        body: 'Step off the deck into a wall of parrotfish, reef sharks, and the occasional manta. Most reefs are a swim, not a boat ride, away.',
        photo: {
          id: '1573843981267-be1999ff37cd',
          by: 'Unsplash',
          alt: 'Overwater villas on stilts above clear water.',
        },
      },
      {
        title: 'A night on the sandbank',
        body: 'Get dropped on a bare crescent of sand in the middle of the ocean with a picnic. Bioluminescent plankton glow in the surf after dark.',
        photo: {
          id: '1540202404-a2f29016b523',
          by: 'Unsplash',
          alt: 'A turquoise Maldivian lagoon.',
        },
      },
      {
        title: 'Manta & whale-shark drift',
        body: 'Baa Atoll (a UNESCO biosphere) in season is the best manta aggregation on the planet — dozens barrel-rolling through plankton.',
        photo: {
          id: '1514282401047-d79a71a590e8',
          by: 'Unsplash',
          alt: 'Aerial of a Maldives atoll.',
        },
      },
      {
        title: 'Local-island guesthouse',
        body: 'Maafushi or Dhigurah: the reef and sandbanks for a tenth of the resort price, plus a real island and its people.',
        photo: {
          id: '1573843981267-be1999ff37cd',
          by: 'Unsplash',
          alt: 'Maldivian water villas.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Barefoot week',
        days: 5,
        lede: 'One resort, the house reef every morning, a sandbank picnic, and absolutely nothing else.',
      },
      {
        name: 'Reef & local life',
        days: 7,
        lede: 'Split a local island for snorkelling + a resort for the finale. The honest, cheaper Maldives.',
      },
      {
        name: 'Liveaboard safari',
        days: 10,
        lede: 'A dive boat through the central atolls — channels, mantas, and a different reef every dawn.',
      },
    ],
  },
  paris: {
    slug: 'paris',
    name: 'Paris',
    state: 'France',
    tagline: 'The set-piece city — boulevards, ateliers, and an unending appetite.',
    hero: {
      id: '1502602898657-3e91760cbb34',
      by: 'Unsplash',
      alt: 'The Eiffel Tower rising above Parisian rooftops.',
    },
    facts: [
      { label: 'Best season', value: 'Apr – Jun, Sep – Oct' },
      { label: 'Pace', value: 'Walkable · indulgent' },
      { label: 'Budget', value: 'From €180 / day' },
    ],
    lede: "Haussmann rebuilt Paris in the 1850s into the city of wide boulevards and zinc rooftops we still walk today, and the city has been arguing with and adoring itself ever since. It is best taken on foot and by arrondissement — the Marais one day, the Left Bank the next — with long café sits in between. Don't try to see it all; choose a quarter and let it open up.",
    moments: [
      {
        title: 'The Louvre, then a garden',
        body: 'Go at opening, make for three things you actually want to see, and leave before noon for a sit in the Tuileries.',
        photo: {
          id: '1499856871958-5b9627545d1a',
          by: 'Unsplash',
          alt: 'The Pont Alexandre III bridge in Paris.',
        },
      },
      {
        title: 'Eiffel from Trocadéro',
        body: 'Cross the river at golden hour for the postcard, then picnic on the Champ de Mars when it sparkles on the hour after dark.',
        photo: {
          id: '1431274172761-fca41d930114',
          by: 'Unsplash',
          alt: 'The Eiffel Tower from the Trocadéro.',
        },
      },
      {
        title: 'A morning in the Marais',
        body: 'Falafel on Rue des Rosiers, the Picasso museum in a 17th-century hôtel particulier, and the Place des Vosges for lunch.',
        photo: {
          id: '1502602898657-3e91760cbb34',
          by: 'Unsplash',
          alt: 'Parisian rooftops and the Eiffel Tower.',
        },
      },
      {
        title: 'Latin Quarter bouquinistes',
        body: 'The green book-boxes along the Seine, Shakespeare & Company, and a Sorbonne-side café for the cheapest good coffee in town.',
        photo: {
          id: '1499856871958-5b9627545d1a',
          by: 'Unsplash',
          alt: 'A Parisian bridge over the Seine.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Paris in a weekend',
        days: 3,
        lede: 'One museum a day, one quarter a day, and two unhurried dinners. The city, not a checklist.',
      },
      {
        name: 'Paris & Versailles',
        days: 5,
        lede: 'Add a Versailles day + a Loire château or a Champagne tasting in Reims by fast train.',
      },
      {
        name: 'France in two weeks',
        days: 14,
        lede: 'Paris → Loire → Provence → the Côte d’Azur. Cities, vineyards, lavender, and the sea.',
      },
    ],
  },
  dubai: {
    slug: 'dubai',
    name: 'Dubai',
    state: 'UAE',
    tagline: 'A desert port that built the future, then put a beach under it.',
    hero: {
      id: '1512453979798-5ea266f8880c',
      by: 'Unsplash',
      alt: 'The Dubai skyline of glass towers at dusk.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Mar' },
      { label: 'Pace', value: 'Fast · sun · gloss' },
      { label: 'Budget', value: 'From $200 / day' },
    ],
    lede: 'Fifty years ago Dubai was a pearling town on a creek. Today it has the tallest building on earth, indoor ski slopes, and man-made islands shaped like palms — but the old city of gold souks and abra boats still runs along Dubai Creek, and an hour out, the empty red dunes begin. It is brash and it knows it, and it does a sunset over the desert better than almost anywhere.',
    moments: [
      {
        title: 'Top of the Burj Khalifa',
        body: '828 metres, the highest occupied floors on earth. Book the last slot before sunset and watch the city light up from above.',
        photo: {
          id: '1512453979798-5ea266f8880c',
          by: 'Unsplash',
          alt: "Dubai's skyline of glass towers.",
        },
      },
      {
        title: 'Desert dunes at dusk',
        body: 'A 4×4 over the red dunes, then a camp under the stars — falcons, a fire, and silence forty minutes from the towers.',
        photo: {
          id: '1546412414-e1885259563a',
          by: 'Unsplash',
          alt: 'The Dubai coast at dusk.',
        },
      },
      {
        title: 'Old Dubai by abra',
        body: 'Cross the Creek for a single dirham on a wooden water taxi, then haggle through the gold and spice souks of Deira.',
        photo: {
          id: '1546412414-e1885259563a',
          by: 'Unsplash',
          alt: 'Dubai by the water.',
        },
      },
      {
        title: 'A Friday brunch',
        body: 'The local institution — a long, lavish weekend feast. Pick one with a terrace and a view of the marina.',
        photo: {
          id: '1518684079-3c830dcef090',
          by: 'Unsplash',
          alt: 'The Burj Al Arab over the Gulf.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Dubai stopover',
        days: 3,
        lede: 'Burj Khalifa + fountains, an old-town souk morning, one desert-camp night, one beach day.',
      },
      {
        name: 'Emirates two-city',
        days: 6,
        lede: 'Add Abu Dhabi for the Sheikh Zayed Grand Mosque + Louvre Abu Dhabi, and a slower beach finale.',
      },
      {
        name: 'Gulf & mountains',
        days: 9,
        lede: 'Dubai → Hatta wadis → Ras Al Khaimah’s Jebel Jais. Dunes, mountain ziplines, and quiet coast.',
      },
    ],
  },
  interlaken: {
    slug: 'interlaken',
    name: 'Interlaken',
    state: 'Switzerland',
    tagline: 'Two lakes, three giants, and the cleanest air in Europe.',
    hero: {
      id: '1530122037265-a5f1f91d3b99',
      by: 'Unsplash',
      alt: 'A green Swiss alpine valley below snow-capped peaks.',
    },
    facts: [
      { label: 'Best season', value: 'Jun – Sep, Dec – Mar' },
      { label: 'Pace', value: 'Active · alpine' },
      { label: 'Budget', value: 'From CHF 220 / day' },
    ],
    lede: 'Interlaken sits in the saddle between two turquoise lakes, with the Eiger, Mönch and Jungfrau filling the southern sky. It is the gateway to the Bernese Oberland — a region of cogwheel trains, cliff-side villages, and the kind of valleys that turned the Alps into a verb. You come here to go up: by train to the Jungfraujoch, by cable car to Schilthorn, by your own feet anywhere at all.',
    moments: [
      {
        title: 'Up to the Jungfraujoch',
        body: 'The highest railway station in Europe at 3,454m — through the heart of the Eiger to a glacier, an ice palace, and the Aletsch.',
        photo: {
          id: '1527668752968-14dc70a27c95',
          by: 'Unsplash',
          alt: 'Snow-capped Swiss alpine peaks.',
        },
      },
      {
        title: 'Lauterbrunnen valley',
        body: 'Seventy-two waterfalls down sheer cliffs — the valley that inspired Tolkien’s Rivendell. Take the trail to Staubbach falls.',
        photo: {
          id: '1530122037265-a5f1f91d3b99',
          by: 'Unsplash',
          alt: 'A green Swiss valley below peaks.',
        },
      },
      {
        title: 'Grindelwald First',
        body: 'A cliff walk on a steel walkway, a mountain coaster, and paragliders launching off the meadow with the Eiger behind.',
        photo: {
          id: '1605540436563-5bca919ae766',
          by: 'Unsplash',
          alt: 'People in the snow in the Swiss Alps.',
        },
      },
      {
        title: 'Lake Brienz by boat',
        body: 'Impossibly turquoise glacial water — sail to Iseltwald and the Giessbach falls, reachable by Europe’s oldest funicular.',
        photo: {
          id: '1530122037265-a5f1f91d3b99',
          by: 'Unsplash',
          alt: 'A turquoise Swiss lake and valley.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Oberland in 4',
        days: 4,
        lede: 'Lauterbrunnen + Grindelwald, one big peak (Jungfraujoch or Schilthorn), one lake-boat afternoon.',
      },
      {
        name: 'Swiss rails',
        days: 7,
        lede: 'Add Lucerne + a leg of the Glacier Express to Zermatt and the Matterhorn. Trains are the trip.',
      },
      {
        name: 'Alpine grand tour',
        days: 12,
        lede: 'Zurich → Lucerne → Interlaken → Zermatt → Montreux. Peaks, lakes, chocolate, and lakeside vineyards.',
      },
    ],
  },
  iceland: {
    slug: 'iceland',
    name: 'Iceland',
    state: 'Iceland',
    tagline: 'Fire, ice, and a ring road around the edge of the habitable world.',
    hero: {
      id: '1504829857797-ddff29c27927',
      by: 'Unsplash',
      alt: 'A dark dramatic Icelandic peak rising beside cold coastal water.',
    },
    facts: [
      { label: 'Best season', value: 'Jun – Aug (sun), Sep – Mar (aurora)' },
      { label: 'Pace', value: 'Epic · elemental' },
      { label: 'Budget', value: 'From $250 / day' },
    ],
    lede: "Iceland sits on the seam where two continents pull apart, and it shows: geysers, lava fields, black beaches, and more waterfalls than anyone has counted. A single ring road, Route 1, circles the whole island in about 1,300km, and almost everything worth seeing is a short detour off it. In summer the sun barely sets; in winter the aurora takes the sky. Either way it doesn't feel quite like Earth.",
    moments: [
      {
        title: 'The Golden Circle',
        body: 'Thingvellir (where the continents split and the Vikings made law), the original Geysir, and the thundering Gullfoss — all in a day from Reykjavík.',
        photo: {
          id: '1476610182048-b716b8518aae',
          by: 'Unsplash',
          alt: 'A powerful Icelandic waterfall.',
        },
      },
      {
        title: 'South-coast waterfalls & black sand',
        body: 'Walk behind Seljalandsfoss, stand under Skógafoss, then the basalt columns and roaring surf at Reynisfjara beach.',
        photo: {
          id: '1531168556467-80aace0d0144',
          by: 'Unsplash',
          alt: 'A stark Icelandic landscape.',
        },
      },
      {
        title: 'A glacier lagoon',
        body: 'Jökulsárlón: icebergs calving off a glacier and drifting to the sea, then washing up on the Diamond Beach next door.',
        photo: {
          id: '1504829857797-ddff29c27927',
          by: 'Unsplash',
          alt: 'A dark Icelandic mountain by water.',
        },
      },
      {
        title: 'Chase the northern lights',
        body: 'Sep–Mar, away from town lights, on a clear dark night. Check the aurora forecast, then wait with a thermos and patience.',
        photo: {
          id: '1531168556467-80aace0d0144',
          by: 'Unsplash',
          alt: 'An Icelandic night landscape.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Reykjavík & the South',
        days: 5,
        lede: 'Golden Circle, the south-coast waterfalls, a glacier lagoon, and a Blue Lagoon soak to finish.',
      },
      {
        name: 'The Ring Road',
        days: 9,
        lede: 'The full Route 1 loop — east fjords, Mývatn’s geothermal north, and the Snæfellsnes peninsula.',
      },
      {
        name: 'Highlands & ice',
        days: 12,
        lede: 'Add a Landmannalaugar trek + a glacier hike or ice-cave tour. The interior the buses skip.',
      },
    ],
  },
  marrakech: {
    slug: 'marrakech',
    name: 'Marrakech',
    state: 'Morocco',
    tagline: 'A red walled city where the souk never quite sleeps.',
    hero: {
      id: '1597212618440-806262de4f6b',
      by: 'Unsplash',
      alt: 'The Koutoubia Mosque minaret above Marrakech at dusk.',
    },
    facts: [
      { label: 'Best season', value: 'Mar – May, Sep – Nov' },
      { label: 'Pace', value: 'Sensory · intense' },
      { label: 'Budget', value: 'From $70 / day' },
    ],
    lede: 'Marrakech has been a caravan city for a thousand years — the last big stop before the Atlas and the Sahara — and the medina still works like one. Inside the red walls it is all narrow lanes, hidden riads, and a souk that sells everything from lanterns to live chickens; outside, palm groves, the snow-topped Atlas, and the desert beyond. The Jemaa el-Fnaa square is the beating, chaotic heart of it all.',
    moments: [
      {
        title: 'Jemaa el-Fnaa after dark',
        body: 'By night the great square fills with food stalls, gnawa drummers, and storytellers. Eat where the locals queue; watch from a rooftop café.',
        photo: {
          id: '1597212618440-806262de4f6b',
          by: 'Unsplash',
          alt: 'The Koutoubia minaret over Marrakech.',
        },
      },
      {
        title: 'Lose yourself in the souks',
        body: 'Spice pyramids, dyers’ alleys, lantern-makers’ hammering. Haggle gently, accept the mint tea, and expect to get lost — that’s the point.',
        photo: {
          id: '1539020140153-e479b8c22e70',
          by: 'Unsplash',
          alt: 'An ornate Moroccan tiled archway and fountain.',
        },
      },
      {
        title: 'A riad & the Jardin Majorelle',
        body: 'Retreat from the noise into a courtyard riad, then the cobalt-blue garden Yves Saint Laurent saved, with its Berber museum.',
        photo: {
          id: '1539020140153-e479b8c22e70',
          by: 'Unsplash',
          alt: 'Moroccan tilework and arches.',
        },
      },
      {
        title: 'Atlas day trip',
        body: 'An hour out: Berber villages, a Toubkal-valley hike, and a tagine slow-cooked over coals with a mountain view.',
        photo: {
          id: '1597212618440-806262de4f6b',
          by: 'Unsplash',
          alt: 'Marrakech at golden hour.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Medina long weekend',
        days: 3,
        lede: 'Two nights in a riad, the souks + Jemaa el-Fnaa, the Majorelle garden, one Atlas-foothills day.',
      },
      {
        name: 'Cities & desert',
        days: 7,
        lede: 'Add a 2-night Sahara trip to Merzouga — camel trek into the dunes and a night in a desert camp.',
      },
      {
        name: 'Imperial Morocco',
        days: 12,
        lede: 'Marrakech → Fes → Chefchaouen → the coast at Essaouira. Medinas, mountains, and the blue city.',
      },
    ],
  },
  rome: {
    slug: 'rome',
    name: 'Rome',
    state: 'Italy',
    tagline: 'Three thousand years stacked on top of each other, all still in use.',
    hero: {
      id: '1552832230-c0197dd311b5',
      by: 'Unsplash',
      alt: 'The Colosseum in Rome lit warm at dusk.',
    },
    facts: [
      { label: 'Best season', value: 'Apr – Jun, Sep – Oct' },
      { label: 'Pace', value: 'Layered · delicious' },
      { label: 'Budget', value: 'From €150 / day' },
    ],
    lede: 'Rome is a city you read in cross-section: an ancient temple holding up a baroque church holding up a trattoria. The Forum and Colosseum are only the start — there are 280 fountains, two thousand years of art, and a whole sovereign country (the Vatican) inside it. Walk it slowly, eat carbonara where the Romans do, and accept that you will come back, because nobody sees Rome in one trip.',
    moments: [
      {
        title: 'Colosseum & the Forum',
        body: 'Book the first slot, add the arena-floor ticket, then walk down through the Roman Forum and up the Palatine where the emperors lived.',
        photo: {
          id: '1515542622106-78bda8ba0e5b',
          by: 'Unsplash',
          alt: 'The Colosseum of Rome.',
        },
      },
      {
        title: 'The Vatican at opening',
        body: 'St Peter’s, the Sistine Chapel, and the Raphael Rooms. Go early or book a late key-holder tour to beat the crush.',
        photo: {
          id: '1531572753322-ad063cecc140',
          by: 'Unsplash',
          alt: 'St Peter’s Square and the Vatican.',
        },
      },
      {
        title: 'Trastevere at night',
        body: 'Cobbled lanes, ivy, and the best casual dinners in the city. Cacio e pepe, a carafe of house red, and a passeggiata after.',
        photo: {
          id: '1552832230-c0197dd311b5',
          by: 'Unsplash',
          alt: 'The Colosseum lit at dusk.',
        },
      },
      {
        title: 'Pantheon & a gelato',
        body: 'The best-preserved building of antiquity, free to enter, its oculus open to the sky — then the city’s finest gelato two streets over.',
        photo: {
          id: '1515542622106-78bda8ba0e5b',
          by: 'Unsplash',
          alt: 'Ancient Roman architecture.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Rome in three',
        days: 3,
        lede: 'Ancient Rome day one, the Vatican day two, Trastevere + the centro on foot day three. Eat well throughout.',
      },
      {
        name: 'Rome, Florence & Venice',
        days: 8,
        lede: 'The classic triangle by fast train — Renaissance Florence and canal-bound Venice added to the capital.',
      },
      {
        name: 'Italy grand tour',
        days: 14,
        lede: 'Rome → Tuscany → Cinque Terre → the Amalfi Coast. Cities, hill towns, vineyards, and the sea.',
      },
    ],
  },
  bangkok: {
    slug: 'bangkok',
    name: 'Bangkok',
    state: 'Thailand',
    tagline: 'Golden temples, canal markets, and the best street food on earth.',
    hero: {
      id: '1528181304800-259b08848526',
      by: 'Unsplash',
      alt: 'The ornate golden spires of the Grand Palace in Bangkok.',
    },
    facts: [
      { label: 'Best season', value: 'Nov – Feb (cool, dry)' },
      { label: 'Pace', value: 'Frenetic · flavourful' },
      { label: 'Budget', value: 'From $55 / day' },
    ],
    lede: 'Bangkok runs on contrast: gilded temples beside neon malls, riverside slums beside sky bars, and a street-food scene so good UNESCO and Michelin both took notice. The Chao Phraya river and its canals are the old city’s spine — take a longtail boat down them at least once. Move by ferry and Skytrain, eat constantly, and let the heat set the pace.',
    moments: [
      {
        title: 'The Grand Palace & Wat Pho',
        body: 'The royal compound and the emerald Buddha, then the 46-metre reclining Buddha next door. Cover shoulders and knees; go at opening.',
        photo: {
          id: '1563492065599-3520f775eeed',
          by: 'Unsplash',
          alt: 'A golden Bangkok temple.',
        },
      },
      {
        title: 'Wat Arun at sunset',
        body: 'Cross the river by ferry to the Temple of Dawn, its porcelain-studded spire catching the last light. Best seen from a riverside bar opposite.',
        photo: {
          id: '1528181304800-259b08848526',
          by: 'Unsplash',
          alt: 'Bangkok temple spires.',
        },
      },
      {
        title: 'Street food on Yaowarat',
        body: 'Chinatown after dark — charcoal-grilled satay, boat noodles, mango sticky rice. Follow the longest local queues.',
        photo: {
          id: '1508009603885-50cf7c579365',
          by: 'Unsplash',
          alt: 'A neon-lit Bangkok night street.',
        },
      },
      {
        title: 'A floating-market morning',
        body: 'Damnoen Saduak or the quieter Amphawa: canals of paddle-boats selling fruit, noodles, and coconut ice cream. Get there early.',
        photo: {
          id: '1563492065599-3520f775eeed',
          by: 'Unsplash',
          alt: 'A Thai temple.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Bangkok in three',
        days: 3,
        lede: 'Palace + temples, a canal longtail, Chinatown street food, one rooftop bar, one market morning.',
      },
      {
        name: 'City, sea & ruins',
        days: 7,
        lede: 'Add the ancient capital of Ayutthaya by day trip, then fly south for two beach days on the islands.',
      },
      {
        name: 'Thailand classic',
        days: 12,
        lede: 'Bangkok → Chiang Mai (temples + elephants) → the southern islands. North, centre, and coast.',
      },
    ],
  },
  cappadocia: {
    slug: 'cappadocia',
    name: 'Cappadocia',
    state: 'Türkiye',
    tagline: 'A moonscape of fairy chimneys, cave churches, and a sky full of balloons.',
    hero: {
      id: '1641128324972-af3212f0f6bd',
      by: 'Unsplash',
      alt: 'Hot-air balloons rising over the rock formations of Cappadocia at dawn.',
    },
    facts: [
      { label: 'Best season', value: 'Apr – Jun, Sep – Oct' },
      { label: 'Pace', value: 'Surreal · slow' },
      { label: 'Budget', value: 'From $90 / day' },
    ],
    lede: 'Ten million years of ash and erosion carved central Anatolia into a landscape that looks invented — soft tufa rock shaped into spires, cones, and waves. People have lived inside it for millennia: cave homes, rock-cut churches frescoed in the Byzantine era, and whole underground cities that sheltered thousands. At dawn, a hundred balloons drift over the valleys, and it becomes the most photographed sunrise in the world for good reason.',
    moments: [
      {
        title: 'Balloons at sunrise',
        body: 'Up at 4am, into the basket as the sun comes over Göreme, a hundred other balloons floating with you above the fairy chimneys.',
        photo: {
          id: '1641128324972-af3212f0f6bd',
          by: 'Unsplash',
          alt: 'Balloons over Cappadocia at dawn.',
        },
      },
      {
        title: 'Göreme Open-Air Museum',
        body: 'A monastic valley of rock-cut churches, their interiors still bright with 1,000-year-old Byzantine frescoes.',
        photo: {
          id: '1641128324972-af3212f0f6bd',
          by: 'Unsplash',
          alt: 'Cappadocia rock formations.',
        },
      },
      {
        title: 'Down into Derinkuyu',
        body: 'An eight-level underground city that once hid 20,000 people, their livestock, and a church — carved straight down into the rock.',
        photo: {
          id: '1641128324972-af3212f0f6bd',
          by: 'Unsplash',
          alt: 'The Cappadocia valleys.',
        },
      },
      {
        title: 'A cave-hotel night',
        body: 'Sleep inside the rock in Ürgüp or Uçhisar, then watch the dawn balloons rise from your own carved-stone terrace.',
        photo: {
          id: '1641128324972-af3212f0f6bd',
          by: 'Unsplash',
          alt: 'Balloons over the Cappadocia landscape.',
        },
      },
    ],
    itineraries: [
      {
        name: 'Cappadocia in three',
        days: 3,
        lede: 'One balloon dawn, the Göreme churches, an underground city, a valley hike, a cave-hotel night.',
      },
      {
        name: 'Istanbul & Cappadocia',
        days: 7,
        lede: 'Pair the capital of empires — Hagia Sophia, the Blue Mosque, the Grand Bazaar — with the rock valleys.',
      },
      {
        name: 'Türkiye highlights',
        days: 12,
        lede: 'Istanbul → Cappadocia → Pamukkale’s travertines → the Aegean coast at Ephesus and Bodrum.',
      },
    ],
  },
};

export const ALL_SLUGS: readonly string[] = Object.keys(DESTINATIONS);

/**
 * Curated landing order for the /v2 marketing surface. The full
 * DESTINATIONS map has everything (and powers the detail pages); these
 * lists keep the landing balanced (India + world, alternating) and a
 * sensible length instead of dumping all ~29 cards at once.
 */
export const FEATURED_SLUGS: readonly string[] = [
  'santorini',
  'jaipur',
  'kyoto',
  'udaipur',
  'bali',
  'varanasi',
  'maldives',
  'leh',
  'paris',
  'alleppey',
  'dubai',
  'hampi',
];

/** Three signature "moments" highlighted in the Experiences strip. */
export const EXPERIENCE_SLUGS: readonly string[] = ['kyoto', 'santorini', 'leh'];

/** Two hero itineraries highlighted in the Journeys section. */
export const JOURNEY_SLUGS: readonly string[] = ['bali', 'udaipur'];

/** The curated international destinations (everything else is India) —
 *  powers the India / World filter on the /destinations catalog. */
export const INTERNATIONAL_SLUGS: readonly string[] = [
  'santorini',
  'kyoto',
  'bali',
  'maldives',
  'paris',
  'dubai',
  'interlaken',
  'iceland',
  'marrakech',
  'rome',
  'bangkok',
  'cappadocia',
];

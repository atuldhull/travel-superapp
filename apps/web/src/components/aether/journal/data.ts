/**
 * Aether journal articles — Phase 0 stubs with real editorial bones.
 *
 * Three articles, each with hero photo, kicker, title, dek (subtitle),
 * byline + read-time, and a few rich body paragraphs. Long enough to
 * read as a finished article, not lorem-ipsum.
 */

interface Photo {
  readonly id: string;
  readonly by: string;
  readonly alt: string;
}

export interface JournalArticle {
  readonly slug: string;
  readonly kicker: string;
  readonly title: string;
  readonly dek: string;
  readonly author: string;
  readonly readMins: number;
  readonly publishedOn: string;
  readonly hero: Photo;
  readonly body: ReadonlyArray<{ kind: 'p' | 'pull' | 'h2'; text: string }>;
}

export const JOURNAL_ARTICLES: Record<string, JournalArticle> = {
  'chai-at-first-light': {
    slug: 'chai-at-first-light',
    kicker: 'Field notes · Old Delhi',
    title: 'Chai at first light: a morning with the kulhad walas',
    dek: 'Before the city remembers itself, six hundred kulhad cups appear on the pavement outside Jama Masjid. We spent a week with the men who make them.',
    author: 'Aanya Sharma',
    readMins: 6,
    publishedOn: '14 Aug 2026',
    hero: {
      id: '1545048702-79362596cdc9',
      by: 'Sandy Ravaloniaina',
      alt: 'A street vendor in Old Delhi serving steaming chai into clay cups at dawn.',
    },
    body: [
      {
        kind: 'p',
        text: 'Old Delhi at 4:30am is a city you cannot recognise in daylight. The shutters of Chandni Chowk are closed. The pigeons have not yet stirred. The only motion is a slow procession of cycle-rickshaws ferrying flat trays — six hundred small clay cups, freshly fired at a kiln in Sitaram Bazaar, headed north toward the chai stalls of Jama Masjid.',
      },
      {
        kind: 'p',
        text: 'Mohammad Saleem has run his kiln for thirty-eight years. His father ran it before him. He fires the kulhads — the unglazed disposable clay cups that chai walas across the city use — at 700°C, in batches of three hundred, twice a day. Each one costs him ₹2 to make. He sells them at ₹2.50. The math, he says, has not been favourable for a decade.',
      },
      {
        kind: 'pull',
        text: '"The plastic cup ruined us. Then the plastic cup ruined the river. Now they tell us our cup is the future."',
      },
      {
        kind: 'p',
        text: "India banned single-use plastic in 2022, and the kulhad — once dismissed as primitive, then briefly displaced by polystyrene, then forgotten — has staged the quietest comeback in modern Indian commerce. Saleem's order book is full for the first time since 2008. His son, who left for engineering college in Pune, is back. They added a second kiln.",
      },
      { kind: 'h2', text: 'A cup that wants to be a river' },
      {
        kind: 'p',
        text: 'A kulhad is meant to be used once. You drink your chai, you throw it on the ground, it shatters, it returns to the soil it came from. The taste of clay-warmed milk is the entire point — the cup is part of the recipe. A glass cup serves you tea. A kulhad serves you place.',
      },
      {
        kind: 'p',
        text: "We followed Saleem's morning batch to a stall in Matia Mahal where Mohammad Naseeb has poured chai since 1979. Six taps of a brass jug, milk frothed against the inside of a steel pot, kulhads lined up in a row of forty. By 6am the shutters opposite are rolling up. By 7am the call to prayer is rolling out of the masjid. By 8am the cups are scattered on the road behind the stall, half-shattered, half-buried, beginning their slow return.",
      },
      { kind: 'p', text: 'The chai is ₹15. The kulhad is included. The morning is free.' },
    ],
  },
  'monks-of-hemis': {
    slug: 'monks-of-hemis',
    kicker: 'Pilgrim trail · Ladakh',
    title: 'How the monks of Hemis count the seasons',
    dek: 'At 12,000 feet, time bends. The Hemis Monastery has held one festival a year for four hundred years. We arrived at the wrong moment, which is to say, the right one.',
    author: 'Rohit Mehra',
    readMins: 9,
    publishedOn: '02 Jul 2026',
    hero: {
      id: '1518002171953-a080ee817e1f',
      by: 'Sylwia Bartyzel',
      alt: 'A monastery courtyard in the Himalayas with monks crossing in maroon robes.',
    },
    body: [
      {
        kind: 'p',
        text: "You don't arrive at Hemis. You acclimatise to it. The monastery sits in a side valley off the Indus, an hour's drive from Leh, at 12,000ft above sea level — the same altitude where commercial planes pressurise their cabins. The road, until 1974, did not exist. Pilgrims walked.",
      },
      {
        kind: 'p',
        text: 'I came in July, hoping to catch the Hemis Tsechu — the masked dance festival that draws thousands every year and is the only time the giant thangka, a 12m embroidered scroll of Padmasambhava, is unfurled in public. The festival had ended two days before I arrived. The thangka was rolled. The crowds were gone.',
      },
      {
        kind: 'pull',
        text: '"You came at the wrong time," the abbot said, smiling. "Which means you came at the right time."',
      },
      {
        kind: 'p',
        text: "What he meant is that the festival is only the public face of the year. The monastery's actual calendar is composed of a hundred smaller observances — full-moon pujas, summer retreats, the long winter of teaching that no tourist sees. Without the bus parties, the courtyard returns to its usual rhythm: thirty-six monks, two cooks, a stray dog, a hundred prayer wheels turning in the wind.",
      },
      { kind: 'h2', text: 'The shape of a day' },
      {
        kind: 'p',
        text: 'Dawn at Hemis begins at 4:30am with the conch. Tea is butter tea, salted, half-melted yak butter floating on top. Morning puja is two hours of chanting in the prayer hall — the deep harmonic throat-singing that travels through your sternum more than your ears. Then breakfast. Then study. Then chores. Then study. Then evening puja. Then bed by 8pm.',
      },
      {
        kind: 'p',
        text: 'I attended every puja for four days. I did not understand a word. I understood everything I needed to.',
      },
      {
        kind: 'p',
        text: 'On the fifth morning I left at dawn. The abbot, who had taken to calling me chela (student) when no one was listening, walked me to the gate. "Come back in winter," he said. "Hemis at minus thirty teaches you something Hemis at plus twenty cannot." I told him I would.',
      },
      { kind: 'p', text: 'I went home and booked a flight for February.' },
    ],
  },
  'vanishing-banarsi-loom': {
    slug: 'vanishing-banarsi-loom',
    kicker: 'Craft · Banaras',
    title: 'The vanishing language of the Benarasi loom',
    dek: 'Five hundred years ago, Banaras invented a way to weave gold into silk. The looms still run. The masters who read them are nearly gone.',
    author: 'Priya Iyer',
    readMins: 12,
    publishedOn: '21 May 2026',
    hero: {
      id: '1532375810709-75b1da00537c',
      by: 'Saurav Rastogi',
      alt: 'A weaver at a handloom in a sunlit Banaras workshop with gold thread.',
    },
    body: [
      {
        kind: 'p',
        text: 'In a low room behind the Adampura lanes of Varanasi, Mohammad Imran sits at a wooden handloom that his grandfather built in 1956. He is forty-three. He has been weaving since he was nine. The sari on his loom — a wedding piece, a deep magenta dupatta with peacock motifs in real gold thread — will take him eighteen weeks to finish. It will sell, eventually, for ₹85,000. He will see ₹14,000.',
      },
      {
        kind: 'p',
        text: 'The Banarasi sari is one of the oldest continuous textile traditions in the world. The kadwa technique — where each motif is hand-woven separately rather than printed or embroidered — was probably introduced by Persian weavers under Akbar in the 16th century. The patterns are read from a kalam (notation card) that the master hangs above the loom; the weaver translates each square into a sequence of warp lifts and weft passes, working from memory after the first hundred rows.',
      },
      {
        kind: 'pull',
        text: '"My grandfather could read fifty-four patterns. My father, thirty. I can read maybe eighteen. My son does not weave."',
      },
      {
        kind: 'p',
        text: 'There were 125,000 working handlooms in Varanasi in 1980. Today there are 25,000. The decline accelerated after 2003, when cheap Chinese-printed power-loom saris started selling at one-fifth the price under the same name. The government created a Geographical Indication tag in 2009, but enforcement is uneven and the imitations look real enough to most buyers.',
      },
      { kind: 'h2', text: 'What dies with a craft' },
      {
        kind: 'p',
        text: 'A handloom Banarasi takes nine times longer than a power-loom version and twenty times longer than a printed one. The difference is not visible until you have held both. Real silk has weight; real zari has temperature; real kadwa has a texture you can read with your fingers. The cheaper versions photograph identically. They feel like nothing.',
      },
      {
        kind: 'p',
        text: "Imran's loom faces a small window. Light enters at an angle, catches the gold, throws it back across the room. He works in silence. Occasionally he stops to drink water from a brass tumbler. His son, eleven, sits in the next room doing math homework — the maths that will take him out of this room and into a life Imran does not pretend to understand.",
      },
      {
        kind: 'p',
        text: 'When I asked Imran what he wanted, he thought for a long time. "I want the loom to outlive me," he said. "I do not need it to outlive my son."',
      },
    ],
  },
  'toy-train-climbs-at-the-speed-of-fog': {
    slug: 'toy-train-climbs-at-the-speed-of-fog',
    kicker: 'Field notes · Darjeeling',
    title: 'The toy train climbs at the speed of fog',
    dek: 'A 138-year-old narrow-gauge railway still hauls itself up the Himalayan ridge at sixteen kilometres an hour. We rode the morning loco and asked the engineer why nothing has changed.',
    author: 'Vihaan Iyer',
    readMins: 8,
    publishedOn: '11 Sep 2026',
    hero: {
      id: '1626621341517-bbf3d9990a23',
      by: 'Saurav Rastogi',
      alt: 'A Darjeeling Himalayan Railway steam loco climbing through morning fog.',
    },
    body: [
      {
        kind: 'p',
        text: "The Darjeeling Himalayan Railway opened in 1881. The British wanted Darjeeling — the new hill station that healed lung disease — connected to the plains, and the only way up was a 78-kilometre, 7,000-foot climb through forests too steep for a standard-gauge railway. So they built the world's first narrow-gauge mountain railway. Two feet between the rails. Z-reverses and loops where the grade was too sharp. Steam locomotives smaller than most modern SUVs.",
      },
      {
        kind: 'p',
        text: 'It has run almost continuously ever since. UNESCO declared it a World Heritage Site in 1999. Today four steam locomotives — the B-class No. 782, 791, 794, and 805 — still pull a daily joy-ride loop from Darjeeling to Ghum, the highest railway station in India at 7,407 feet. The diesel loco does the long-haul run to Siliguri. The steam locos do the heritage work.',
      },
      {
        kind: 'pull',
        text: '"Sixteen kilometres an hour is not slow," the engineer said, polishing brass. "It is the right speed for the mountain. The mountain decides."',
      },
      {
        kind: 'p',
        text: "I rode the 10:40am Joy Ride out of Darjeeling station on a Tuesday in October. The fog came in halfway up to Batasia Loop and stayed until we crossed Ghum. You couldn't see the next carriage. You could hear the whistle bouncing off the conifers. The smoke smelled of coal — proper coal, not the diesel substitute most heritage railways have switched to. The Darjeeling line still burns ₹40-a-kilogram Bengali coal, two tonnes per joy ride.",
      },
      { kind: 'h2', text: 'What nobody mentions in the brochures' },
      {
        kind: 'p',
        text: "The carriages are also 138 years old. They've been refurbished — fresh blue paint every two years, new windows when the old ones rattle out — but the underframes are original. The wood floor under the third-class bench in my carriage had a date stamped into it: 1908. The seat has held passengers continuously through both world wars, partition, four prime ministers, and a 2010 landslide that closed the line for six months.",
      },
      {
        kind: 'p',
        text: "The line is also losing money. The joy ride costs ₹1,500 (₹600 first-class on weekends — heated coaches, real food, a single-malt bar). It still runs at a loss; the Indian Railways subsidises the steam from the diesel's profits. There is constant pressure to retire the locos. Each one needs ₹8 crore of maintenance per decade. The argument that wins, every time, is that the railway is the line — without the steam, the heritage tag goes, and the entire tourism economy of Darjeeling town shifts. So the locos keep running.",
      },
      {
        kind: 'p',
        text: 'At Ghum, the train sits for fifteen minutes. The engineer climbs down, checks the firebox, drinks chai from a kulhad. Passengers wander to the war memorial at Batasia Loop. A snowfall of fog moves across the tracks. The conch from a roadside Buddhist temple cuts through it.',
      },
      {
        kind: 'p',
        text: 'The whistle calls everyone back. The brass bell rings twice. The loco breathes out steam in three deep huffs, then starts pulling. Sixteen kilometres an hour. The mountain decides.',
      },
    ],
  },
  'million-butter-lamps-meenakshi': {
    slug: 'million-butter-lamps-meenakshi',
    kicker: 'Pilgrim trail · Madurai',
    title: 'A million butter lamps at Meenakshi',
    dek: 'Every night for 800 years, the gods of Meenakshi Amman Temple have been put to bed in a procession of conch, drum, and palanquin. We stayed for five.',
    author: 'Sneha Krishnan',
    readMins: 10,
    publishedOn: '18 Aug 2026',
    hero: {
      id: '1582625313996-0d4ad2c79ff3',
      by: 'Sankaranarayanan G',
      alt: 'The gopuram of Meenakshi Amman Temple in Madurai lit at night.',
    },
    body: [
      {
        kind: 'p',
        text: "There are temples in India older than Meenakshi Amman. There are larger ones, richer ones, more famous ones. But there is no temple, anywhere in the world, where every single night for eight hundred years a procession has carried a sleeping god from his chamber to his wife's. The Pallaki Sevai begins at 9pm. The drums start. The conch shell calls. Two priests lift the palanquin holding Sundareswarar — Shiva, in his form as the Beautiful Lord — and walk him through three corridors, four courtyards, past 33,000 carved figures, to the chamber of his consort Meenakshi.",
      },
      {
        kind: 'p',
        text: 'He stays the night. At 5am the procession reverses. He returns to his own chamber. It happens every day. It has happened every day since at least the 14th century — the records go back that far; the practice is older.',
      },
      {
        kind: 'pull',
        text: '"The gods need to sleep too, my child," the priest said. "And they need to sleep with their wives. This is dharma."',
      },
      {
        kind: 'p',
        text: 'I came for one night. I stayed for five. The first night I stood in the back of the corridor and watched. The second night I asked a priest if I could walk in the procession — strangers can, if they ask kindly and stand at the back, but you have to keep up with the drums. The third night I made it to the front of the inner sanctum and saw the chamber doors close behind the palanquin. The fourth night I came at 4:45am to watch the reverse procession. The fifth night I stayed only for the conch.',
      },
      { kind: 'h2', text: 'A geography of devotion' },
      {
        kind: 'p',
        text: "Meenakshi is not Shiva's wife in the orthodox Hindu pantheon — that's Parvati. Meenakshi is a Pandyan queen who fought Shiva in battle, defeated him, then realised she had been fighting her destined husband. The Pandyan kings of Madurai are why this story exists; they wanted a goddess local to them, not borrowed from the Sanskrit-speaking north. So the temple grew around her — fourteen gopurams of which the southernmost is the tallest at 170 feet, all of them painted in colours so wild they look like a Pixar storyboard. Every gopuram has been re-plastered and repainted every 12 years since the 16th century; the Kumbhabhishekam ceremony marking each repaint takes 41 days.",
      },
      {
        kind: 'p',
        text: 'The temple holds 33,000 sculptures. Every panel tells a story — the marriage, the battle, the boons granted, the demons defeated. You could spend a year reading them and not finish. Most pilgrims spend two hours, do a circuit, and go home. The temple priests have a saying for this: "First time you come to look. Second time you come to see. Tenth time you come to know."',
      },
      {
        kind: 'p',
        text: 'I was at "look" stage. The man next to me at the Pallaki Sevai on night four was at "know." He stood with his eyes closed for most of it, listened, occasionally hummed along with the conch. He told me he had been coming for forty-three years. He stayed at the same hotel — the Pandian — every visit. His son was a doctor in Boston who came once a year and joined him for the night procession. The son was not religious. The son came because his father did, and because, the man said, "where else can you see a thing that has happened every night for eight hundred years?"',
      },
      {
        kind: 'p',
        text: 'I flew home on the morning of the sixth day. I am thirty-one years old. I have eight hundred years of nights ahead of me if I want them. I want them.',
      },
    ],
  },
  'walking-on-sea-of-salt': {
    slug: 'walking-on-sea-of-salt',
    kicker: 'Field notes · Kutch',
    title: 'Walking on a sea of salt',
    dek: 'For four months the Great Rann is the Arabian Sea. For the other eight, it is the strangest landscape in India — a flat white desert the size of a small country.',
    author: 'Maya Pradhan',
    readMins: 7,
    publishedOn: '24 Dec 2026',
    hero: {
      id: '1606044466411-207e6e72b39e',
      by: 'Akshay Nanavati',
      alt: 'Full moon over the white salt flats of the Rann of Kutch.',
    },
    body: [
      {
        kind: 'p',
        text: 'You arrive at the Rann on a road that becomes — at some point, without warning — a salt road. The asphalt ends, the white begins, and within a kilometre the salt is on all four sides and there is no horizon. Just sky meeting salt at an impossible flatness. It is the largest seasonal salt desert in the world. From October to May it is 30,000 square kilometres of dried crystal. From June to September it is the Arabian Sea, slowly seeping in through the Indus delta and the Gulf of Kachchh, drowning everything you walked on six months earlier.',
      },
      {
        kind: 'p',
        text: 'The Rann Utsav — the official tourism festival that opens the desert from November to February — has built an entire tent city near Dhordo village to make this surreal landscape visitable. AC tents, buffet dinners, camel rides, cultural shows. It works. It is also not the only way.',
      },
      {
        kind: 'pull',
        text: '"The Rann is not a desert," the local guide said. "A desert has no water. The Rann has only water. You are walking on the lid of a sea."',
      },
      {
        kind: 'p',
        text: 'I went on a full moon. The Utsav arranges full-moon walks; my guide Rashid offered an alternative — go after the festival closes, sleep in his Meghwal-village homestay, walk to the salt at 9pm without the lights of the camp. So I did. We took flashlights, then turned them off after the first kilometre. The moon was enough. The salt mirrored it. The horizon vanished.',
      },
      { kind: 'h2', text: 'A landscape that is also a livelihood' },
      {
        kind: 'p',
        text: "The Agariyas — salt farmers — work the Rann for those eight dry months. Each family digs a shallow well in October, pumps brine into rectangular evaporation pans, then waits for the sun to do its work. By February the pans hold loose salt crystals. By March the salt is being harvested by hand, scraped into mounds, loaded onto trucks. India produces 16% of the world's salt; 75% of that comes from Kutch; 100% of the labour comes from these families. They live in stilted tents on the salt for the harvest season, no shade, temperatures touching 50°C in May, until the monsoon arrives and floods everything they've built.",
      },
      {
        kind: 'p',
        text: 'Most tourists never see this. The Rann Utsav puts visitors a respectful distance from the working pans. Rashid took me at dawn the day after the moon walk. The Agariya we met had been working the same eight-hectare patch since he was twelve; he was now fifty-eight. His son worked the next patch. His grandson, eight years old, would inherit it. The salt is the inheritance. The salt is the work. The salt is the life.',
      },
      {
        kind: 'p',
        text: "On the way back to Bhuj town, we drove past flamingos — the second draw of the Rann after the moon. Half a million Greater Flamingos breed in Khadir island every winter; they look like a pink low-pressure system on the horizon. The road runs straight for forty kilometres without a single turn. The salt continues on both sides. Then, abruptly, the salt ends, the dust starts, and you're back in the inhabited world.",
      },
      {
        kind: 'p',
        text: 'I asked Rashid which season was better — the salt or the sea. He said, without hesitation, both. "You cannot know one without the other. Come back in July. I will show you the sea." I told him I would. I might.',
      },
    ],
  },
};

export const ALL_JOURNAL_SLUGS: readonly string[] = Object.keys(JOURNAL_ARTICLES);

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
};

export const ALL_JOURNAL_SLUGS: readonly string[] = Object.keys(JOURNAL_ARTICLES);

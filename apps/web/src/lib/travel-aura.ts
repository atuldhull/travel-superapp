/**
 * travel-aura — the "what kind of traveller are you" model.
 *
 * A short MCQ scores eight archetypes; the highest becomes the user's
 * **Travel Aura** — the identity the rest of the app personalises
 * around (recommendations, tone, the emotional UI later in the
 * roadmap). Pure + deterministic: option weights summed, arg-max with
 * a fixed tiebreak. No I/O here.
 *
 * Until the backend field lands (P1.3) the result + home location +
 * interests are kept in a localStorage "draft" so the flow is usable
 * end-to-end now and P1.3 just swaps the persistence seam.
 *
 * Installed for Phase 1 — Onboarding & Identity (traveller quiz).
 */

export type AuraId =
  | 'explorer'
  | 'luxury_nomad'
  | 'backpacker'
  | 'night_wanderer'
  | 'nature_hunter'
  | 'food_traveler'
  | 'silent_traveler'
  | 'extreme_adventurer';

export interface Aura {
  readonly id: AuraId;
  readonly name: string;
  readonly tagline: string;
  readonly blurb: string;
  readonly emoji: string;
  /** On-brand accent for the result card. */
  readonly accent: string;
}

export const AURAS: Record<AuraId, Aura> = {
  explorer: {
    id: 'explorer',
    name: 'The Explorer',
    tagline: 'Always one more corner to turn',
    blurb: 'You chase the unseen — backstreets, the next ridge, the place not in the guidebook.',
    emoji: '🧭',
    accent: '#cdab63',
  },
  luxury_nomad: {
    id: 'luxury_nomad',
    name: 'The Luxury Nomad',
    tagline: 'Wander, but make it refined',
    blurb: 'You roam the world without giving up comfort, design, and a very good coffee.',
    emoji: '🥂',
    accent: '#d8b56a',
  },
  backpacker: {
    id: 'backpacker',
    name: 'The Backpacker',
    tagline: 'Light bag, long road',
    blurb: 'Spontaneous and thrifty — hostels, night buses, and stories money can’t buy.',
    emoji: '🎒',
    accent: '#7bb39a',
  },
  night_wanderer: {
    id: 'night_wanderer',
    name: 'The Night Wanderer',
    tagline: 'The city begins after dark',
    blurb: 'Neon, rooftops, late markets and music — your best hours start at sunset.',
    emoji: '🌙',
    accent: '#8a7bd8',
  },
  nature_hunter: {
    id: 'nature_hunter',
    name: 'The Nature Hunter',
    tagline: 'Forests, peaks, and big skies',
    blurb: 'Trails over traffic. You measure a trip in sunrises and summits.',
    emoji: '🏔️',
    accent: '#6fae8e',
  },
  food_traveler: {
    id: 'food_traveler',
    name: 'The Food Traveler',
    tagline: 'You taste your way through a place',
    blurb: 'The map is a menu — street stalls, markets, and the table locals queue for.',
    emoji: '🍜',
    accent: '#e0934e',
  },
  silent_traveler: {
    id: 'silent_traveler',
    name: 'The Silent Traveler',
    tagline: 'Slow, calm, unhurried',
    blurb: 'You travel to breathe out — few plans, long mornings, quiet beautiful places.',
    emoji: '🤍',
    accent: '#9fb2c9',
  },
  extreme_adventurer: {
    id: 'extreme_adventurer',
    name: 'The Extreme Adventurer',
    tagline: 'If it’s not a little scary, why go',
    blurb: 'Dives, climbs, rapids, ridgelines — the adrenaline is the point.',
    emoji: '⚡',
    accent: '#e2705a',
  },
};

/** Fixed tiebreak priority when scores are equal. */
const PRIORITY: readonly AuraId[] = [
  'explorer',
  'nature_hunter',
  'food_traveler',
  'night_wanderer',
  'backpacker',
  'luxury_nomad',
  'extreme_adventurer',
  'silent_traveler',
];

export interface AuraOption {
  readonly label: string;
  readonly weights: Partial<Record<AuraId, number>>;
}
export interface AuraQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly AuraOption[];
}

export const AURA_QUESTIONS: readonly AuraQuestion[] = [
  {
    id: 'pace',
    prompt: 'Your ideal day on a trip is…',
    options: [
      {
        label: 'Up at dawn, a big plan, lots of ground covered',
        weights: { explorer: 2, nature_hunter: 1 },
      },
      {
        label: 'Slow morning, one beautiful thing, no rush',
        weights: { silent_traveler: 2, luxury_nomad: 1 },
      },
      { label: 'Quiet by day, alive after dark', weights: { night_wanderer: 2 } },
      { label: 'Whatever gets the heart racing', weights: { extreme_adventurer: 2 } },
    ],
  },
  {
    id: 'spend',
    prompt: 'Money on a trip is for…',
    options: [
      { label: 'Stretching it — more days, fewer comforts', weights: { backpacker: 2 } },
      { label: 'A few exceptional, beautiful experiences', weights: { luxury_nomad: 2 } },
      { label: 'Eating extremely well, everywhere', weights: { food_traveler: 2 } },
      {
        label: 'Gear and guides for the big stuff',
        weights: { extreme_adventurer: 2, nature_hunter: 1 },
      },
    ],
  },
  {
    id: 'place',
    prompt: 'Pick the view you’d travel furthest for…',
    options: [
      { label: 'A ridgeline at sunrise', weights: { nature_hunter: 2, explorer: 1 } },
      { label: 'A neon skyline at midnight', weights: { night_wanderer: 2 } },
      { label: 'A market full of food and noise', weights: { food_traveler: 2 } },
      { label: 'An empty beach and total silence', weights: { silent_traveler: 2 } },
    ],
  },
  {
    id: 'plan',
    prompt: 'How planned is your trip?',
    options: [
      { label: 'Loose — I’ll figure it out there', weights: { backpacker: 2, explorer: 1 } },
      { label: 'A curated, well-booked itinerary', weights: { luxury_nomad: 2 } },
      { label: 'A route, but room to chase detours', weights: { explorer: 2 } },
      { label: 'Built around one big adventure', weights: { extreme_adventurer: 2 } },
    ],
  },
  {
    id: 'company',
    prompt: 'You travel best…',
    options: [
      { label: 'Solo and quiet', weights: { silent_traveler: 2 } },
      { label: 'Meeting strangers along the way', weights: { backpacker: 2, night_wanderer: 1 } },
      { label: 'With people who’ll hike all day', weights: { nature_hunter: 2 } },
      {
        label: 'With people who’ll try anything',
        weights: { explorer: 1, food_traveler: 1, extreme_adventurer: 1 },
      },
    ],
  },
  {
    id: 'memory',
    prompt: 'The memory you want to keep is…',
    options: [
      { label: 'A place almost no one else found', weights: { explorer: 2 } },
      { label: 'A meal you still think about', weights: { food_traveler: 2 } },
      { label: 'A summit / a dive / a drop', weights: { extreme_adventurer: 2, nature_hunter: 1 } },
      {
        label: 'A calm you couldn’t find at home',
        weights: { silent_traveler: 2, luxury_nomad: 1 },
      },
    ],
  },
];

/** Score answered options → winning Aura (deterministic tiebreak). */
export function scoreAura(answers: Readonly<Record<string, number>>): AuraId {
  const tally = {} as Record<AuraId, number>;
  for (const q of AURA_QUESTIONS) {
    const pick = answers[q.id];
    if (pick == null) continue;
    const opt = q.options[pick];
    if (!opt) continue;
    for (const [k, v] of Object.entries(opt.weights)) {
      tally[k as AuraId] = (tally[k as AuraId] ?? 0) + (v ?? 0);
    }
  }
  let best: AuraId = 'explorer';
  let bestScore = -1;
  for (const id of PRIORITY) {
    const s = tally[id] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  return best;
}

export const TRAVEL_INTERESTS: readonly string[] = [
  'Beaches',
  'Mountains',
  'History & heritage',
  'Nightlife',
  'Food & markets',
  'Wildlife & nature',
  'Photography',
  'Wellness & calm',
  'Road trips',
  'Festivals & culture',
  'Adventure sports',
  'Architecture',
];

// ---------------------------------------------------------------------------
// Draft persistence bridge (localStorage). P1.3 swaps this for the API.
// ---------------------------------------------------------------------------

export interface AuraHome {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}
export interface AuraDraft {
  readonly aura: AuraId;
  readonly answers: Record<string, number>;
  readonly home: AuraHome | null;
  readonly interests: readonly string[];
  readonly savedAt: number;
}

const DRAFT_KEY = 'travel-aura-draft';

export function saveAuraDraft(d: AuraDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode — non-fatal, the flow still completes in-memory */
  }
}

export function getAuraDraft(): AuraDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as AuraDraft) : null;
  } catch {
    return null;
  }
}

/**
 * Demo Adventure-Diary fixtures — evocative entries + a derived
 * gamification profile + earned badges per author, so `/diary` and
 * the gamification HUD render full instead of an empty composer.
 *
 * Gamification numbers here are hand-set sensible demo values (not
 * the live `applyEntry` formula) — the seed writes Prisma directly
 * and a demo only needs believable, stable totals.
 */

export interface DemoDiaryEntry {
  readonly authorEmail: string;
  readonly title: string;
  readonly body: string;
  readonly mood: string;
  readonly aiAssisted: boolean;
  /** Whole days ago for entryDate + createdAt (stable ordering). */
  readonly daysAgo: number;
}

export interface DemoGamification {
  readonly userEmail: string;
  readonly totalPoints: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly entryCount: number;
  readonly aiAssistCount: number;
  readonly lastEntryDaysAgo: number;
  readonly badges: readonly string[];
}

export const DEMO_DIARY_ENTRIES: readonly DemoDiaryEntry[] = [
  {
    authorEmail: 'demo@travel.local',
    title: 'Sunrise over the Spiti pass',
    body: 'We left Manali at 4am in the dark. The road climbed forever, switchback after switchback, until the sky cracked open gold behind the ridgeline. Nobody in the jeep said a word for ten whole minutes. Some views earn silence.',
    mood: 'adventurous',
    aiAssisted: false,
    daysAgo: 6,
  },
  {
    authorEmail: 'demo@travel.local',
    title: 'Tea with a stranger in Kaza',
    body: 'A monk waved me into a tiny kitchen off the main lane. Butter tea, barley bread, and a conversation held entirely in gestures and laughter. I understood almost nothing and somehow everything.',
    mood: 'joyful',
    aiAssisted: true,
    daysAgo: 5,
  },
  {
    authorEmail: 'demo@travel.local',
    title: 'The long quiet drive down',
    body: 'Tired in the good way today. The mountains let us go gently — fewer hairpins, the river widening, prayer flags thinning out. You always notice the leaving more than the arriving.',
    mood: 'calm',
    aiAssisted: false,
    daysAgo: 4,
  },
  {
    authorEmail: 'demo@travel.local',
    title: 'Jaipur in pink and gold',
    body: 'Spent the morning lost on purpose inside the old city. Hawa Mahal at golden hour is exactly the cliché everyone promised, and I would do it again tomorrow.',
    mood: 'joyful',
    aiAssisted: true,
    daysAgo: 2,
  },
  {
    authorEmail: 'demo@travel.local',
    title: 'Last night, planning the next one',
    body: 'Sitting on a rooftop with a map and a chai, already plotting where the road goes after this. The diary is full; the itch is back.',
    mood: 'reflective',
    aiAssisted: false,
    daysAgo: 1,
  },
  {
    authorEmail: 'alice@travel.local',
    title: 'Backwaters at first light, Kerala',
    body: 'The houseboat slid through water so still it doubled the palms. A kingfisher, a fisherman, and absolutely nothing to hurry for.',
    mood: 'calm',
    aiAssisted: true,
    daysAgo: 3,
  },
  {
    authorEmail: 'alice@travel.local',
    title: 'Spice market overload',
    body: 'Cardamom, drying ginger, someone roasting coconut. I bought far too much and regret none of it.',
    mood: 'joyful',
    aiAssisted: false,
    daysAgo: 2,
  },
  {
    authorEmail: 'grace@travel.local',
    title: 'Lisbon, downhill all the way',
    body: 'Got the tram wrong twice and found the best pastel de nata of my life because of it. Travel rewards the lost.',
    mood: 'joyful',
    aiAssisted: true,
    daysAgo: 4,
  },
];

export const DEMO_GAMIFICATION: readonly DemoGamification[] = [
  {
    userEmail: 'demo@travel.local',
    totalPoints: 1240,
    currentStreak: 5,
    longestStreak: 9,
    entryCount: 5,
    aiAssistCount: 2,
    lastEntryDaysAgo: 1,
    badges: ['first_steps', 'pathfinder', 'co_author'],
  },
  {
    userEmail: 'alice@travel.local',
    totalPoints: 360,
    currentStreak: 2,
    longestStreak: 4,
    entryCount: 2,
    aiAssistCount: 1,
    lastEntryDaysAgo: 2,
    badges: ['first_steps'],
  },
  {
    userEmail: 'grace@travel.local',
    totalPoints: 110,
    currentStreak: 1,
    longestStreak: 1,
    entryCount: 1,
    aiAssistCount: 1,
    lastEntryDaysAgo: 4,
    badges: ['first_steps'],
  },
];

/** (ownerEmail, tripTitle) pairs to publish PUBLIC so /feed is full.
 *  Title must match a DEMO_TRIPS entry that is past/ended. */
// Must match a DEMO_TRIPS entry with status 'published'.
export const DEMO_PUBLICATIONS: ReadonlyArray<{
  readonly ownerEmail: string;
  readonly tripTitle: string;
}> = [
  { ownerEmail: 'demo@travel.local', tripTitle: 'Tokyo neighbourhoods' },
  { ownerEmail: 'demo@travel.local', tripTitle: 'Lisbon weekend' },
  { ownerEmail: 'alice@travel.local', tripTitle: 'Tbilisi nomad month' },
  { ownerEmail: 'bob@travel.local', tripTitle: 'Reykjavik northern lights' },
  { ownerEmail: 'carol@travel.local', tripTitle: 'Lisbon family trip' },
  { ownerEmail: 'premium@travel.local', tripTitle: 'CDMX with concierge' },
  { ownerEmail: 'dave@travel.local', tripTitle: 'Bangkok nomad week' },
];

/** Directed follow edges (followerEmail → followeeEmail). Followees
 *  all have a published trip so the "following" feed has content. */
export const DEMO_FOLLOWS: ReadonlyArray<{
  readonly followerEmail: string;
  readonly followeeEmail: string;
}> = [
  { followerEmail: 'demo@travel.local', followeeEmail: 'alice@travel.local' },
  { followerEmail: 'demo@travel.local', followeeEmail: 'bob@travel.local' },
  { followerEmail: 'demo@travel.local', followeeEmail: 'carol@travel.local' },
  { followerEmail: 'alice@travel.local', followeeEmail: 'demo@travel.local' },
  { followerEmail: 'bob@travel.local', followeeEmail: 'demo@travel.local' },
];

/**
 * Per-stop timing + crowd insight, derived from the AI plan prose.
 *
 * The planner now opens each beat with "(time, crowd)" — e.g.
 * "Afternoon (2pm, busy): Hawa Mahal …". This finds the stop's
 * mention in the prose and reads the nearest time + crowd word. When
 * the model didn't tag it, a deterministic heuristic fills in from
 * the place TYPE + visiting order (markets/temples/viewpoints have
 * well-known rhythms) — clearly an estimate, never live data ($0).
 *
 * Pure, deterministic, no I/O.
 */
export type Crowd = 'quiet' | 'moderate' | 'busy';

export interface StopInsight {
  /** Human time-of-day label, e.g. "Morning · ~9am". */
  readonly time: string;
  readonly crowd: Crowd;
  /** One-line "best time" tip. */
  readonly tip: string;
  /** True when parsed from the AI prose (vs. heuristic estimate). */
  readonly fromPlan: boolean;
}

const TIME_RE =
  /\b(\d{1,2})\s?(am|pm)\b|\b(early morning|morning|midday|noon|afternoon|evening|sunset|dusk|night|dawn)\b/i;
const CROWD_RE = /\b(quiet|peaceful|calm|moderate|busy|bustling|crowded|packed)\b/i;

const CROWD_NORM: Record<string, Crowd> = {
  quiet: 'quiet',
  peaceful: 'quiet',
  calm: 'quiet',
  moderate: 'moderate',
  busy: 'busy',
  bustling: 'busy',
  crowded: 'busy',
  packed: 'busy',
};

function prettyTime(raw: string): string {
  const m = raw.match(/^(\d{1,2})\s?(am|pm)$/i);
  if (m) {
    const h = Number(m[1]);
    const ap = m[2]!.toLowerCase();
    const part = ap === 'am' ? 'Morning' : h < 5 ? 'Afternoon' : h < 9 ? 'Evening' : 'Night';
    return `${part} · ~${h}${ap}`;
  }
  const w = raw.toLowerCase();
  if (w.includes('dawn') || w === 'early morning') return 'Early morning · ~7am';
  if (w === 'morning') return 'Morning · ~9am';
  if (w === 'midday' || w === 'noon') return 'Midday · ~12pm';
  if (w === 'afternoon') return 'Afternoon · ~3pm';
  if (w === 'evening') return 'Evening · ~6pm';
  if (w === 'sunset' || w === 'dusk') return 'Sunset · ~7pm';
  if (w === 'night') return 'Night · ~9pm';
  return 'Flexible';
}

// Heuristic crowd by place type when the model didn't say.
function typeCrowd(name: string): Crowd {
  const n = name.toLowerCase();
  if (/(market|bazaar|fort|palace|temple|ghat|beach|gate|tower|mahal)/.test(n)) return 'busy';
  if (/(museum|cathedral|church|square|bridge|jhula|park|plaza)/.test(n)) return 'moderate';
  if (/(viewpoint|miradouro|garden|lake|trail|hill|point|valley|ashram)/.test(n)) return 'quiet';
  return 'moderate';
}

const TIP: Record<Crowd, string> = {
  quiet: 'Usually calm — lovely any time.',
  moderate: 'Steady crowds — mid-morning is comfortable.',
  busy: 'Gets packed midday — go early or late.',
};

const ORDER_TIME = ['Morning · ~9am', 'Midday · ~12pm', 'Afternoon · ~3pm', 'Evening · ~6pm'];

/**
 * @param name  the stop name (as extracted)
 * @param plan  full AI prose
 * @param order 0-based visiting order (heuristic time fallback)
 */
export function insightFor(name: string, plan: string, order: number): StopInsight {
  const text = plan.replace(/\s+/g, ' ');
  const idx = text.toLowerCase().indexOf(name.toLowerCase());
  if (idx >= 0) {
    // Look just before the mention (the beat opener "(time, crowd)").
    const window = text.slice(Math.max(0, idx - 90), idx + name.length + 60);
    const tm = window.match(TIME_RE);
    const cm = window.match(CROWD_RE);
    if (tm || cm) {
      const crowd = cm ? (CROWD_NORM[cm[1]!.toLowerCase()] ?? 'moderate') : typeCrowd(name);
      return {
        time: tm ? prettyTime(tm[0]) : (ORDER_TIME[order % 4] ?? 'Flexible'),
        crowd,
        tip: TIP[crowd],
        fromPlan: true,
      };
    }
  }
  const crowd = typeCrowd(name);
  return {
    time: ORDER_TIME[order % 4] ?? 'Flexible',
    crowd,
    tip: TIP[crowd],
    fromPlan: false,
  };
}

export const CROWD_UI: Record<Crowd, { label: string; bars: number; cls: string }> = {
  quiet: { label: 'Quiet', bars: 1, cls: 'text-emerald-500' },
  moderate: { label: 'Moderate', bars: 2, cls: 'text-amber-500' },
  busy: { label: 'Busy', bars: 3, cls: 'text-orange-500' },
};

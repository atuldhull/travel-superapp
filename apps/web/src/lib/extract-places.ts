/**
 * Pull candidate place names out of the AI's free-prose itinerary so
 * they can be geocoded + pinned on the animated journey map.
 *
 * The plan is narrative text (Gemini), not structured data — so this
 * is a heuristic, deliberately conservative: it keeps a Title-Case
 * span only when it either CONTAINS a landmark keyword
 * (Ashram/Ghat/Temple/Market/…) or is introduced by a location cue
 * (at / in / to / near / around / visit / explore / see). Everything
 * else (sentence-initial verbs, "Day 2", weekday/month words, the
 * generic "Spend/Depart/Enjoy" openers) is dropped.
 *
 * Pure + deterministic — no I/O. Order preserved, de-duped, capped.
 */

const LANDMARK =
  /(ashram|ghat|temple|mandir|gurudwara|fort|palace|mahal|market|bazaar|bridge|jhula|lake|tso|beach|falls?|waterfall|park|garden|museum|caf[eé]|restaurant|square|gate|tower|church|mosque|monastery|gompa|stupa|pass|valley|hill|point|viewpoint|sanctuary|reserve|trail|dam|river|island|quarter|promenade|plaza|ghats|haveli|step ?well|bagh)\b/i;

const CUE =
  /\b(?:at|in|to|near|around|visit|visiting|explore|exploring|see|seeing|toward|towards|via|along|through)\s+$/i;

const STOP = new Set(
  [
    'day',
    'morning',
    'afternoon',
    'evening',
    'night',
    'spend',
    'depart',
    'begin',
    'start',
    'enjoy',
    'explore',
    'visit',
    'browse',
    'embrace',
    'experience',
    'arrive',
    'check',
    'finish',
    'end',
    'continue',
    'head',
    'take',
    'grab',
    'savor',
    'savour',
    'wander',
    'stroll',
    'relax',
    'unwind',
    'optional',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
    'you',
    'your',
    'the',
    'a',
    'an',
    'this',
    'that',
    'here',
    'there',
    'then',
    'next',
    'later',
    'finally',
    'perhaps',
    'consider',
  ].map((w) => w),
);

const TITLE_SPAN =
  // eslint-disable-next-line security/detect-unsafe-regex -- bounded {0,3} repetition over simple char classes; runs on plan text, no catastrophic backtracking
  /\b([A-Z][\p{L}'’.-]+(?:\s+(?:of|the|de|del|la|le|el|du|da|di|al|-)?\s*[A-Z][\p{L}'’.-]+){0,3})\b/gu;

export interface ExtractedPlace {
  /** Raw matched text, e.g. "Lakshman Jhula Market". */
  readonly name: string;
  /** 1-based visiting order across the whole plan. */
  readonly order: number;
}

/**
 * @param plan  the AI prose itinerary
 * @param city  the trip city (used by the caller to bias geocoding;
 *              also filtered out of results so we don't pin the city
 *              itself as a stop)
 * @param max   hard cap (Nominatim etiquette — we geocode each)
 */
export function extractPlaces(plan: string, city: string, max = 7): readonly ExtractedPlace[] {
  const text = plan.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return [];
  const cityLc = city.trim().toLowerCase();

  const seen = new Set<string>();
  const out: ExtractedPlace[] = [];

  for (const m of text.matchAll(TITLE_SPAN)) {
    const span = m[1]?.trim();
    if (!span || m.index === undefined) continue;
    const before = text.slice(Math.max(0, m.index - 14), m.index);
    const words = span.split(/\s+/);
    const lc = span.toLowerCase();

    // Reject: pure stopword, the city itself, or a lone capitalised word
    // that's neither a landmark nor cued by a location preposition.
    const allStop = words.every((w) => STOP.has(w.toLowerCase()));
    if (allStop) continue;
    if (lc === cityLc || cityLc.includes(lc) || lc.includes(cityLc)) continue;
    const hasLandmark = LANDMARK.test(span);
    const cued = CUE.test(before);
    if (!hasLandmark && !cued) continue;
    if (words.length === 1 && !hasLandmark) continue;

    const key = lc.replace(/[^\p{L}\p{N}]/gu, '');
    if (seen.has(key) || key.length < 3) continue;
    seen.add(key);
    out.push({ name: span, order: out.length + 1 });
    if (out.length >= max) break;
  }
  return out;
}

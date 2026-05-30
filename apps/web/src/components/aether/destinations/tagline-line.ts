/**
 * AE269 — pure builder for the destination card subtitle line.
 *
 * Hero card subtitles look like:
 *   "Ladakh · Cold high desert · In season Jun–Sep"
 *
 * Today this is concatenated with inline ternaries. Helper
 * canonicalises the segment order + middle-dot separators and
 * drops empty / falsy parts so the line never has a dangling
 * separator.
 */

export interface TaglineInputs {
  readonly state?: string | null;
  readonly tagline?: string | null;
  readonly inSeasonRange?: string | null;
}

const SEP = ' · ';

function nonEmpty(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

export function buildDestinationTagline(inputs: TaglineInputs): string {
  const segments: string[] = [];
  const state = nonEmpty(inputs.state);
  if (state !== null) segments.push(state);
  const tagline = nonEmpty(inputs.tagline);
  if (tagline !== null) segments.push(tagline);
  const season = nonEmpty(inputs.inSeasonRange);
  if (season !== null) segments.push(`In season ${season}`);
  return segments.join(SEP);
}

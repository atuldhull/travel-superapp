/**
 * AE171 — shared Aether date helpers.
 *
 * `asIso`, `fmtDate`, and `daysBetween` are duplicated across
 * journey-dashboard.tsx and trip-share-card.tsx (each with its own
 * tiny copy). Consolidating into one place means: (1) the orval
 * nullable-wrapped runtime values get coerced consistently, (2) we
 * can change locale rules in one edit, (3) tests can pin behaviour.
 */

/** Coerce orval's odd nullable union types (TripDtoStartsOn etc.)
 *  into a plain `string | null`. At runtime these fields are always
 *  ISO strings or null — the schema wrapper is a type-generation
 *  artefact. */
export function asIso(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Locale-aware short date (e.g. "May 30, 2026"); "—" for null/bad. */
export function fmtDate(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** AE186 — itinerary clock formatter. Inputs come in two shapes:
 *  • naked clock strings like "09:30:00" (most rows)
 *  • full timestamps (occasionally)
 *  We try Date parsing first when the input is long enough to be a
 *  timestamp, then fall back to a regex on the HH:MM head. Returns
 *  null on unrecognized input so callers can render nothing. */
export function fmtTime(v: unknown): string | null {
  const s = asIso(v);
  if (s === null) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && s.length > 8) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(s);
  if (match !== null) {
    const h = Number(match[1]);
    const m = match[2];
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  }
  return null;
}

/** AE187 — day-card header. "Mon · Jun 3" style. Returns "—" on
 *  null / unparseable so the UI never shows "Invalid Date". */
export function fmtDayHead(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const wk = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
}

/** Exclusive day count between two ISOs. (Jun 1 → Jun 3 = 2 days.)
 *  Returns null on null inputs or unparseable dates. Reverse range
 *  clamps to 0. */
export function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** AE195 — inclusive day count (both endpoints counted, share-card
 *  convention: Jun 3 → Jun 17 = 15 days). Returns null on bad input. */
export function inclusiveDaysBetween(a: unknown, b: unknown): number | null {
  const n = daysBetween(a, b);
  if (n === null) return null;
  return n + 1;
}

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

/** Inclusive day count between two ISOs (0 when either is null). */
export function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * AE424 — pure helpers for the Mirror Cmd+K "Investigate user"
 * forensic palette.
 *
 * Per docs/aether/02-surfaces.md §9 Mirror: "'Investigate user'
 * command (admin Cmd+K) → the user's entire context (trips, reviews,
 * audit-mentions, payments) assembles in real-time from the river
 * into a forensic dashboard."
 *
 * AE424 ships the palette + assembled dashboard shape + pure helpers.
 * The eventual integration with the real admin SDK hooks
 * (`useAdminUsersControllerSearch` + per-user payment / trip / review
 * lookups + audit-log filter) lands in AE424b once those endpoints
 * are wired together.
 */

/** A row in the search-suggestion list as the operator types in the
 *  palette. Each suggestion carries a stable user id + a display
 *  name + a one-line context tag (e.g. "23 trips · Mumbai"). */
export interface MirrorUserSuggestion {
  readonly id: string;
  readonly displayName: string;
  readonly contextTag: string;
}

/** The assembled forensic context for one user. Every field is
 *  optional because the real assembly happens async (trips load
 *  first, then reviews, then payments, then audit-mentions); the
 *  palette renders progressively as each block arrives. */
export interface MirrorInvestigation {
  readonly userId: string;
  readonly displayName: string;
  readonly trips: number;
  readonly reviews: number;
  readonly payments: number;
  readonly auditMentions: number;
  /** Free-form summary line shown above the metric blocks. */
  readonly summary: string;
  /** Most recent audit-mention timestamp (ISO). Null if there are
   *  no mentions yet. */
  readonly lastAuditedAt: string | null;
}

/** True when the keyboard event represents "open the investigation
 *  palette" — Cmd+K on macOS, Ctrl+K elsewhere. The Mirror shell
 *  wires this to the global `keydown` listener. */
export function isInvestigationHotkey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  if (event.key !== 'k' && event.key !== 'K') return false;
  return event.metaKey || event.ctrlKey;
}

/** Filter the suggestion list by the operator's query. Case-insensitive
 *  prefix or substring match on either id, displayName, or contextTag. */
export function filterUserSuggestions(
  suggestions: ReadonlyArray<MirrorUserSuggestion>,
  query: string,
): ReadonlyArray<MirrorUserSuggestion> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return suggestions;
  return suggestions.filter((s) => {
    return (
      s.id.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q) ||
      s.contextTag.toLowerCase().includes(q)
    );
  });
}

/** Highlight which substring of the suggestion's display name
 *  matches the operator's query. Returns the slice indices the
 *  component should bold; null when no match (used for id-only
 *  matches where the display-name highlight would be misleading). */
export function highlightRange(
  displayName: string,
  query: string,
): { readonly start: number; readonly end: number } | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return null;
  const idx = displayName.toLowerCase().indexOf(q);
  if (idx < 0) return null;
  return { start: idx, end: idx + q.length };
}

/** Format a count for the forensic dashboard tile. 0 → "—" so empty
 *  blocks don't read as "I loaded zero" but as "I haven't loaded yet
 *  / nothing to show". Larger counts use thousand-separator. */
export function formatInvestigationCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (!Number.isFinite(n)) return '—';
  if (n <= 0) return '—';
  return n.toLocaleString();
}

/** Decide the severity tier for the user being investigated based on
 *  audit-mention density. The palette uses this to tint the title
 *  card so the operator sees "this user has had attention" at a
 *  glance. */
export type MirrorInvestigationSeverity = 'low' | 'medium' | 'high';
export function investigationSeverity(audits: number): MirrorInvestigationSeverity {
  if (!Number.isFinite(audits)) return 'low';
  if (audits >= 6) return 'high';
  if (audits >= 2) return 'medium';
  return 'low';
}

/** sr-friendly summary string the palette announces via aria-live
 *  when an investigation lands. */
export function investigationAnnouncement(inv: MirrorInvestigation | null): string {
  if (inv === null) return 'Investigation closed';
  return `Investigation: ${inv.displayName} — ${inv.trips} trips, ${inv.reviews} reviews, ${inv.payments} payments, ${inv.auditMentions} audit mentions`;
}

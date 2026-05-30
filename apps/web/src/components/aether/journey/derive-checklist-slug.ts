/**
 * AE149 — pure helper extracted from journey-dashboard.tsx (AE114).
 *
 * Given a trip title, return the curated Atlas/destination slug that
 * appears in it (case-insensitive substring), or undefined if no slug
 * matches. The journey dashboard uses this to pick a per-destination
 * starter pack for `<TripChecklist/>`. Phase 1 will move this server-
 * side once the trip → destination edge is a first-class relation.
 */

/** Order matters because the longer "darjeeling" must beat the
 *  substring "varanasi" → "an" → ambiguity if we ever shorten one.
 *  Today every slug is unambiguous; keep the order stable so the
 *  match is deterministic. */
export const CHECKLIST_DEST_SLUGS = [
  'leh',
  'spiti',
  'darjeeling',
  'shillong',
  'jaipur',
  'udaipur',
  'bhuj',
  'varanasi',
  'mumbai',
  'anjuna',
  'hampi',
  'coorg',
  'pondicherry',
  'madurai',
  'alleppey',
] as const;

export type ChecklistDestSlug = (typeof CHECKLIST_DEST_SLUGS)[number];

export function deriveChecklistSlug(
  title: string | null | undefined,
): ChecklistDestSlug | undefined {
  if (typeof title !== 'string' || title.trim() === '') return undefined;
  const haystack = title.toLowerCase();
  return CHECKLIST_DEST_SLUGS.find((s) => haystack.includes(s));
}

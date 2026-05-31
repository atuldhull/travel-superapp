/**
 * AE164 — pure parser for the AE148 TripChecklist JSON import.
 *
 * Accepts either the AE119 download shape `{items: ChecklistItem[]}`
 * or the raw array `ChecklistItem[]`. Validates every item structurally
 * (id/text/done all of the right primitive type) and returns the
 * sanitized array. Returns null when the payload is not recognizable.
 *
 * Extracted from `trip-checklist.tsx`'s `onImportFile` so the JSON
 * branch can be unit-tested without a FileReader / DOM stub.
 */
import { safeJsonParse } from '../../../lib/safe-json-parse';
import type { ChecklistItem } from './trip-checklist';

export function parseChecklistBackup(raw: string): ChecklistItem[] | null {
  // AE308 — replaces try/JSON.parse with the canonical safe parser.
  const parsed = safeJsonParse<unknown>(raw, null);
  if (parsed === null) return null;
  const itemsCandidate =
    parsed !== null && typeof parsed === 'object' && 'items' in parsed
      ? (parsed as { items: unknown }).items
      : parsed;
  if (!Array.isArray(itemsCandidate)) return null;
  const items = itemsCandidate.filter(
    (it): it is ChecklistItem =>
      typeof it === 'object' &&
      it !== null &&
      typeof (it as ChecklistItem).id === 'string' &&
      typeof (it as ChecklistItem).text === 'string' &&
      typeof (it as ChecklistItem).done === 'boolean',
  );
  return items.length > 0 ? items : null;
}

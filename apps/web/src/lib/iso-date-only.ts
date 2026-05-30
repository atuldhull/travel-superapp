/**
 * AE233 — local-date YYYY-MM-DD extractor.
 *
 * Used by AE188 backup filenames + AE143 weekKey + AE195 trip-share-
 * card date math. Each composes the date string locally from
 * getFullYear / getMonth / getDate fields, NOT toISOString().slice(0, 10)
 * — the IST timezone shifts UTC midnights into the previous day, so
 * users would see "yesterday's" filename / week. Documented in AE143.
 *
 * Pure helper:
 *   - Date input → local 'YYYY-MM-DD'
 *   - ISO string input → local 'YYYY-MM-DD' (uses Date parse path)
 *   - invalid input → null (no silent corruption)
 *
 * NOT toISOString().slice(0,10) — that one returns the UTC date.
 */

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function isoDateOnly(input: Date | string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear().toString().padStart(4, '0');
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * AE188 — shared filename builder for Aether JSON backups (AE119,
 * AE131, AE140 all download `aether-<scope>-<YYYY-MM-DD>.json`).
 *
 * Centralising the rule means a future "include time" or "include
 * username" change only touches one file. Date defaults to "now" but
 * is injectable for testability.
 */

/** Pure builder. `scope` is the descriptor (e.g. `checklist-<tripId>`,
 *  `pulse-history`, `my-data`); `now` defaults to the current time. */
export function backupFilename(scope: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  // Trim accidental leading/trailing whitespace; replace runs of
  // unsafe chars with a single dash. The scope SHOULD already be
  // safe-shaped at the call site, but be defensive.
  const safeScope = scope
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `aether-${safeScope}-${iso}.json`;
}

/**
 * AE322 — pure builder for the AE113 "copy as bullets" feature.
 *
 * Used to live as `asBullets()` inside `<TripChecklist/>`. Hoisting
 * makes the format unit-testable + reusable (a future "share" /
 * "embed in a Pulse prompt" surface can call it without instantiating
 * the component). Done items use `✓ `, undone use `• ` — both
 * paste-safe in WhatsApp / Notes / Slack.
 */
import type { ChecklistItem } from './trip-checklist';

export function formatChecklistAsBullets(items: ReadonlyArray<ChecklistItem>): string {
  return items.map((it) => (it.done ? `✓ ${it.text}` : `• ${it.text}`)).join('\n');
}

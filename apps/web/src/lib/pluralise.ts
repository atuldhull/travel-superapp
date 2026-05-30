/**
 * AE223 — tiny pluralisation helper for count + label rendering.
 *
 * Replaces the ubiquitous inline ternary:
 *   {n} {n === 1 ? 'day' : 'days'}
 *
 * The repo had >10 instances of this pattern across Aether surfaces
 * + non-Aether tabs. Consolidating means a future "use a real i18n
 * pluraliser" lands in one file, and the singular-vs-plural decision
 * is testable in isolation.
 *
 * Variants:
 *   - `plural(n, 'day', 'days')`       → 'day' | 'days'
 *   - `pluralise(n, 'day')`            → 'day' | 'days' (auto-s suffix)
 *   - `countLabel(n, 'day', 'days')`   → '1 day' | '3 days'  (with the count)
 *
 * `n === 1` is the only singular case; 0 + negative + non-integers
 * all use the plural ("0 days", "1.5 days"). Mirrors English.
 */

export function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

export function pluralise(n: number, singular: string, pluralWord?: string): string {
  return plural(n, singular, pluralWord ?? `${singular}s`);
}

export function countLabel(n: number, singular: string, pluralWord?: string): string {
  return `${n} ${pluralise(n, singular, pluralWord)}`;
}

/**
 * AE272 — pure subhead builder for the AE79 trip share card.
 *
 * The card needs a short line under the title — typically "Day 1
 * of 5 · Jaipur" or "5 days · ~50km radius". This helper builds
 * it from a structural trip slice. Keeps the prose calm: no
 * trailing dots, no Oxford comma, no clutter.
 *
 * Rule:
 *   - both startsOn + endsOn: "<N> days · ~<radius>km"
 *   - only days: "<N> days"
 *   - no dates: "<radius>km radius"
 *   - no radius either: ""  (caller hides the row)
 */
import { inclusiveDaysBetween } from '../../../lib/aether-dates';
import { countLabel } from '../../../lib/pluralise';

export interface ShareCardTaglineInputs {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly radiusKm: number | null;
}

const SEP = ' · ';

export function buildShareCardTagline(inputs: ShareCardTaglineInputs): string {
  const days = inclusiveDaysBetween(inputs.startsOn, inputs.endsOn);
  const segments: string[] = [];
  if (days !== null && days > 0) segments.push(countLabel(days, 'day'));
  if (inputs.radiusKm !== null && inputs.radiusKm > 0) {
    segments.push(`~${inputs.radiusKm}km radius`);
  }
  return segments.join(SEP);
}

/**
 * AE282 — pure decision: should this Pulse user-prompt attach the
 * prior plan as `priorPlan` context?
 *
 * The default flow (AE22 threaded refinement) ALWAYS attaches when
 * `ctx !== null`. But certain prompts hint that the user is
 * starting fresh — "plan a new trip to ..." / "start over". For
 * those, sending priorPlan poisons the response. This helper
 * canonicalises:
 *
 *   - ctx null → never attach
 *   - prompt matches a 'fresh start' phrase → don't attach
 *   - otherwise → attach
 *
 * Phrase matching is case-insensitive whole-word.
 */

export const FRESH_START_PHRASES = [
  'plan a new',
  'start over',
  'forget what',
  'new trip',
  'reset',
  'different trip',
];

export interface ShouldAttachContextInputs {
  readonly prompt: string;
  readonly hasContext: boolean;
}

export function shouldAttachContext(inputs: ShouldAttachContextInputs): boolean {
  if (inputs.hasContext === false) return false;
  const lower = inputs.prompt.trim().toLowerCase();
  if (lower === '') return true;
  for (const phrase of FRESH_START_PHRASES) {
    if (lower.includes(phrase)) return false;
  }
  return true;
}

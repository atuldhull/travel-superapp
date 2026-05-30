/**
 * AE266 — pure visibility gate for the Pulse "thinking" dot.
 *
 * The pending-phrase rotation (AE159) shows '· Reading…' while
 * the planner is computing. We only want it after a brief delay
 * (so a sub-200ms response doesn't flash); we hide it the moment
 * pending flips back to false, AND we hide it if the user has
 * already typed a follow-up while pending is still true.
 *
 * Rule:
 *   - pending=false  → hide
 *   - pending=true   → show iff elapsedMs >= MIN_THINKING_MS
 *
 * Future "user started typing follow-up" gate hooks into `q !== ''`
 * coming in via inputs.composerHasText.
 */

export const MIN_THINKING_MS = 220;

export interface ShouldShowThinkingDotInputs {
  readonly pending: boolean;
  readonly elapsedMs: number;
  readonly composerHasText: boolean;
}

export function shouldShowThinkingDot(inputs: ShouldShowThinkingDotInputs): boolean {
  if (inputs.pending === false) return false;
  if (inputs.composerHasText === true) return false;
  return inputs.elapsedMs >= MIN_THINKING_MS;
}

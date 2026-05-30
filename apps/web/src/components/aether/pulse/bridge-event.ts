/**
 * AE163 — pure helper for the AE96 + AE146 `aether-pulse-open` event.
 *
 * Decodes the event detail into a normalized command: should the
 * drawer just open (prefill), or also auto-submit? Extracted from
 * pulse.tsx so the gate is unit-testable without spinning up the
 * drawer + intercepting setTimeout / window.dispatchEvent.
 *
 * The handler in pulse.tsx remains responsible for the DOM-coupled
 * setOpen + setQ + setTimeout-then-ask() side effects; this file
 * just owns the decision.
 */

export interface PulseOpenCommand {
  /** The trimmed prefill text. Empty string when not provided or all
   *  whitespace; the drawer should NOT prefill in that case. */
  readonly prefill: string;
  /** True only when the event explicitly asked for auto-submit AND a
   *  non-empty prefill was provided. Auto-submit on an empty prefill
   *  would just open the drawer with an empty input — pointless. */
  readonly shouldSubmit: boolean;
}

interface RawDetail {
  readonly prefill?: unknown;
  readonly submit?: unknown;
}

export function decodePulseOpenEvent(detail: unknown): PulseOpenCommand {
  const d = (typeof detail === 'object' && detail !== null ? detail : {}) as RawDetail;
  const rawPrefill = typeof d.prefill === 'string' ? d.prefill : '';
  const prefill = rawPrefill.trim();
  const shouldSubmit = prefill !== '' && d.submit === true;
  return { prefill, shouldSubmit };
}

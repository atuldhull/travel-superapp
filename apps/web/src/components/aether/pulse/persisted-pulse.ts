/**
 * AE184 — pure parser for the AE72 Pulse persistence shape, extracted
 * from pulse.tsx so the structural validation can be tested with a
 * mock Storage instead of mounting the drawer.
 *
 * The original function lived inline + was hidden by the `Pulse`
 * component's closure. Keeping the shape contract in one file makes
 * it impossible to drift between the persistence write side (still in
 * pulse.tsx) and the read side (here).
 */

export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface PersistedPulse {
  readonly messages: ChatMessage[];
  readonly ctx: {
    readonly title: string;
    readonly center: { readonly lat: number; readonly lng: number };
    readonly plan: string;
  } | null;
  readonly provider: string | null;
}

export const PULSE_STORAGE_KEY = 'aether-pulse-history:v1';

/** Parse the raw stored JSON string into a sanitized PersistedPulse,
 *  or return null when the payload is missing / malformed / wrong
 *  shape. Callers should treat null as "start fresh".
 *
 *  AE307 — JSON.parse + the empty-/null-/malformed guard now go
 *  through AE228 safeJsonParse so the contract lives in one place. */
import { safeJsonParse } from '../../../lib/safe-json-parse';

export function parsePulseStore(raw: string | null): PersistedPulse | null {
  const parsed = safeJsonParse<unknown>(raw, null);
  if (parsed === null) return null;
  if (typeof parsed !== 'object') return null;
  const p = parsed as Partial<PersistedPulse>;
  if (!Array.isArray(p.messages)) return null;
  const messages = p.messages.filter(
    (m): m is ChatMessage =>
      typeof m === 'object' &&
      m !== null &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string',
  );
  const ctxRaw = p.ctx;
  const ctx =
    ctxRaw !== null &&
    ctxRaw !== undefined &&
    typeof ctxRaw === 'object' &&
    typeof ctxRaw.title === 'string' &&
    typeof ctxRaw.plan === 'string' &&
    typeof ctxRaw.center === 'object' &&
    typeof ctxRaw.center.lat === 'number' &&
    typeof ctxRaw.center.lng === 'number'
      ? {
          title: ctxRaw.title,
          plan: ctxRaw.plan,
          center: { lat: ctxRaw.center.lat, lng: ctxRaw.center.lng },
        }
      : null;
  const provider = typeof p.provider === 'string' ? p.provider : null;
  return { messages, ctx, provider };
}

/**
 * AE222 — pure append-and-cap helper for the Pulse chat history.
 *
 * pulse.tsx caps the persisted history via `messages.slice(-MAX)`
 * at write time but the in-memory append (`setMessages((p) => [...p, m])`)
 * is unbounded. This helper folds both into one operation so any
 * future call site can't drift.
 *
 * Returns a new array; the input is not mutated.
 */

import type { ChatMessage } from './persisted-pulse';

export const PULSE_MAX_MESSAGES = 40;

export function appendBoundedMessage(
  prev: ReadonlyArray<ChatMessage>,
  next: ChatMessage,
  max: number = PULSE_MAX_MESSAGES,
): ChatMessage[] {
  if (max <= 0) return [next];
  const out = [...prev, next];
  if (out.length <= max) return out;
  return out.slice(out.length - max);
}

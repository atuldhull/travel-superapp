/**
 * AE198 — pure helper for the AE197 ArrowUp recall. Picks the most
 * recent user-role message from a chat thread, or null when there
 * isn't one. Extracted so the recall rule is testable without
 * mounting the Pulse drawer.
 */
import type { ChatMessage } from './persisted-pulse';

export function lastUserPrompt(messages: ReadonlyArray<ChatMessage>): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m === undefined) continue;
    if (m.role === 'user') return m.content;
  }
  return null;
}

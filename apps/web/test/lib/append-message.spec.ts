/**
 * Vitest specs for AE222 appendBoundedMessage — bounded chat history
 * append for the Pulse drawer.
 */
import { describe, expect, it } from 'vitest';
import {
  PULSE_MAX_MESSAGES,
  appendBoundedMessage,
} from '../../src/components/aether/pulse/append-message';
import type { ChatMessage } from '../../src/components/aether/pulse/persisted-pulse';

const u = (n: number): ChatMessage => ({ role: 'user', content: `u${n}` });
const a = (n: number): ChatMessage => ({ role: 'assistant', content: `a${n}` });

describe('appendBoundedMessage', () => {
  it('appends to an empty array', () => {
    const out = appendBoundedMessage([], u(1));
    expect(out).toEqual([u(1)]);
  });

  it('preserves order', () => {
    const out = appendBoundedMessage([u(1), a(1)], u(2));
    expect(out).toEqual([u(1), a(1), u(2)]);
  });

  it('does NOT mutate the input array', () => {
    const prev = [u(1), a(1)];
    const out = appendBoundedMessage(prev, u(2));
    expect(prev.length).toBe(2);
    expect(out).not.toBe(prev);
  });

  it('caps to PULSE_MAX_MESSAGES, keeping the most recent', () => {
    const base: ChatMessage[] = [];
    for (let i = 0; i < PULSE_MAX_MESSAGES; i++) base.push(u(i));
    const out = appendBoundedMessage(base, u(999));
    expect(out.length).toBe(PULSE_MAX_MESSAGES);
    expect(out[out.length - 1]).toEqual(u(999));
    // First entry is the second-oldest (u(1)) — we dropped u(0).
    expect(out[0]).toEqual(u(1));
  });

  it('with custom max=3, keeps the last 3 always', () => {
    let arr: ReadonlyArray<ChatMessage> = [];
    arr = appendBoundedMessage(arr, u(1), 3);
    arr = appendBoundedMessage(arr, u(2), 3);
    arr = appendBoundedMessage(arr, u(3), 3);
    arr = appendBoundedMessage(arr, u(4), 3);
    expect(arr).toEqual([u(2), u(3), u(4)]);
  });

  it('max=0 keeps only the latest', () => {
    const out = appendBoundedMessage([u(1), u(2)], u(3), 0);
    expect(out).toEqual([u(3)]);
  });

  it('PULSE_MAX_MESSAGES is the canonical 40', () => {
    expect(PULSE_MAX_MESSAGES).toBe(40);
  });
});

/**
 * Vitest specs for the AE198 lastUserPrompt picker (AE197 recall).
 */
import { describe, expect, it } from 'vitest';
import { lastUserPrompt } from '../../src/components/aether/pulse/last-user-prompt';
import type { ChatMessage } from '../../src/components/aether/pulse/persisted-pulse';

const U = (c: string): ChatMessage => ({ role: 'user', content: c });
const A = (c: string): ChatMessage => ({ role: 'assistant', content: c });

describe('lastUserPrompt', () => {
  it('returns null on empty list', () => {
    expect(lastUserPrompt([])).toBeNull();
  });

  it('returns null when only assistant messages exist', () => {
    expect(lastUserPrompt([A('hello'), A('world')])).toBeNull();
  });

  it('returns the single user message', () => {
    expect(lastUserPrompt([U('plan jaipur')])).toBe('plan jaipur');
  });

  it('returns the LATEST user message, skipping any later assistant turn', () => {
    expect(lastUserPrompt([U('first'), A('reply 1'), U('second'), A('reply 2')])).toBe('second');
  });

  it('picks the last user even when several user turns are adjacent', () => {
    expect(lastUserPrompt([U('first'), U('second'), U('third')])).toBe('third');
  });

  it('treats empty-string user messages as valid recall targets', () => {
    // We let the caller (Pulse) decide whether to ignore empties; the
    // picker just finds the most recent user role.
    expect(lastUserPrompt([U('first'), U('')])).toBe('');
  });
});

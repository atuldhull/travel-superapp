/**
 * Vitest specs for AE252 buildPulseHistoryExport.
 */
import { describe, expect, it } from 'vitest';
import {
  PULSE_HISTORY_EXPORT_SCHEMA,
  PULSE_HISTORY_EXPORT_VERSION,
  buildPulseHistoryExport,
} from '../../src/components/aether/pulse/format-history-export';
import type { ChatMessage } from '../../src/components/aether/pulse/persisted-pulse';

const FIXED = new Date('2026-05-30T12:00:00Z');

const M = (role: 'user' | 'assistant', content: string): ChatMessage => ({ role, content });

describe('buildPulseHistoryExport', () => {
  it('wraps messages in a versioned envelope', () => {
    const got = buildPulseHistoryExport([M('user', 'hi')], FIXED);
    expect(got).toEqual({
      schema: 'aether.pulse.history',
      version: 1,
      exportedAt: '2026-05-30T12:00:00.000Z',
      count: 1,
      messages: [M('user', 'hi')],
    });
  });

  it('empty messages → count 0 + empty list', () => {
    const got = buildPulseHistoryExport([], FIXED);
    expect(got.count).toBe(0);
    expect(got.messages).toEqual([]);
  });

  it('count matches messages length', () => {
    const got = buildPulseHistoryExport(
      [M('user', 'a'), M('assistant', 'b'), M('user', 'c')],
      FIXED,
    );
    expect(got.count).toBe(3);
  });

  it('clones the messages array (not mutated by caller mutating input)', () => {
    const input = [M('user', 'a')];
    const got = buildPulseHistoryExport(input, FIXED);
    expect(got.messages).not.toBe(input);
    expect(got.messages).toEqual(input);
  });

  it('exportedAt is an ISO string', () => {
    const got = buildPulseHistoryExport([], FIXED);
    expect(got.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('schema and version are exposed as constants', () => {
    expect(PULSE_HISTORY_EXPORT_SCHEMA).toBe('aether.pulse.history');
    expect(PULSE_HISTORY_EXPORT_VERSION).toBeGreaterThan(0);
  });

  it('default now path produces a valid ISO date', () => {
    const got = buildPulseHistoryExport([]);
    expect(got.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

/**
 * Vitest specs for the AE131 data-export bundler (extracted in AE136).
 *
 * Builds a fresh in-memory Storage per test, sets a known mix of
 * Aether keys, then asserts the bundle's shape, that JSON values are
 * parsed (not left as strings), and the privacy invariant: nothing
 * outside the explicit allow-list is included.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bundleLocalData,
  type AetherLocalDataPayload,
} from '../../src/components/aether/account/data-export';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe('bundleLocalData', () => {
  it('returns version=1 and source="aether-account" on an empty store', () => {
    const out: AetherLocalDataPayload = bundleLocalData(storage, new Date('2026-05-30T12:00:00Z'));
    expect(out.version).toBe(1);
    expect(out.source).toBe('aether-account');
    expect(out.exportedAt).toBe('2026-05-30T12:00:00.000Z');
  });

  it('reads recentPrompts as a parsed JSON array', () => {
    storage.setItem('aether-pulse-recent:v1', JSON.stringify(['leh trip', 'goa']));
    const out = bundleLocalData(storage);
    expect(out.recentPrompts).toEqual(['leh trip', 'goa']);
  });

  it('returns null for missing keys (not "")', () => {
    const out = bundleLocalData(storage);
    expect(out.recentPrompts).toBeNull();
    expect(out.pulseHistory).toBeNull();
    expect(out.checklists).toEqual({});
    expect(out.onboarded).toBe(false);
    expect(out.audioOptOut).toBe(false);
  });

  it('gathers every aether-checklist:<tripId>:v1 key', () => {
    storage.setItem(
      'aether-checklist:trip-a:v1',
      JSON.stringify([{ id: '1', text: 'pack', done: false }]),
    );
    storage.setItem(
      'aether-checklist:trip-b:v1',
      JSON.stringify([{ id: '2', text: 'ID', done: true }]),
    );
    const out = bundleLocalData(storage);
    expect(Object.keys(out.checklists)).toEqual([
      'aether-checklist:trip-a:v1',
      'aether-checklist:trip-b:v1',
    ]);
    expect((out.checklists['aether-checklist:trip-a:v1'] as Array<{ text: string }>)[0]?.text).toBe(
      'pack',
    );
  });

  it('ignores checklist keys with wrong version suffix', () => {
    storage.setItem('aether-checklist:trip-x:v2', '[]'); // wrong version
    storage.setItem('aether-checklist:trip-y:v1', '[]'); // ok
    const out = bundleLocalData(storage);
    expect(Object.keys(out.checklists)).toEqual(['aether-checklist:trip-y:v1']);
  });

  it('does not include unrelated keys (privacy invariant)', () => {
    storage.setItem('access-token', 'SECRET'); // never accessible via local
    storage.setItem('some-other-app:user', 'jeff');
    storage.setItem('aether-pulse-recent:v1', JSON.stringify(['ok']));
    const out = bundleLocalData(storage);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('some-other-app:user');
    expect(serialized).not.toContain('jeff');
    expect(out.recentPrompts).toEqual(['ok']);
  });

  it('onboarded=true when aether-onboarded key is set (any value)', () => {
    storage.setItem('aether-onboarded', '1');
    expect(bundleLocalData(storage).onboarded).toBe(true);
  });

  it('audioOptOut=true only when aether-audio-opt-out exactly equals "1"', () => {
    storage.setItem('aether-audio-opt-out', '1');
    expect(bundleLocalData(storage).audioOptOut).toBe(true);
    storage.setItem('aether-audio-opt-out', 'true');
    expect(bundleLocalData(storage).audioOptOut).toBe(false);
  });

  it('falls back to the raw string when a value is non-JSON', () => {
    storage.setItem('aether-pulse-recent:v1', 'this-is-not-json{{{');
    const out = bundleLocalData(storage);
    expect(out.recentPrompts).toBe('this-is-not-json{{{');
  });
});

/**
 * Vitest jsdom specs for AE247 useLocalStorageState.
 */
import { act, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorageState } from '../../src/components/aether/use-local-storage-state';

interface Out<T> {
  value: T;
  set: (n: T | ((p: T) => T)) => void;
}

function Probe<T>({
  storageKey,
  fallback,
  enabled,
  out,
}: {
  storageKey: string;
  fallback: T;
  enabled?: boolean;
  out: Out<T>;
}): ReactElement {
  const [v, setV] = useLocalStorageState<T>(storageKey, fallback, { enabled });
  out.value = v;
  out.set = setV;
  return <span data-testid="probe" />;
}

const KEY = 'aether-uls-spec:v1';

describe('useLocalStorageState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the fallback when storage is empty', () => {
    const out: Out<number> = { value: -1, set: () => {} };
    render(<Probe storageKey={KEY} fallback={42} out={out} />);
    expect(out.value).toBe(42);
  });

  it('hydrates from storage when present', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    const out: Out<{ a: number }> = { value: { a: 0 }, set: () => {} };
    render(<Probe storageKey={KEY} fallback={{ a: 0 }} out={out} />);
    expect(out.value).toEqual({ a: 1 });
  });

  it('setState persists to storage', () => {
    const out: Out<number> = { value: 0, set: () => {} };
    render(<Probe storageKey={KEY} fallback={0} out={out} />);
    act(() => out.set(7));
    expect(out.value).toBe(7);
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(7));
  });

  it('functional updater works', () => {
    const out: Out<number> = { value: 0, set: () => {} };
    render(<Probe storageKey={KEY} fallback={10} out={out} />);
    act(() => out.set((p) => p + 5));
    expect(out.value).toBe(15);
  });

  it('enabled=false skips storage (no read, no write)', () => {
    window.localStorage.setItem(KEY, JSON.stringify(999));
    const out: Out<number> = { value: -1, set: () => {} };
    render(<Probe storageKey={KEY} fallback={0} enabled={false} out={out} />);
    // Fallback returned, NOT the 999 in storage.
    expect(out.value).toBe(0);
    act(() => out.set(42));
    // Storage untouched.
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(999));
  });

  it('hydrates a JSON-decodable object', () => {
    const stored = { items: ['a', 'b'], n: 3 };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
    const out: Out<typeof stored> = { value: { items: [], n: 0 }, set: () => {} };
    render(<Probe storageKey={KEY} fallback={{ items: [], n: 0 }} out={out} />);
    expect(out.value).toEqual(stored);
  });
});

/**
 * Vitest specs for AE362 useAetherTripList.
 *
 * Mocks the underlying orval hook so we exercise the input → output
 * contract (archived flag → string, default retry, tripsFromQuery
 * unwrap) without spinning up react-query.
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tripControllerListMock = vi.fn();

vi.mock('@app/sdk', () => ({
  useTripControllerList: (...args: unknown[]) => tripControllerListMock(...args),
}));

import { useAetherTripList } from '../../src/components/aether/use-aether-trip-list';

const fakeQuery = (trips: Array<{ id: string }> = [], partial: object = {}) => ({
  data: { data: { trips } },
  isPending: false,
  isError: false,
  ...partial,
});

describe('useAetherTripList', () => {
  beforeEach(() => tripControllerListMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('archived=false → orval params { archived: "false" }', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ archived: false, limit: '50', enabled: true }));
    const [params, options] = tripControllerListMock.mock.calls[0]!;
    expect(params).toEqual({ limit: '50', archived: 'false' });
    expect(options).toEqual({ query: { enabled: true, retry: 1 } });
  });

  it('archived=true → orval params { archived: "true" }', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ archived: true, limit: '50', enabled: true }));
    const [params] = tripControllerListMock.mock.calls[0]!;
    expect(params.archived).toBe('true');
  });

  it('archived omitted → defaults to "false" (i.e. active trips)', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ limit: '50', enabled: true }));
    const [params] = tripControllerListMock.mock.calls[0]!;
    expect(params.archived).toBe('false');
  });

  it('forwards limit verbatim (orval wants a string, not number)', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ limit: '100', enabled: true }));
    expect(tripControllerListMock.mock.calls[0]![0].limit).toBe('100');
  });

  it('default retry is 1 (orval default is 3, but we always retry once)', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ limit: '50', enabled: true }));
    expect(tripControllerListMock.mock.calls[0]![1].query.retry).toBe(1);
  });

  it('explicit retry override is honoured', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ limit: '50', enabled: true, retry: 5 }));
    expect(tripControllerListMock.mock.calls[0]![1].query.retry).toBe(5);
  });

  it('enabled flag flows through to react-query', () => {
    tripControllerListMock.mockReturnValue(fakeQuery());
    renderHook(() => useAetherTripList({ limit: '50', enabled: false }));
    expect(tripControllerListMock.mock.calls[0]![1].query.enabled).toBe(false);
  });

  it('extracts trips via tripsFromQuery', () => {
    tripControllerListMock.mockReturnValue(fakeQuery([{ id: 'a' }, { id: 'b' }]));
    const { result } = renderHook(() => useAetherTripList({ limit: '50', enabled: true }));
    expect(result.current.trips.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('returns empty trips when query has no data envelope', () => {
    tripControllerListMock.mockReturnValue({ isPending: true, isError: false });
    const { result } = renderHook(() => useAetherTripList({ limit: '50', enabled: true }));
    expect(result.current.trips).toEqual([]);
    expect(result.current.isPending).toBe(true);
  });

  it('isError + raw query are exposed', () => {
    const raw = fakeQuery([], { isError: true });
    tripControllerListMock.mockReturnValue(raw);
    const { result } = renderHook(() => useAetherTripList({ limit: '50', enabled: true }));
    expect(result.current.isError).toBe(true);
    expect(result.current.raw).toBe(raw);
  });
});

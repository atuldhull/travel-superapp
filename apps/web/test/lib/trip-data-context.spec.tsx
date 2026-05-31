/**
 * Vitest specs for AE378 `<TripDataProvider>` + `useTripData()`.
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  TripDataProvider,
  useTripData,
} from '../../src/components/aether/phase1/trip-data-context';

const days = [
  {
    id: 'd0',
    dayIndex: 0,
    date: '2026-06-01',
    items: [{ id: 'i0', position: 0, placeId: null }],
  },
];

function wrap(opts: {
  trip?: {
    id: string;
    title: string;
    status: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
  isPending?: boolean;
  isError?: boolean;
}): React.FC<{ children: ReactNode }> {
  return function Wrap({ children }) {
    return (
      <TripDataProvider
        trip={opts.trip ?? null}
        days={days}
        isPending={opts.isPending ?? false}
        isError={opts.isError ?? false}
      >
        {children}
      </TripDataProvider>
    );
  };
}

describe('useTripData — outside provider', () => {
  it('throws a helpful error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTripData())).toThrow(/outside <TripDataProvider>/);
    spy.mockRestore();
  });
});

describe('useTripData — inside provider', () => {
  it('exposes trip + days + flags', () => {
    const { result } = renderHook(() => useTripData(), {
      wrapper: wrap({
        trip: {
          id: 't1',
          title: 'Five days in Leh',
          status: 'draft',
          startsOn: '2026-06-01',
          endsOn: '2026-06-05',
        },
      }),
    });
    expect(result.current.trip?.id).toBe('t1');
    expect(result.current.trip?.title).toBe('Five days in Leh');
    expect(result.current.days).toEqual(days);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('handles null trip while pending', () => {
    const { result } = renderHook(() => useTripData(), {
      wrapper: wrap({ trip: null, isPending: true }),
    });
    expect(result.current.trip).toBeNull();
    expect(result.current.isPending).toBe(true);
  });

  it('propagates isError', () => {
    const { result } = renderHook(() => useTripData(), {
      wrapper: wrap({ trip: null, isError: true }),
    });
    expect(result.current.isError).toBe(true);
  });
});

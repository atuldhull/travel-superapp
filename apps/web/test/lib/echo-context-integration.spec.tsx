/** Vitest specs for AE418 EchoFeedProvider — jsdom integration. */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { EchoFeedProvider, useEchoFeed } from '../../src/components/aether/phase3/echo-context';
import type { EchoItem } from '../../src/components/aether/phase3/echo-feed';

const ITEMS: ReadonlyArray<EchoItem> = [
  {
    id: 'a',
    traveller: 'Asha',
    travellerHandle: 'asha',
    placeName: 'Place A',
    destinationSlug: null,
    photoUrl: null,
    dominantColor: '#FF0000',
    diary: 'A',
    postedAt: new Date().toISOString(),
  },
  {
    id: 'b',
    traveller: 'Asha',
    travellerHandle: 'asha',
    placeName: 'Place B',
    destinationSlug: null,
    photoUrl: null,
    dominantColor: '#00FF00',
    diary: 'B',
    postedAt: new Date().toISOString(),
  },
  {
    id: 'c',
    traveller: 'Asha',
    travellerHandle: 'asha',
    placeName: 'Place C',
    destinationSlug: null,
    photoUrl: null,
    dominantColor: '#0000FF',
    diary: 'C',
    postedAt: new Date().toISOString(),
  },
];

function wrap(items: ReadonlyArray<EchoItem>, initialIndex = 0) {
  return ({ children }: { readonly children: ReactNode }): React.ReactElement => (
    <EchoFeedProvider items={items} initialIndex={initialIndex}>
      {children}
    </EchoFeedProvider>
  );
}

describe('<EchoFeedProvider/> integration', () => {
  it('exposes items + active item via context', () => {
    const { result } = renderHook(() => useEchoFeed(), { wrapper: wrap(ITEMS) });
    expect(result.current.items.length).toBe(3);
    expect(result.current.active?.id).toBe('a');
    expect(result.current.activeIndex).toBe(0);
  });

  it('initialIndex pins the active item', () => {
    const { result } = renderHook(() => useEchoFeed(), { wrapper: wrap(ITEMS, 1) });
    expect(result.current.active?.id).toBe('b');
  });

  it('initialIndex is clamped to the items range', () => {
    const { result } = renderHook(() => useEchoFeed(), { wrapper: wrap(ITEMS, 99) });
    expect(result.current.active?.id).toBe('c');
  });

  it('setActiveIndex clamps + flips the active item', () => {
    const { result } = renderHook(() => useEchoFeed(), { wrapper: wrap(ITEMS) });
    act(() => result.current.setActiveIndex(2));
    expect(result.current.active?.id).toBe('c');
    act(() => result.current.setActiveIndex(99));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.setActiveIndex(-5));
    expect(result.current.activeIndex).toBe(0);
  });

  it('empty items → active is null + setter is a no-op', () => {
    const { result } = renderHook(() => useEchoFeed(), { wrapper: wrap([]) });
    expect(result.current.active).toBeNull();
    expect(result.current.items.length).toBe(0);
    act(() => result.current.setActiveIndex(3));
    expect(result.current.activeIndex).toBe(0);
  });

  it('outside the provider returns the NULL_FEED defaults', () => {
    const { result } = renderHook(() => useEchoFeed());
    expect(result.current.items.length).toBe(0);
    expect(result.current.active).toBeNull();
    // Setter is a no-op — call should not throw.
    act(() => result.current.setActiveIndex(1));
    expect(result.current.activeIndex).toBe(0);
  });
});

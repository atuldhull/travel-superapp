'use client';

/**
 * AE418 — `<EchoFeedProvider>` + `useEchoFeed()`.
 *
 * State container for the Echo feed: the list of items + the active
 * index. The R3F scene reads via `useEchoFeed()`; AE420 wires the
 * swipe-driven setter so a Down swipe advances the cursor.
 *
 * Outside the provider the hook returns an empty list + a no-op
 * setter so Storybook + jsdom can render the scene without wiring
 * the shell.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { EchoItem } from './echo-feed';

export interface EchoFeedValue {
  readonly items: ReadonlyArray<EchoItem>;
  readonly activeIndex: number;
  /** The current echo, or null when the feed is empty. */
  readonly active: EchoItem | null;
  setActiveIndex(i: number): void;
}

const NULL_FEED: EchoFeedValue = Object.freeze({
  items: [],
  activeIndex: 0,
  active: null,
  setActiveIndex() {
    /* no-op outside provider */
  },
});

const EchoFeedContext = createContext<EchoFeedValue>(NULL_FEED);

export interface EchoFeedProviderProps {
  readonly items: ReadonlyArray<EchoItem>;
  readonly initialIndex?: number;
  children: ReactNode;
}

export function EchoFeedProvider({
  items,
  initialIndex = 0,
  children,
}: EchoFeedProviderProps): React.ReactElement {
  const safeInitial =
    items.length === 0 ? 0 : Math.max(0, Math.min(items.length - 1, initialIndex));
  const [activeIndex, setActiveIndexState] = useState<number>(safeInitial);
  const setActiveIndex = useCallback(
    (i: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      setActiveIndexState(clamped);
    },
    [items.length],
  );
  const active = items.length === 0 ? null : (items[activeIndex] ?? null);
  return (
    <EchoFeedContext.Provider value={{ items, activeIndex, active, setActiveIndex }}>
      {children}
    </EchoFeedContext.Provider>
  );
}

export function useEchoFeed(): EchoFeedValue {
  return useContext(EchoFeedContext);
}

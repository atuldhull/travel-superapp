'use client';

/**
 * AE410 — `<LumenStrategyProvider>` + `useLumenStrategy()`.
 *
 * State container for the active layout strategy. The arrange menu
 * writes the strategy; the scene reads it and passes it through
 * `applyLayoutStrategy(...)` in a useMemo so swaps re-layout the
 * cloud without remounting any slot (the per-frame group lerp from
 * AE409 then animates each plane to its new position).
 *
 * Outside the provider the hook returns the `time` baseline + no-op
 * setter so jsdom tests + Storybook can mount the scene without
 * wiring the shell.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { LumenLayoutStrategy } from './lumen-strategies';

export interface LumenStrategyValue {
  readonly strategy: LumenLayoutStrategy;
  setStrategy(s: LumenLayoutStrategy): void;
}

const NULL_STRATEGY: LumenStrategyValue = Object.freeze({
  strategy: 'time',
  setStrategy() {
    /* no-op outside provider */
  },
});

const LumenStrategyContext = createContext<LumenStrategyValue>(NULL_STRATEGY);

export interface LumenStrategyProviderProps {
  readonly initialStrategy?: LumenLayoutStrategy;
  children: ReactNode;
}

export function LumenStrategyProvider({
  initialStrategy = 'time',
  children,
}: LumenStrategyProviderProps): React.ReactElement {
  const [strategy, setStrategyState] = useState<LumenLayoutStrategy>(initialStrategy);
  const setStrategy = useCallback((s: LumenLayoutStrategy) => setStrategyState(s), []);
  return (
    <LumenStrategyContext.Provider value={{ strategy, setStrategy }}>
      {children}
    </LumenStrategyContext.Provider>
  );
}

export function useLumenStrategy(): LumenStrategyValue {
  return useContext(LumenStrategyContext);
}

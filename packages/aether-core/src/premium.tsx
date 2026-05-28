/**
 * Premium gating — `usePremium()` hook.
 *
 * Aether is pluggable here: `@app/aether-core` does NOT pull in
 * `@app/sdk` (heavy + would chain to the API layer). Instead the
 * consumer wires the provider with whatever shape they have.
 *
 * Gating policy (locked 06-decisions.md #5):
 *   • Genie camera/voice → premium
 *   • Predictor always-on → premium
 *   • Compass Eye AR → premium (when it ships in Phase 5)
 *   • Lumen PDF export → premium
 * All other Aether surfaces are free.
 */
import { createContext, useContext, type ReactNode } from 'react';

/** The four gated capabilities. New ones land here + in 06-decisions.md.
 *
 *  Why string-union, not enum: enums leak runtime objects; we want this
 *  in props/types only. */
export type PremiumCapability =
  | 'genie-camera'
  | 'genie-voice'
  | 'predictor-auto'
  | 'compass-eye'
  | 'lumen-pdf';

/** Subscription tier the user has. `null` = anonymous / signed-out. */
export type PremiumTier = 'free' | 'plus' | 'pro' | null;

export interface PremiumState {
  /** Resolved tier, or `null` when anonymous. */
  readonly tier: PremiumTier;
  /** True iff the given capability is unlocked at the current tier. */
  has(capability: PremiumCapability): boolean;
}

const PremiumContext = createContext<PremiumState | null>(null);

/** Default rule book — `pro` unlocks everything, `plus` unlocks
 *  Lumen PDF + Genie voice, `free`/`null` unlock nothing.
 *  Consumers can replace with a custom resolver via the provider. */
export const defaultPremiumRule = (tier: PremiumTier, capability: PremiumCapability): boolean => {
  if (tier === 'pro') return true;
  if (tier === 'plus') {
    return capability === 'lumen-pdf' || capability === 'genie-voice';
  }
  return false;
};

export interface PremiumProviderProps {
  /** Current user tier — caller reads from User.premiumTier in the SDK
   *  and passes here. */
  tier: PremiumTier;
  /** Override the default rule (Genie / Predictor / Compass-Eye / Lumen-PDF). */
  resolve?: (tier: PremiumTier, capability: PremiumCapability) => boolean;
  children: ReactNode;
}

export function PremiumProvider({
  tier,
  resolve = defaultPremiumRule,
  children,
}: PremiumProviderProps): React.ReactElement {
  const value: PremiumState = {
    tier,
    has: (capability) => resolve(tier, capability),
  };
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

/** Read the current premium state. Throws outside provider. */
export function usePremium(): PremiumState {
  const ctx = useContext(PremiumContext);
  if (ctx === null) {
    throw new Error('usePremium() called outside <PremiumProvider>.');
  }
  return ctx;
}

/** Inline gate — common pattern: `<PremiumGate cap='lumen-pdf' fallback={<Paywall/>} >...children...</PremiumGate>`. */
export interface PremiumGateProps {
  cap: PremiumCapability;
  fallback: ReactNode;
  children: ReactNode;
}

export function PremiumGate({ cap, fallback, children }: PremiumGateProps): React.ReactElement {
  const { has } = usePremium();
  const unlocked = has(cap);
  return (
    <div data-aether-gate={cap} data-aether-unlocked={unlocked ? 'true' : 'false'}>
      {unlocked ? children : fallback}
    </div>
  );
}

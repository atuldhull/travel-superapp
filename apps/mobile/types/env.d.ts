/**
 * Ambient typings for the EXPO_PUBLIC_* environment variables the app
 * reads at build time. Expo inlines these into the bundle; declaring
 * them here gives `process.env.EXPO_PUBLIC_*` a type without pulling in
 * the full @types/node (which would wrongly surface Node-only globals
 * in a React Native context). Added by Phase 4 AE537.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** Phase 4 feature flag — mirror of web NEXT_PUBLIC_FEATURE_AETHER_PHASE1. */
      readonly EXPO_PUBLIC_FEATURE_AETHER_PHASE1?: string;
      /** API base URL per environment (set in eas.json build profiles). */
      readonly EXPO_PUBLIC_API_BASE_URL?: string;
      /** WebTransport feed + presence endpoints (Continuum / live trip-watch). */
      readonly EXPO_PUBLIC_WT_FEED_URL?: string;
      readonly EXPO_PUBLIC_WT_PRESENCE_URL?: string;
      /** Stripe publishable key (Vault checkout). */
      readonly EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
      /** Build SHA + time, stamped by CI. */
      readonly EXPO_PUBLIC_BUILD_SHA?: string;
      readonly EXPO_PUBLIC_BUILD_TIME?: string;
    }
  }

  // Minimal `process` shape so `process.env.EXPO_PUBLIC_*` typechecks
  // without @types/node. The Expo bundler provides the real object.
  const process: { readonly env: NodeJS.ProcessEnv };
}

export {};

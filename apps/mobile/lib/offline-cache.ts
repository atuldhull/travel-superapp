/**
 * V.UX.27 — `react-query` cache persistence so the app works offline.
 *
 * Uses `@tanstack/query-async-storage-persister` + `PersistQueryClient`
 * to mirror the in-memory query cache to AsyncStorage. Default
 * `maxAge` is 24h — old enough to feel "fresh" on reopen, short
 * enough to avoid stale trip itineraries when the user comes back
 * after a week.
 *
 * Mirrors the web's `apps/web/src/lib/offline-cache.ts` (V.UX.7) in
 * intent — the persisted shape is whatever the queries hold.
 *
 * Installed by prompt [V.UX.27].
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Slightly aggressive: a stale-while-revalidate cadence that
      // means an offline render uses the persisted data while the
      // foreground refetches when connectivity returns.
      staleTime: 5 * 60 * 1000,
      gcTime: ONE_DAY_MS,
      retry: 1,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'travel-mobile-rq-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: ONE_DAY_MS,
  buster: 'v1',
} as const;

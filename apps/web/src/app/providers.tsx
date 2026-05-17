/**
 * Client-side providers: TanStack Query + SDK runtime configuration.
 *
 * - `QueryClient` lives at module scope so a single client survives
 *   re-renders. SSR streaming gets its own per-request client in a
 *   later slice.
 * - `configureSdk` runs once on first mount, pointing the @app/sdk
 *   fetcher at NEXT_PUBLIC_API_URL (falls back to local api).
 * - `getAccessToken` returns null until the auth slice lands; tokens
 *   live in memory only (CLAUDE rule 12).
 *
 * Installed by prompt [IV.18.19.17].
 */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureSdk } from '@app/sdk';
import { useState, type ReactNode } from 'react';
import { getAccessToken } from '../lib/auth-store';
import { SilentRefreshOnMount } from '../lib/silent-refresh';
import { ToastProvider } from '../components/ui/toast';

configureSdk({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000',
  // Reads the in-memory token store on every request — keeps us
  // off localStorage (CLAUDE rule 12) while still surviving
  // navigation between client routes.
  getAccessToken,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SilentRefreshOnMount />
      {/* POST.8 — toast viewport. Renders top-right + auto-dismisses
          after 4s. Imperative API: `import { toast } from
          '../components/ui/toast'` then `toast.success(...)`. */}
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

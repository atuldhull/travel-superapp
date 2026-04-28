/**
 * V.UX.17 — premium-tier gate. Wrap any feature reserved for
 * `role: 'premium' | 'admin'` callers; non-premium see an upgrade
 * CTA instead of the feature.
 *
 * Reads role from `/auth/me` via the typed SDK hook. While the
 * caller is signed-out, the gate renders the upgrade CTA (the
 * children are never shown to anonymous viewers either — the
 * concierge surface requires auth at the api layer too).
 *
 * `compact` switches to a single-line inline note (used inside
 * cards / table rows where a full upsell box would be too loud).
 *
 * Installed by prompt [V.UX.17].
 */
'use client';

import type { ReactNode } from 'react';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

const PREMIUM_ROLES = new Set(['premium', 'admin']);

export interface PremiumGateProps {
  readonly children: ReactNode;
  readonly compact?: boolean;
  /** Override the default copy ("Upgrade to premium for this feature"). */
  readonly fallback?: ReactNode;
}

export function PremiumGate({ children, compact, fallback }: PremiumGateProps) {
  const token = useAuthToken();
  const { data, isLoading } = useAuthControllerMe({
    query: { enabled: token !== null },
  });
  const me = data?.data as unknown as WhoAmIResponseDto | undefined;

  if (token !== null && isLoading) {
    return compact ? (
      <span className="text-xs text-muted">…</span>
    ) : (
      <div className="rounded-md border border-muted/15 bg-muted/5 px-3 py-2 text-xs text-muted">
        Checking your membership…
      </div>
    );
  }

  const role = me?.role ?? 'user';
  if (PREMIUM_ROLES.has(role)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) return <>{fallback}</>;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
        ✨ Premium
      </span>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-linear-to-br from-amber-500/15 to-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
        ✨ Premium-only feature
      </p>
      <p className="mt-1 text-xs text-muted">
        Hand-picked stays, concierge agent matching, and curated-only filters live in our premium
        tier. Upgrade to unlock.
      </p>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 rounded-md bg-linear-to-br from-amber-500 to-amber-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        onClick={() => {
          // Placeholder — Stripe / billing flow lands in a future
          // slice. For now we surface a friendly message so the
          // affordance works end-to-end in the demo.
          // eslint-disable-next-line no-alert
          window.alert('Premium upgrade is coming soon. We will notify you when checkout is live.');
        }}
      >
        Upgrade to Premium
      </button>
    </div>
  );
}

/**
 * POST.9 — /account/billing. Shows the caller's current Subscription
 * row (if any) and links to Stripe's hosted Customer Portal for
 * cancel / change-payment-method / receipt-download.
 *
 * Auth-gated client component. Fetches once on mount; refreshes on
 * focus so a successful Stripe redirect lands with fresh state.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@app/sdk';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface CurrentSubscription {
  readonly id: string;
  readonly status: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
}

interface MyResponse {
  readonly subscription: CurrentSubscription | null;
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return '—';
  const dollars = (cents / 100).toFixed(2);
  return `${currency} ${dollars}`;
}

function statusBadgeClasses(status: string): string {
  if (status === 'active' || status === 'trialing') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
  }
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
}

export default function BillingPage() {
  const bootComplete = useAuthBootComplete();
  const token = useAuthToken();
  const router = useRouter();
  const [data, setData] = useState<MyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (!bootComplete) return;
    if (token === null) {
      router.push('/login?next=/account/billing');
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await apiFetch<{ data: MyResponse; status: number; headers: Headers }>(
          '/api/v1/payments/me/subscription',
          { method: 'GET' },
        );
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (cancelled) return;
        const e = err as { code?: string; status?: number };
        setError(e.code ?? `HTTP_${e.status ?? '???'}`);
      }
    };
    void fetchOnce();
    const onFocus = () => void fetchOnce();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [bootComplete, token, router]);

  const handleManage = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await apiFetch<{ data: { url?: string }; status: number; headers: Headers }>(
        '/api/v1/payments/me/portal-url',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'content-type': 'application/json' },
        },
      );
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        setError('PORTAL_URL_MISSING');
      }
    } catch (err) {
      const e = err as { status?: number; code?: string };
      if (e.status === 503 || e.code === 'PAYMENTS_DISABLED') {
        setError('PAYMENTS_DISABLED');
      } else {
        setError(e.code ?? `HTTP_${e.status ?? '???'}`);
      }
    } finally {
      setPortalBusy(false);
    }
  };

  if (!bootComplete || token === null) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <section className="space-y-4" aria-labelledby="billing-h1">
      <header className="space-y-2">
        <Link
          href={'/account' as never}
          className="text-xs text-muted underline-offset-2 hover:underline"
        >
          ← Account
        </Link>
        <h1 id="billing-h1" className="text-3xl font-bold tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-muted">
          Manage your subscription, payment method, and invoices.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {error === 'PAYMENTS_DISABLED'
            ? 'Stripe is not configured in this environment yet. Billing actions are disabled.'
            : `Could not load billing info: ${error}.`}
        </p>
      ) : null}

      {data === null ? (
        <p className="text-sm text-muted">Loading subscription…</p>
      ) : data.subscription === null ? (
        <article className="rounded-md border border-muted/15 bg-surface p-4">
          <h2 className="text-base font-semibold">You're on the Free plan</h2>
          <p className="mt-1 text-sm text-muted">
            Unlimited trips, drafts, and AI plan generation with our built-in planner.
          </p>
          <Link
            href={'/pricing' as never}
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-linear-to-br from-amber-500 to-amber-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Upgrade to Premium →
          </Link>
        </article>
      ) : (
        <article className="space-y-3 rounded-md border border-muted/15 bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Premium</h2>
            <span
              className={
                'rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                statusBadgeClasses(data.subscription.status)
              }
            >
              {data.subscription.status}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Price</dt>
            <dd>{formatPrice(data.subscription.priceCents, data.subscription.currency)} / month</dd>
            <dt className="text-muted">Renews</dt>
            <dd>{new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}</dd>
            <dt className="text-muted">Cancels at period end</dt>
            <dd>{data.subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</dd>
          </dl>
          <button
            type="button"
            disabled={portalBusy}
            onClick={handleManage}
            className="rounded-md border border-muted/20 bg-surface px-4 py-1.5 text-sm font-semibold hover:bg-muted/5 disabled:opacity-60"
          >
            {portalBusy ? 'Opening Stripe…' : 'Manage subscription in Stripe →'}
          </button>
          <p className="text-[11px] text-muted">
            Cancel anytime. You keep Premium until{' '}
            {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}.
          </p>
        </article>
      )}
    </section>
  );
}

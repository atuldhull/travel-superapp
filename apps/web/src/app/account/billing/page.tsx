/**
 * POST.9 — /account/billing. Shows the caller's current Subscription
 * row (if any) and links to Stripe's hosted Customer Portal for
 * cancel / change-payment-method / receipt-download.
 *
 * Auth-gated client component. Fetches once on mount; refreshes on
 * focus so a successful Stripe redirect lands with fresh state.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, ExternalLink, Sparkles } from 'lucide-react';
import { paymentsControllerMySubscription, paymentsControllerPortalUrl } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
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

// Subscription status is a semantic state — keep the traffic-light intent:
// healthy → success (green), terminated → danger (rose), pending → gold.
function statusVariant(status: string): 'success' | 'danger' | 'gold' {
  if (status === 'active' || status === 'trialing') return 'success';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'danger';
  }
  return 'gold';
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
        const res = (await paymentsControllerMySubscription()) as unknown as { data: MyResponse };
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
      const res = (await paymentsControllerPortalUrl({
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })) as unknown as { data: { url?: string } };
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
    <main className="space-y-8" aria-labelledby="billing-h1">
      <Link
        href={'/account' as never}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Account
      </Link>

      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <CreditCard aria-hidden className="h-3.5 w-3.5" /> Membership
        </p>
        <h1
          id="billing-h1"
          className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl"
        >
          Billing
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Manage your subscription, payment method, and invoices.
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error === 'PAYMENTS_DISABLED'
            ? 'Stripe is not configured in this environment yet. Billing actions are disabled.'
            : `Could not load billing info: ${error}.`}
        </p>
      ) : null}

      {data === null ? (
        <p className="text-sm text-muted">Loading subscription…</p>
      ) : data.subscription === null ? (
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="text-xl">You&apos;re on the Free plan</CardTitle>
            <CardSubtitle>
              Unlimited trips, drafts, and AI plan generation with our built-in planner.
            </CardSubtitle>
          </CardHeader>
          <Link href={'/pricing' as never} className="mt-3 inline-block">
            <Button variant="royal" size="md">
              <Sparkles aria-hidden className="h-4 w-4" /> Upgrade to Premium
            </Button>
          </Link>
        </Card>
      ) : (
        <Card depth="raised">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl">Premium</CardTitle>
              <Badge variant={statusVariant(data.subscription.status)}>
                {data.subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm text-surface-foreground">
            <dt className="text-muted">Price</dt>
            <dd>{formatPrice(data.subscription.priceCents, data.subscription.currency)} / month</dd>
            <dt className="text-muted">Renews</dt>
            <dd>{new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}</dd>
            <dt className="text-muted">Cancels at period end</dt>
            <dd>{data.subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</dd>
          </dl>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={portalBusy}
              onClick={handleManage}
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              {portalBusy ? 'Opening Stripe…' : 'Manage subscription in Stripe'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Cancel anytime. You keep Premium until{' '}
            {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}.
          </p>
        </Card>
      )}
    </main>
  );
}

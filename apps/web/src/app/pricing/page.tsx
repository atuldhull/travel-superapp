/**
 * POST.6 — Pricing page. Three-tier card grid (Free / Premium /
 * Agent). The Premium CTA mirrors the existing PremiumGate
 * placeholder — `window.alert("coming soon")` — so it stays
 * consistent until [POST.9] wires Stripe.
 *
 * Client component because the Premium CTA + Agent contact-mail
 * handlers run in the browser. Cards themselves are pure layout
 * so a future SSR-prerender pass would still hydrate cleanly.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { paymentsControllerCheckout } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { useRouter } from 'next/navigation';

interface Tier {
  readonly id: 'free' | 'premium' | 'agent';
  readonly name: string;
  readonly tagline: string;
  readonly price: string;
  readonly priceNote: string;
  readonly features: readonly string[];
  readonly cta: { readonly label: string; readonly onClick?: () => void; readonly href?: string };
  readonly highlight?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Plan your next trip in minutes.',
    price: '$0',
    priceNote: 'Forever free, no card required',
    features: [
      'Unlimited trips, drafts, and itineraries',
      'AI plan generation (built-in planner)',
      'Up to 1 GB of photos + memory books',
      'Public sharing via codes',
      'Trip overview with weather + places',
    ],
    cta: { label: 'Get started', href: '/register' },
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'The full power of our AI + concierge.',
    price: '$9',
    priceNote: 'per month, cancel anytime',
    features: [
      'Everything in Free, plus —',
      'Claude / Gemini-grade AI plans (premium providers)',
      '50 GB of photos + memory books',
      'Hand-picked stays + curated-only filters',
      'Concierge agent matching for complex trips',
      'Priority email support',
    ],
    // POST.9 — Premium CTA is wired by PricingPage itself (it needs
    // hooks for the auth token + redirect). Falls back to the
    // "coming soon" alert when the api 503s the checkout route
    // (i.e. STRIPE_SECRET_KEY is unset for that environment).
    cta: { label: 'Upgrade to Premium' },
    highlight: true,
  },
  {
    id: 'agent',
    name: 'Agent',
    tagline: 'Are you a travel agent? Let’s talk.',
    price: 'Custom',
    priceNote: 'Revenue share, contact us',
    features: [
      'Agent profile + KYC review',
      'Trip-match auction surface',
      'Booking escrow via Stripe Connect',
      'Reviews, ratings, dashboard analytics',
      'Direct contact from premium travellers',
    ],
    cta: {
      label: 'Email sales',
      href: 'mailto:sales@travel.local?subject=Agent%20program%20enquiry',
    },
  },
];

/** POST.9 — Premium upgrade flow. Calls POST /payments/checkout and
 *  redirects to Stripe-hosted checkout on success. Falls back to a
 *  "coming soon" alert when the api 503s (Stripe not configured for
 *  this env) so the page stays useful even pre-Stripe-wiring. Bounces
 *  to /login when the caller isn't signed in. */
function useUpgradeToPremium() {
  const token = useAuthToken();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const handleUpgrade = async () => {
    if (busy) return;
    if (token === null) {
      router.push('/login?next=/pricing');
      return;
    }
    setBusy(true);
    try {
      const res = (await paymentsControllerCheckout({
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })) as unknown as { data: { url?: string } };
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      // Defensive: 200 without a URL shouldn't happen, but don't hang.
      // eslint-disable-next-line no-alert
      window.alert('Checkout could not start. Please try again.');
    } catch (err) {
      const e = err as { status?: number; code?: string };
      if (e.status === 503 || e.code === 'PAYMENTS_DISABLED') {
        // eslint-disable-next-line no-alert
        window.alert(
          'Premium checkout is not configured in this environment yet. ' +
            'We will notify you via the in-app inbox when it goes live.',
        );
      } else {
        // eslint-disable-next-line no-alert
        window.alert(`Could not start checkout: ${e.code ?? `HTTP_${e.status ?? '???'}`}.`);
      }
    } finally {
      setBusy(false);
    }
  };
  return { handleUpgrade, busy };
}

export default function PricingPage() {
  const { handleUpgrade, busy } = useUpgradeToPremium();
  return (
    <section className="space-y-6" aria-labelledby="pricing-h1">
      <header className="space-y-2 text-center">
        <h1 id="pricing-h1" className="text-3xl font-bold tracking-tight">
          Simple pricing
        </h1>
        <p className="text-sm text-muted">
          Free for ever. Upgrade when you need the premium-grade AI + concierge.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <article
            key={t.id}
            className={
              'flex flex-col rounded-lg border p-5 ' +
              (t.highlight
                ? 'border-amber-500/40 bg-amber-500/5 shadow-(--shadow-depth-2)'
                : 'border-muted/15 bg-surface')
            }
          >
            <header className="space-y-1">
              <h2 className="text-lg font-semibold">
                {t.name}
                {t.highlight ? (
                  <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Most popular
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-muted">{t.tagline}</p>
            </header>
            <p className="mt-4 text-3xl font-bold">{t.price}</p>
            <p className="text-xs text-muted">{t.priceNote}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-brand">
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              {t.cta.href ? (
                <Link
                  href={t.cta.href as never}
                  className={
                    'inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ' +
                    (t.highlight
                      ? 'bg-linear-to-br from-amber-500 to-amber-600 text-white shadow-sm hover:opacity-90'
                      : 'border border-muted/20 bg-surface hover:bg-muted/5')
                  }
                >
                  {t.cta.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={t.id === 'premium' ? handleUpgrade : t.cta.onClick}
                  disabled={t.id === 'premium' && busy}
                  className={
                    'inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ' +
                    (t.highlight
                      ? 'bg-linear-to-br from-amber-500 to-amber-600 text-white shadow-sm hover:opacity-90'
                      : 'border border-muted/20 bg-surface hover:bg-muted/5')
                  }
                >
                  {t.id === 'premium' && busy ? 'Starting checkout…' : t.cta.label}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <footer className="rounded-md border border-muted/15 bg-muted/5 p-4 text-xs text-muted">
        <p>
          <strong>Questions?</strong> Check the{' '}
          <Link href={'/help' as never} className="underline-offset-2 hover:underline">
            help centre
          </Link>{' '}
          or email{' '}
          <a href="mailto:hello@travel.local" className="underline-offset-2 hover:underline">
            hello@travel.local
          </a>
          . Subscriptions are billed via Stripe; cancel anytime from your account page.
        </p>
      </footer>
    </section>
  );
}

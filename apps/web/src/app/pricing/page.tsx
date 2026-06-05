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
import { Check, Sparkles } from 'lucide-react';
import { paymentsControllerCheckout } from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
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

      window.alert('Checkout could not start. Please try again.');
    } catch (err) {
      const e = err as { status?: number; code?: string };
      if (e.status === 503 || e.code === 'PAYMENTS_DISABLED') {
        window.alert(
          'Premium checkout is not configured in this environment yet. ' +
            'We will notify you via the in-app inbox when it goes live.',
        );
      } else {
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
    <main className="space-y-8" aria-labelledby="pricing-h1">
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
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Plans &amp; pricing
        </p>
        <h1
          id="pricing-h1"
          className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl"
        >
          Simple pricing
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Free for ever. Upgrade when you need the premium-grade AI + concierge.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card
            as="article"
            key={t.id}
            depth={t.highlight ? 'floating' : 'raised'}
            className={'flex flex-col ' + (t.highlight ? 'border-gold-500/40 bg-gold-500/5' : '')}
          >
            <CardHeader>
              <CardTitle>
                {t.name}
                {t.highlight ? (
                  <Badge variant="gold" className="ml-2 align-middle">
                    Most popular
                  </Badge>
                ) : null}
              </CardTitle>
              <CardSubtitle>{t.tagline}</CardSubtitle>
            </CardHeader>
            <p className="font-display text-4xl font-semibold tracking-tight text-surface-foreground">
              {t.price}
            </p>
            <p className="text-xs text-muted">{t.priceNote}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              {t.cta.href ? (
                <Link
                  href={t.cta.href as never}
                  className={
                    'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
                    (t.highlight
                      ? 'text-brand-900 shadow-(--shadow-glow) bg-[image:var(--gradient-gold)] hover:-translate-y-0.5'
                      : 'border border-brand/35 text-brand hover:-translate-y-0.5 hover:bg-brand/8 hover:border-brand/60')
                  }
                >
                  {t.cta.label}
                </Link>
              ) : (
                <Button
                  type="button"
                  onClick={t.id === 'premium' ? handleUpgrade : t.cta.onClick}
                  disabled={t.id === 'premium' && busy}
                  variant={t.highlight ? 'royal' : 'outline'}
                  className="w-full"
                >
                  {t.id === 'premium' && busy ? 'Starting checkout…' : t.cta.label}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <footer className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-xs text-muted shadow-(--shadow-depth-1)">
        <p>
          <strong>Questions?</strong> Check the{' '}
          <Link
            href={'/help' as never}
            className="text-gold-600 underline-offset-2 transition hover:underline"
          >
            help centre
          </Link>{' '}
          or email{' '}
          <a
            href="mailto:hello@travel.local"
            className="text-gold-600 underline-offset-2 transition hover:underline"
          >
            hello@travel.local
          </a>
          . Subscriptions are billed via Stripe; cancel anytime from your account page.
        </p>
      </footer>
    </main>
  );
}

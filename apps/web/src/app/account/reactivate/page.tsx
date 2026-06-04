/**
 * V.UX.33 — account-reactivation landing page. Two entry points
 * land here:
 *
 *   1. The deletion-pending email (`?token=...`).
 *   2. /login forwarding when `ACCOUNT_DELETION_PENDING` fires
 *      with a fresh token.
 *
 * The page reads the token from the URL, calls `POST /account/reactivate`,
 * and shows one of three terminal states:
 *
 *   - 200 → "Restored. Sign in." → primary CTA to /login.
 *   - 404 ACCOUNT_NOT_RECOVERABLE → "Already restored or 7-day window
 *     closed; create a fresh account."
 *   - 401 REACTIVATION_INVALID → "Link expired or tampered; request
 *     a fresh deletion-pending email by signing in."
 *
 * Reactivation auto-fires on first mount if a token is present —
 * the user has already shown intent (clicking the email link OR
 * being routed from /login). Cancellation handled via a guard on
 * the in-flight ref.
 *
 * Installed by prompt [V.UX.33]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens).
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAccountControllerReactivate } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { announce } from '../../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Outcome =
  | { kind: 'pending' }
  | { kind: 'restored' }
  | { kind: 'not-recoverable' }
  | { kind: 'invalid'; message: string };

export default function ReactivatePage() {
  // useSearchParams forces dynamic rendering; wrap in Suspense per
  // Next.js 15 CSR-bailout requirement.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ReactivateInner />
    </Suspense>
  );
}

function ReactivateInner() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const reactivate = useAccountControllerReactivate();
  const firedRef = useRef(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' });

  useEffect(() => {
    if (firedRef.current) return;
    if (!token) {
      setOutcome({ kind: 'invalid', message: 'No reactivation token in the URL.' });
      return;
    }
    firedRef.current = true;
    reactivate
      .mutateAsync({ data: { token } })
      .then(() => {
        setOutcome({ kind: 'restored' });
        announce('Account restored. Please sign in.');
      })
      .catch((err: unknown) => {
        const e = err as ApiError;
        if (e.code === 'ACCOUNT_NOT_RECOVERABLE' || e.status === 404) {
          setOutcome({ kind: 'not-recoverable' });
        } else {
          setOutcome({
            kind: 'invalid',
            message: e.message ?? 'Reactivation link is invalid or expired.',
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="space-y-8">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to sign-in
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
          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Account recovery
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Restore your account
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          We’re verifying your reactivation link and bringing your travels back to life.
        </p>
      </header>

      {outcome.kind === 'pending' ? (
        <Card depth="raised">
          <CardHeader>
            <CardTitle>Restoring…</CardTitle>
            <CardSubtitle>Verifying the reactivation link.</CardSubtitle>
          </CardHeader>
        </Card>
      ) : null}

      {outcome.kind === 'restored' ? (
        <Card depth="raised" className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="h-5 w-5 text-emerald-500" />
              <CardTitle>Welcome back</CardTitle>
              <Badge variant="success">Restored</Badge>
            </div>
            <CardSubtitle>
              Your account is active again. All sessions were revoked at delete time, so sign in
              fresh below.
            </CardSubtitle>
          </CardHeader>
          <Link href="/login" className="mt-3 inline-block">
            <Button variant="royal" size="sm">
              Sign in
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      ) : null}

      {outcome.kind === 'not-recoverable' ? (
        <Card depth="raised">
          <CardHeader>
            <CardTitle>Already restored — or window closed</CardTitle>
            <CardSubtitle>
              The link succeeded earlier, OR the 7-day retention period ended and your data has been
              wiped.
            </CardSubtitle>
          </CardHeader>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Try sign-in
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="royal" size="sm">
                Create a fresh account
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {outcome.kind === 'invalid' ? (
        <Card depth="raised" className="border-danger/30 bg-danger/5">
          <CardHeader>
            <CardTitle>Reactivation link expired or tampered</CardTitle>
            <CardSubtitle className="text-danger">{outcome.message}</CardSubtitle>
          </CardHeader>
          <p className="text-sm text-muted">
            Sign in with your email + password — if the account is still recoverable, we&apos;ll
            issue a fresh reactivation link inside the response.
          </p>
          <div className="mt-3">
            <Button variant="royal" size="sm" onClick={() => (window.location.href = '/login')}>
              Back to sign-in
            </Button>
          </div>
        </Card>
      ) : null}
    </main>
  );
}

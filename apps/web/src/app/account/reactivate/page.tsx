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
 * Installed by prompt [V.UX.33].
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useAccountControllerReactivate } from '@app/sdk';
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
    <main className="space-y-6">
      <p>
        <Link href="/login" className="text-sm text-muted hover:underline">
          ← Back to sign-in
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Restore your account</h1>

      {outcome.kind === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>Restoring…</CardTitle>
            <CardSubtitle>Verifying the reactivation link.</CardSubtitle>
          </CardHeader>
        </Card>
      ) : null}

      {outcome.kind === 'restored' ? (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle>✅ Welcome back</CardTitle>
            <CardSubtitle>
              Your account is active again. All sessions were revoked at delete time, so sign in
              fresh below.
            </CardSubtitle>
          </CardHeader>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
          >
            Sign in →
          </Link>
        </Card>
      ) : null}

      {outcome.kind === 'not-recoverable' ? (
        <Card>
          <CardHeader>
            <CardTitle>Already restored — or window closed</CardTitle>
            <CardSubtitle>
              The link succeeded earlier, OR the 7-day retention period ended and your data has been
              wiped.
            </CardSubtitle>
          </CardHeader>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 rounded-md border border-muted/30 px-3 py-1.5 text-sm transition hover:bg-muted/10"
            >
              Try sign-in →
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
            >
              Create a fresh account
            </Link>
          </div>
        </Card>
      ) : null}

      {outcome.kind === 'invalid' ? (
        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle>Reactivation link expired or tampered</CardTitle>
            <CardSubtitle>{outcome.message}</CardSubtitle>
          </CardHeader>
          <p className="text-sm text-muted">
            Sign in with your email + password — if the account is still recoverable, we&apos;ll
            issue a fresh reactivation link inside the response.
          </p>
          <div className="mt-3">
            <Button onClick={() => (window.location.href = '/login')}>Back to sign-in</Button>
          </div>
        </Card>
      ) : null}
    </main>
  );
}

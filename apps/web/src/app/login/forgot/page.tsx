/**
 * V.UX.31 — request-password-reset page. Mirrors the magic-link
 * request UX: email-only form, success message regardless of whether
 * the address is registered (enumeration-safe matches the api).
 *
 * The api soft-rate-limits at 5 tokens per email per 15-minute
 * window; the page intentionally doesn't surface that count to the
 * user (don't leak quotas to attackers).
 *
 * Installed by prompt [V.UX.31].
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAuthControllerPasswordResetRequest } from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { announce } from '../../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const request = useAuthControllerPasswordResetRequest();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await request.mutateAsync({ data: { email } });
      setSent(true);
      announce('Reset email queued — check your inbox');
    } catch (err) {
      const e = err as ApiError;
      setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Request failed.'}`);
    }
  }

  return (
    <main className="space-y-8">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Back to sign-in
      </Link>

      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <KeyRound aria-hidden className="h-3.5 w-3.5" /> Account recovery
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Trouble signing in?
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Reset your password in a couple of taps — we&apos;ll email you a one-time link.
        </p>
      </header>

      {sent ? (
        <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm shadow-(--shadow-depth-1)">
          <p>
            If the address is registered, a password-reset link is on its way. The link expires in
            15 minutes and can only be used once.
          </p>
          <p className="text-xs text-muted">
            Didn&apos;t arrive? Check spam, then{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-gold-600 underline-offset-2 hover:underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      ) : (
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="font-display text-xl">Send a reset link</CardTitle>
            <CardSubtitle>
              Enter the email you signed up with. We&apos;ll send a link to set a new password.
            </CardSubtitle>
          </CardHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {errorMsg ? (
              <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
                {errorMsg}
              </p>
            ) : null}
            <Button type="submit" variant="royal" disabled={request.isPending}>
              {request.isPending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-2 text-sm text-muted">
        <p>
          Lost your authenticator?{' '}
          <Link
            href={'/login/mfa-recover' as never}
            className="text-gold-600 underline-offset-2 hover:underline"
          >
            Use an MFA backup code →
          </Link>
        </p>
        <p>
          Still locked out? Email{' '}
          <a
            href="mailto:support@travelsuperapp.local"
            className="text-gold-600 underline-offset-2 hover:underline"
          >
            support@travelsuperapp.local
          </a>{' '}
          — we verify identity via past trip details + signed receipts.
        </p>
      </div>
    </main>
  );
}

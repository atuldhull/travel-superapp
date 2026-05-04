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
import { useAuthControllerPasswordResetRequest } from '@app/sdk';
import { Button } from '../../../components/ui/button';
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
    <main className="space-y-6">
      <p>
        <Link href="/login" className="text-sm text-muted hover:underline">
          ← Back to sign-in
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Trouble signing in?</h1>
      {sent ? (
        <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p>
            If the address is registered, a password-reset link is on its way. The link expires in
            15 minutes and can only be used once.
          </p>
          <p className="text-xs text-muted">
            Didn&apos;t arrive? Check spam, then{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-brand underline-offset-2 hover:underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            Enter the email you signed up with. We&apos;ll send a link to set a new password.
          </p>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <div className="space-y-2 text-sm text-muted">
        <p>
          Lost your authenticator?{' '}
          <Link
            href={'/login/mfa-recover' as never}
            className="text-brand underline-offset-2 hover:underline"
          >
            Use an MFA backup code →
          </Link>
        </p>
        <p>
          Still locked out? Email{' '}
          <a
            href="mailto:support@travelsuperapp.local"
            className="text-brand underline-offset-2 hover:underline"
          >
            support@travelsuperapp.local
          </a>{' '}
          — we verify identity via past trip details + signed receipts.
        </p>
      </div>
    </main>
  );
}

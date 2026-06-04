/**
 * V.UX.31 — consume-password-reset page. Reads the 64-hex token from
 * the URL, prompts for a new password (matching the api's 12..128
 * complexity rule), POSTs to `/auth/password-reset/consume`. On
 * success, bounces to /login — we do NOT auto-issue a session
 * (matches api posture: a "borrowed device" reset shouldn't leave a
 * session in the borrowed browser).
 *
 * Failure modes:
 *   - 401 RESET_TOKEN_INVALID → token expired / already used.
 *   - 422 WEAK_PASSWORD / VALIDATION_FAILED → too short / wrong shape.
 *
 * Installed by prompt [V.UX.31].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAuthControllerPasswordResetConsume } from '@app/sdk';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardSubtitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { announce } from '../../../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const consume = useAuthControllerPasswordResetConsume();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setErrorMsg('Use at least 12 characters.');
      return;
    }
    try {
      await consume.mutateAsync({ data: { token, newPassword: password } });
      announce('Password updated — please sign in');
      router.replace('/login');
    } catch (err) {
      const e = err as ApiError;
      const code = e.code ?? `HTTP_${e.status ?? '???'}`;
      const friendly =
        code === 'RESET_TOKEN_INVALID'
          ? 'This reset link has expired or already been used. Request a new one.'
          : code === 'WEAK_PASSWORD' || code === 'VALIDATION_FAILED'
            ? 'Password must be 12–128 characters.'
            : (e.message ?? 'Reset failed.');
      setErrorMsg(`${code} — ${friendly}`);
    }
  }

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return (
      <main className="space-y-8">
        <header
          className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
          style={{ backgroundImage: 'var(--gradient-royal)' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
          />
          <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
            <KeyRound aria-hidden className="h-3.5 w-3.5" /> Password reset
          </p>
          <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Reset link looks malformed
          </h1>
          <p className="relative mt-2 max-w-lg text-sm text-white/65">
            The token in the URL doesn&apos;t match the expected format.
          </p>
        </header>
        <Card depth="raised">
          <CardSubtitle>
            Open the link from your email exactly as it arrived, or{' '}
            <Link
              href={'/login/forgot' as never}
              className="text-gold-600 underline-offset-2 transition hover:text-gold-500 hover:underline"
            >
              request a fresh one
            </Link>
            .
          </CardSubtitle>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to sign-in
        </Link>
      </p>
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <KeyRound aria-hidden className="h-3.5 w-3.5" /> Password reset
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Set a new password
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Choose a strong password — 12 characters minimum. We won&apos;t sign you in here, so head
          back to sign-in once it&apos;s set.
        </p>
      </header>
      <Card depth="raised">
        <CardHeader>
          <CardTitle>New password</CardTitle>
          <CardSubtitle>Enter it twice to confirm.</CardSubtitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="12 characters minimum."
            required
          />
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {errorMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" variant="royal" disabled={consume.isPending}>
            {consume.isPending ? 'Updating…' : 'Set password & sign in'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

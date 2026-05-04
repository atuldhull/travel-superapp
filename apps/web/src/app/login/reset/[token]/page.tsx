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
import { useAuthControllerPasswordResetConsume } from '@app/sdk';
import { Button } from '../../../../components/ui/button';
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
      <main className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Reset link looks malformed</h1>
        <p className="text-sm text-muted">
          The token in the URL doesn&apos;t match the expected format. Open the link from your email
          exactly as it arrived, or{' '}
          <Link
            href={'/login/forgot' as never}
            className="text-brand underline-offset-2 hover:underline"
          >
            request a fresh one
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/login" className="text-sm text-muted hover:underline">
          ← Back to sign-in
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
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
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <Button type="submit" disabled={consume.isPending}>
          {consume.isPending ? 'Updating…' : 'Set password & sign in'}
        </Button>
      </form>
    </main>
  );
}

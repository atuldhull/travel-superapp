/**
 * Login page. Two-step UX when MFA is enabled on the account:
 *
 *   1. First call sends { email, password } only.
 *      - Success → token stored, redirect to /trips.
 *      - 401 MFA_REQUIRED → swap to the MFA prompt step.
 *      - other 401 / failure → inline error.
 *   2. Second call sends { email, password, mfaCode } (TOTP or backup
 *      code; LoginRequestDto regex accepts both — `\d{6}` or
 *      `[A-Za-z0-9]{8}`).
 *      - Success → token stored, redirect to /trips.
 *      - 401 MFA_INVALID → inline error, prompt stays open.
 *
 * Auth posture (CLAUDE rule 12):
 *   - Access token → in-memory `auth-store` only.
 *   - Refresh cookie → httpOnly, set by the api on /api/v1/auth.
 *   - Hard reload → silent-refresh resurrects the session.
 *
 * Installed by [IV.18.19.21]; UI primitives [IV.18.19.23]; MFA UI
 * added in [IV.18.19.26].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useAuthControllerLogin,
  type AuthSuccessResponseDto,
  type LoginRequestDto,
} from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/input';
import { setAccessToken } from '../../lib/auth-store';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Step = 'credentials' | 'mfa';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loginMutation = useAuthControllerLogin({
    mutation: {
      onSuccess: (response: unknown) => {
        const body = response as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        router.push('/trips');
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        if (e.code === 'MFA_REQUIRED') {
          setStep('mfa');
          setErrorMsg(null);
          return;
        }
        if (e.code === 'MFA_INVALID') {
          setErrorMsg('Invalid MFA code. Try again.');
          return;
        }
        setErrorMsg(e.message || 'Login failed.');
      },
    },
  });

  function submitCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const data: LoginRequestDto = { email, password };
    loginMutation.mutate({ data });
  }

  function submitMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    // Re-send credentials + the code; the api's LoginUseCase inspects
    // mfaCode shape to pick the verifier (6-digit TOTP vs 8-char backup).
    const data: LoginRequestDto = { email, password, mfaCode };
    loginMutation.mutate({ data });
  }

  function backToCredentials() {
    setStep('credentials');
    setMfaCode('');
    setErrorMsg(null);
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">
        {step === 'credentials' ? 'Sign in' : 'Two-factor authentication'}
      </h1>
      {step === 'credentials' ? (
        <form onSubmit={submitCredentials} className="space-y-4">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted">
            New here?{' '}
            <Link href="/register" className="text-brand hover:underline">
              Create an account →
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitMfa} className="space-y-4">
          <p className="text-sm text-muted">
            Enter the 6-digit code from your authenticator app, or one of your 8-character backup
            codes.
          </p>
          <Field
            label="MFA code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.trim())}
            required
            pattern="\d{6}|[A-Za-z0-9]{8}"
            help="6-digit TOTP or 8-character backup code."
          />
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Verifying…' : 'Verify'}
            </Button>
            <Button type="button" variant="ghost" onClick={backToCredentials}>
              Back
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}

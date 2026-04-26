/**
 * Login page. Email + password (no MFA UI yet — MFA_REQUIRED comes
 * back as 401 and surfaces in the inline error today; the second-call
 * MFA prompt lands in a follow-up slice).
 *
 * Auth posture (CLAUDE rule 12):
 *   - Access token goes into the in-memory `auth-store` only.
 *   - Refresh cookie is set by the api on `/api/v1/auth` — httpOnly
 *     so client JS can never read it.
 *   - On hard reload silent-refresh runs (see providers.tsx) so a
 *     valid refresh cookie auto-restores the session.
 *
 * Installed by prompt [IV.18.19.21]; refactored to UI primitives in
 * [IV.18.19.23].
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setErrorMsg(
          e.code === 'MFA_REQUIRED'
            ? 'MFA is required (UI lands soon).'
            : e.message || 'Login failed.',
        );
      },
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const data: LoginRequestDto = { email, password };
    loginMutation.mutate({ data });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
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
      </form>
    </main>
  );
}

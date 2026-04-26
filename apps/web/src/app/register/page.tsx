/**
 * Register page. Email + password + displayName. On success the api
 * sets the refresh cookie + returns the access token; we drop the
 * token into the in-memory auth-store and redirect to /trips,
 * mirroring login's auto-sign-in behaviour.
 *
 * Password policy mirrors the Zod schema in api `auth.dto.ts`
 * (min 12, max 128). Inline `pattern` + `minLength` + `maxLength`
 * give the browser a chance to surface obvious mistakes before the
 * api round-trip.
 *
 * Auth posture (CLAUDE rule 12): in-memory token only; httpOnly
 * refresh cookie on /api/v1/auth.
 *
 * Installed by prompt [IV.18.19.31].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useAuthControllerRegister,
  type AuthSuccessResponseDto,
  type RegisterRequestDto,
} from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/input';
import { setAccessToken } from '../../lib/auth-store';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const registerMutation = useAuthControllerRegister({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        router.push('/trips');
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          e.code === 'EMAIL_TAKEN'
            ? 'That email is already registered. Try signing in instead.'
            : e.message || 'Registration failed.',
        );
      },
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const data: RegisterRequestDto = { email, password, displayName };
    registerMutation.mutate({ data });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Display name"
          type="text"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={1}
          maxLength={60}
          help="1..60 characters."
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          maxLength={128}
          help="At least 12 characters."
        />
        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <Button type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-brand hover:underline">
          Sign in →
        </Link>
      </p>
    </main>
  );
}

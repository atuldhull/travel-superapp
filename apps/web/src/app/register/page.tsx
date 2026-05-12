/**
 * Register page. Two paths in priority order:
 *
 *   1. **Magic link (passwordless)** — email-only. Posts to
 *      /auth/magic-link/request, shows a "check your email" toast.
 *      Faster path, surfaced ABOVE the password form so first-time
 *      users see the lower-friction option first (V.UX.2).
 *
 *   2. **Email + password** — full registration. On success the api
 *      sets the refresh cookie + returns the access token; we drop
 *      the token into the in-memory auth-store and redirect to
 *      /trips, mirroring login's auto-sign-in behaviour.
 *
 * Password policy mirrors the Zod schema in api `auth.dto.ts`
 * (min 12, max 128). Inline `pattern` + `minLength` + `maxLength`
 * give the browser a chance to surface obvious mistakes before the
 * api round-trip.
 *
 * Auth posture (CLAUDE rule 12): in-memory token only; httpOnly
 * refresh cookie on /api/v1/auth.
 *
 * Installed by [IV.18.19.31]; magic-link option added in [V.UX.2].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
  useAuthControllerMagicLinkRequest,
  useAuthControllerRegister,
  type AuthSuccessResponseDto,
  type MagicLinkRequestRequestDto,
  type RegisterRequestDto,
} from '@app/sdk';
import { GoogleSignInButton } from '../../components/google-sign-in-button';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/input';
import { setAccessToken } from '../../lib/auth-store';
import { decidePostAuthDestination } from '../../lib/post-auth-redirect';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function RegisterPage() {
  const router = useRouter();

  // Magic-link form state.
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  // Password-form state.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const magicLinkMutation = useAuthControllerMagicLinkRequest({
    mutation: {
      onSuccess: () => {
        setMagicSent(true);
        setMagicError(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setMagicError(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Request failed.'}`,
        );
      },
    },
  });

  const registerMutation = useAuthControllerRegister({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        // Brand-new account → hasSeenOnboarding=false → /onboarding.
        const { destination } = await decidePostAuthDestination(body.accessToken);
        router.push(destination as never);
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

  function onMagicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMagicError(null);
    setMagicSent(false);
    const data: MagicLinkRequestRequestDto = { email: magicEmail };
    magicLinkMutation.mutate({ data });
  }

  function onRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
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

      {/* POST.3 — Google OAuth path. Renders nothing when
          NEXT_PUBLIC_GOOGLE_CLIENT_ID is absent (dev fallback). */}
      <section className="rounded-xl border border-muted/15 bg-surface p-5">
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="text-xl">
            🌐
          </span>
          <h2 className="text-lg font-semibold">Continue with Google</h2>
        </header>
        <p className="mb-4 text-sm text-muted">
          Faster — no password to remember. We&apos;ll create your account on first sign-in.
        </p>
        <GoogleSignInButton
          onSignedIn={() => router.push('/onboarding' as never)}
          onError={(msg) => setErrorMsg(msg)}
        />
      </section>

      {/* ───── Magic-link path ───────────────────────────────────────── */}
      <section className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="text-xl">
            ✨
          </span>
          <h2 className="text-lg font-semibold">Email me a sign-in link</h2>
        </header>
        <p className="mb-4 text-sm text-muted">
          Skip the password. We'll send a one-tap link to your inbox — works for new accounts and
          existing ones.
        </p>
        {magicSent ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
            <span aria-hidden className="mr-1.5">
              ✉️
            </span>
            Check <strong>{magicEmail}</strong> — your sign-in link should arrive in seconds. The
            link expires in 15 minutes.
          </p>
        ) : (
          <form onSubmit={onMagicSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:flex-1">
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                required
                maxLength={254}
              />
            </div>
            <Button type="submit" variant="primary" disabled={magicLinkMutation.isPending}>
              {magicLinkMutation.isPending ? 'Sending…' : 'Send sign-in link'}
            </Button>
          </form>
        )}
        {magicError ? (
          <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {magicError}
          </p>
        ) : null}
      </section>

      {/* ───── Divider ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-muted/20" />
        <span>or use a password</span>
        <span className="h-px flex-1 bg-muted/20" />
      </div>

      {/* ───── Password form ───────────────────────────────────────── */}
      <form onSubmit={onRegisterSubmit} className="space-y-4">
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

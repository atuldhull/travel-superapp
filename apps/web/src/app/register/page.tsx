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
import { AuthError, AuthShell } from '../../components/auth/auth-shell';
import { OtpSignIn } from '../../components/auth/otp-sign-in';
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

  // OtpSignIn already stored the token; route via the shared decision
  // (a brand-new code account lands in onboarding → the Aura quiz).
  async function handleOtpSignedIn() {
    const { getAccessToken } = await import('../../lib/auth-store');
    const token = getAccessToken();
    if (!token) return;
    const { destination } = await decidePostAuthDestination(token);
    router.push(destination as never);
  }

  return (
    <AuthShell
      eyebrow="Join the journey"
      title="Create your account"
      subtitle="Plan smarter, travel safer, and keep an AI diary of every adventure."
    >
      <div className="space-y-6">
        {/* POST.3 — Google OAuth path. Renders nothing when
            NEXT_PUBLIC_GOOGLE_CLIENT_ID is absent (dev fallback). */}
        <section className="rounded-xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1)">
          <header className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-xl">
              🌐
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
              Continue with Google
            </h2>
          </header>
          <p className="mb-4 text-sm text-muted">
            Faster — no password to remember. We&apos;ll create your account on first sign-in.
          </p>
          <GoogleSignInButton
            onSignedIn={async () => {
              // The button already populated auth-store; route via the
              // shared decision (same path login uses) so a returning
              // Google user lands on /home, a new one on /onboarding.
              const { getAccessToken } = await import('../../lib/auth-store');
              const token = getAccessToken();
              if (!token) return;
              const { destination } = await decidePostAuthDestination(token);
              router.push(destination as never);
            }}
            onError={(msg) => setErrorMsg(msg)}
          />
        </section>

        {/* ───── Magic-link path (premium gold panel) ────────────────── */}
        <section className="rounded-xl border border-gold-600/25 bg-gold-500/5 p-5 shadow-(--shadow-depth-1)">
          <header className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-xl">
              ✨
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
              Email me a sign-in link
            </h2>
          </header>
          <p className="mb-4 text-sm text-muted">
            Skip the password. We&apos;ll send a one-tap link to your inbox — works for new accounts
            and existing ones.
          </p>
          {magicSent ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-surface-foreground">
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
              <Button type="submit" variant="royal" disabled={magicLinkMutation.isPending}>
                {magicLinkMutation.isPending ? 'Sending…' : 'Send sign-in link'}
              </Button>
            </form>
          )}
          {magicError ? (
            <div className="mt-3">
              <AuthError>{magicError}</AuthError>
            </div>
          ) : null}
        </section>

        {/* ───── One-time code path (email OR phone) ────────────────── */}
        <section className="rounded-xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1)">
          <header className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-xl">
              🔑
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
              Use a one-time code
            </h2>
          </header>
          <p className="mb-4 text-sm text-muted">
            Sign up with just your email or phone — we send a 6-digit code, no password to set.
          </p>
          <OtpSignIn onSignedIn={handleOtpSignedIn} />
        </section>

        {/* ───── Divider ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
          <span className="h-px flex-1 bg-gold-600/20" />
          <span>or use a password</span>
          <span className="h-px flex-1 bg-gold-600/20" />
        </div>

        {/* ───── Password form ─────────────────────────────────────── */}
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
          {errorMsg ? <AuthError>{errorMsg}</AuthError> : null}
          <Button type="submit" variant="royal" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-sm text-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-gold-600 transition hover:text-gold-700 hover:underline dark:hover:text-gold-300"
          >
            Sign in →
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

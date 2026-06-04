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
  useAuthControllerOauth,
  type AuthSuccessResponseDto,
  type LoginRequestDto,
  type OAuthSignInRequestDto,
} from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/input';
import { AuthError, AuthShell } from '../../components/auth/auth-shell';
import { GoogleSignInButton } from '../../components/google-sign-in-button';
import { OtpSignIn } from '../../components/auth/otp-sign-in';
import { setAccessToken } from '../../lib/auth-store';
import { decidePostAuthDestination } from '../../lib/post-auth-redirect';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Step = 'credentials' | 'mfa';

interface BanState {
  readonly reason: string;
  readonly bannedAt: string | null;
  readonly email: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // V.UX.34 — when login surfaces ACCOUNT_BANNED, swap the form for
  // an empathetic suspended view with the reason + appeal CTA.
  const [banState, setBanState] = useState<BanState | null>(null);

  const oauthMutation = useAuthControllerOauth({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        const { destination } = await decidePostAuthDestination(body.accessToken);
        router.push(destination as never);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(e.message || 'OAuth sign-in failed.');
      },
    },
  });

  function signInWithMockProvider() {
    setErrorMsg(null);
    // The api's mock provider parses the idToken as JSON. In real flows
    // (Google / Apple) the button libraries return an opaque JWT —
    // this branch only fires in dev where the api registers the mock
    // provider (NODE_ENV !== production). Demo identity is stable so
    // re-sign-ins land on the same account.
    const fakeToken = JSON.stringify({
      providerUserId: 'demo-mock-user',
      email: 'demo@travel.local',
      emailVerified: true,
      displayName: 'Demo User',
    });
    const data: OAuthSignInRequestDto = { idToken: fakeToken };
    oauthMutation.mutate({ provider: 'mock', data });
  }

  const loginMutation = useAuthControllerLogin({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        const { destination } = await decidePostAuthDestination(body.accessToken);
        router.push(destination as never);
      },
      onError: (err: unknown) => {
        const e = err as ApiError & {
          context?: { reactivationToken?: string; banReason?: string; bannedAt?: string };
        };
        if (e.code === 'MFA_REQUIRED') {
          setStep('mfa');
          setErrorMsg(null);
          return;
        }
        if (e.code === 'MFA_INVALID') {
          setErrorMsg('Invalid MFA code. Try again.');
          return;
        }
        // V.UX.34 — admin-banned account. Render the empathetic
        // suspended-state with the reason inline + an Appeal CTA.
        if (e.code === 'ACCOUNT_BANNED' && e.context?.banReason) {
          setBanState({
            reason: e.context.banReason,
            bannedAt: e.context.bannedAt ?? null,
            email,
          });
          setErrorMsg(null);
          return;
        }
        // V.UX.33 — soft-deleted within the 7-day retention window.
        if (e.code === 'ACCOUNT_DELETION_PENDING' && e.context?.reactivationToken) {
          const token = encodeURIComponent(e.context.reactivationToken);
          router.push(`/account/reactivate?token=${token}` as never);
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

  // OtpSignIn already put the token in auth-store; route like Google.
  async function handleOtpSignedIn() {
    const { getAccessToken } = await import('../../lib/auth-store');
    const token = getAccessToken();
    if (!token) return;
    const { destination } = await decidePostAuthDestination(token);
    router.push(destination as never);
  }

  const eyebrow = banState ? 'Account' : step === 'credentials' ? 'Welcome back' : 'Security';
  const title = banState
    ? 'Account suspended'
    : step === 'credentials'
      ? 'Sign in'
      : 'Two-factor authentication';
  const subtitle = banState
    ? undefined
    : step === 'credentials'
      ? 'Pick up your journeys exactly where you left off.'
      : 'One more step to keep your account safe.';

  return (
    <AuthShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      {banState ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Your account has been suspended.
            </p>
            <p className="mt-2">
              <strong>Reason:</strong> {banState.reason}
            </p>
            {banState.bannedAt ? (
              <p className="mt-1 text-xs text-muted">
                Suspended on {new Date(banState.bannedAt).toLocaleDateString()}.
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted">
            We review every appeal personally. If you think this was a mistake, send us your side —
            we&apos;ll get back within 1–2 business days.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/appeal?email=${encodeURIComponent(banState.email)}` as never}
              className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold text-brand-900 shadow-(--shadow-depth-1) transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              File an appeal →
            </Link>
            <button
              type="button"
              onClick={() => setBanState(null)}
              className="inline-flex items-center gap-1 rounded-xl border border-gold-600/25 px-4 py-2 text-sm transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Try again
            </button>
          </div>
        </div>
      ) : step === 'credentials' ? (
        method === 'otp' ? (
          <div className="space-y-5">
            <OtpSignIn onSignedIn={handleOtpSignedIn} />
            <div className="flex items-center gap-3 py-1">
              <hr className="flex-1 border-t border-gold-600/20" />
              <span className="text-xs uppercase tracking-wide text-muted">or</span>
              <hr className="flex-1 border-t border-gold-600/20" />
            </div>
            <button
              type="button"
              onClick={() => {
                setMethod('password');
                setErrorMsg(null);
              }}
              className="text-sm text-muted underline-offset-2 transition hover:text-gold-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ← Sign in with a password instead
            </button>
            <p className="text-sm text-muted">
              New here?{' '}
              <Link
                href="/register"
                className="font-medium text-gold-600 transition hover:text-gold-700 hover:underline dark:hover:text-gold-300"
              >
                Create an account →
              </Link>
            </p>
          </div>
        ) : (
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
            {errorMsg ? <AuthError>{errorMsg}</AuthError> : null}
            <Button type="submit" variant="royal" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <div className="flex items-center gap-3 py-2">
              <hr className="flex-1 border-t border-gold-600/20" />
              <span className="text-xs uppercase tracking-wide text-muted">or</span>
              <hr className="flex-1 border-t border-gold-600/20" />
            </div>
            <GoogleSignInButton
              onSignedIn={async () => {
                // The button has already populated auth-store. Use the
                // store's value to make the post-auth routing decision.
                const { getAccessToken } = await import('../../lib/auth-store');
                const token = getAccessToken();
                if (!token) return;
                const { destination } = await decidePostAuthDestination(token);
                router.push(destination as never);
              }}
              onError={(msg) => setErrorMsg(msg)}
            />
            {/* Dev-only fake provider — OFF by default so the login is
                real. Opt in with NEXT_PUBLIC_ENABLE_MOCK_AUTH=1 when you
                need a no-Google local shortcut. */}
            {process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === '1' ? (
              <Button
                type="button"
                variant="outline"
                disabled={oauthMutation.isPending}
                onClick={signInWithMockProvider}
                className="w-full justify-center"
              >
                {oauthMutation.isPending ? 'Signing in…' : 'Sign in with mock provider (dev only)'}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMethod('otp');
                setErrorMsg(null);
              }}
              className="w-full rounded-xl border border-gold-600/25 px-4 py-2 text-sm font-medium transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Email or text me a one-time code instead
            </button>
            <p className="text-sm text-muted">
              New here?{' '}
              <Link
                href="/register"
                className="font-medium text-gold-600 transition hover:text-gold-700 hover:underline dark:hover:text-gold-300"
              >
                Create an account →
              </Link>
            </p>
            <p className="text-sm">
              <Link
                href={'/login/forgot' as never}
                className="text-muted underline-offset-2 transition hover:text-gold-600 hover:underline"
              >
                Trouble signing in?
              </Link>
            </p>
          </form>
        )
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
          {errorMsg ? <AuthError>{errorMsg}</AuthError> : null}
          <div className="flex gap-3">
            <Button type="submit" variant="royal" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Verifying…' : 'Verify'}
            </Button>
            <Button type="button" variant="ghost" onClick={backToCredentials}>
              Back
            </Button>
          </div>
          <p className="text-sm">
            <Link
              href={'/login/mfa-recover' as never}
              className="text-muted underline-offset-2 transition hover:text-gold-600 hover:underline"
            >
              Lost your authenticator? Use a backup code →
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

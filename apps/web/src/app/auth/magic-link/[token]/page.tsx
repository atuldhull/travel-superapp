/**
 * Magic-link consumer. The user clicks the link in their inbox →
 * lands here → we POST the token to /auth/magic-link/consume → on
 * success drop the access token into auth-store + redirect to /trips
 * (mirrors the password-login flow).
 *
 * Auth posture: this page is intentionally NOT protected — the whole
 * point is unauthenticated callers turn the URL token into a session.
 *
 * The consume mutation auto-fires on mount (no button) so the URL
 * is the action. Errors render with a friendly recovery path back to
 * /register or /login.
 *
 * Installed by prompt [V.UX.2].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Loader2, Sparkles } from 'lucide-react';
import {
  useAuthControllerMagicLinkConsume,
  type AuthSuccessResponseDto,
  type MagicLinkConsumeRequestDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { setAccessToken } from '../../../../lib/auth-store';
import { decidePostAuthDestination } from '../../../../lib/post-auth-redirect';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function MagicLinkConsumePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guard against React strict-mode + double-fire: the consume mutation
  // is single-use and a duplicate POST would always fail with
  // MAGIC_LINK_INVALID. We pin the call to one shot per mount.
  const fired = useRef(false);

  const mutation = useAuthControllerMagicLinkConsume({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        // First-time magic-link sign-ins create a new password-less
        // user → hasSeenOnboarding=false → /onboarding. Existing users
        // may have already onboarded → /trips.
        const { destination } = await decidePostAuthDestination(body.accessToken);
        // Tiny delay so the user sees the "Signing you in…" state
        // confirm before the page swap.
        setTimeout(() => router.push(destination as never), 300);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          e.code === 'MAGIC_LINK_INVALID'
            ? 'This sign-in link has expired or already been used. Request a fresh one below.'
            : `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Sign-in failed.'}`,
        );
      },
    },
  });

  useEffect(() => {
    if (fired.current) return;
    if (!token) return;
    fired.current = true;
    const data: MagicLinkConsumeRequestDto = { token };
    mutation.mutate({ data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (errorMsg) {
    return (
      <main className="space-y-8">
        {/* Cinematic royal header band — matches the rest of the app. */}
        <header
          className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
          style={{ backgroundImage: 'var(--gradient-royal)' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
          />
          <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
            <KeyRound aria-hidden className="h-3.5 w-3.5" /> Magic link
          </p>
          <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Sign-in link didn&apos;t work
          </h1>
          <p className="relative mt-2 max-w-lg text-sm text-white/65">
            No worries — request a fresh one and you&apos;ll be in within seconds.
          </p>
        </header>

        <Card depth="raised">
          <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {errorMsg}
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-gold-700 underline-offset-4 transition hover:text-gold-600 hover:underline dark:text-gold-300"
            >
              Request a fresh sign-in link <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
            <p className="text-sm text-muted">
              Or{' '}
              <Link
                href="/login"
                className="text-gold-700 underline-offset-4 transition hover:text-gold-600 hover:underline dark:text-gold-300"
              >
                sign in with email + password
              </Link>
              .
            </p>
          </div>
        </Card>
      </main>
    );
  }

  if (mutation.isSuccess) {
    return (
      <main className="space-y-8">
        {/* Cinematic royal header band — matches the rest of the app. */}
        <header
          className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
          style={{ backgroundImage: 'var(--gradient-royal)' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
          />
          <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
            <Sparkles aria-hidden className="h-3.5 w-3.5" /> Magic link
          </p>
          <h1 className="relative mt-3 inline-flex items-center gap-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            <CheckCircle2 aria-hidden className="h-8 w-8 text-gold-300 sm:h-10 sm:w-10" />
            You&apos;re signed in!
          </h1>
          <p className="relative mt-2 max-w-lg text-sm text-white/65">Taking you to your trips…</p>
        </header>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches the rest of the app. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <KeyRound aria-hidden className="h-3.5 w-3.5" /> Magic link
        </p>
        <h1 className="relative mt-3 inline-flex items-center gap-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          <Loader2 aria-hidden className="h-7 w-7 animate-spin text-gold-300 sm:h-9 sm:w-9" />
          Signing you in…
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Verifying your magic link. This usually takes less than a second.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Hold tight</CardTitle>
          <CardSubtitle>
            We&apos;re turning your link into a secure session — no password needed.
          </CardSubtitle>
        </CardHeader>
      </Card>
    </main>
  );
}

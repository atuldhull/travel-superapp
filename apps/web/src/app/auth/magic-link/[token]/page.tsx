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
import {
  useAuthControllerMagicLinkConsume,
  type AuthSuccessResponseDto,
  type MagicLinkConsumeRequestDto,
} from '@app/sdk';
import { setAccessToken } from '../../../../lib/auth-store';

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
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        // Redirect after a tiny delay so the user sees the "Signing
        // you in…" state confirm before the page swap.
        setTimeout(() => router.push('/trips'), 300);
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
      <main className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Sign-in link didn't work</h1>
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </p>
        <p className="text-sm text-muted">
          <Link href="/register" className="text-brand hover:underline">
            Request a fresh sign-in link →
          </Link>
        </p>
        <p className="text-sm text-muted">
          Or{' '}
          <Link href="/login" className="text-brand hover:underline">
            sign in with email + password
          </Link>
          .
        </p>
      </main>
    );
  }

  if (mutation.isSuccess) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">
          <span aria-hidden className="mr-1.5">
            ✅
          </span>
          You're signed in!
        </h1>
        <p className="text-sm text-muted">Taking you to your trips…</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Signing you in…</h1>
      <p className="text-sm text-muted">
        Verifying your magic link. This usually takes less than a second.
      </p>
    </main>
  );
}

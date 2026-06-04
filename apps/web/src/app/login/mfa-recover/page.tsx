/**
 * V.UX.31 — MFA recovery page. The recovery flow itself is handled
 * by the existing `/login` POST: send `{email, password, mfaCode}`
 * where `mfaCode` is one of the user's 8-character backup codes
 * (the LoginUseCase regex routes shape `\d{6}` → TOTP, shape
 * `[A-Za-z0-9]{8}` → backup code). On success the backup code is
 * marked as consumed in the database (single-use).
 *
 * This page is a documentation-first surface — it explains how to
 * use a backup code, then forwards the user to /login with a hint
 * to start the credentials step.
 *
 * Installed by prompt [V.UX.31]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, cinematic header
 * band).
 */
'use client';

import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';

export default function MfaRecoverPage() {
  return (
    <main className="space-y-8">
      <p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted outline-none transition hover:text-gold-600 focus-visible:ring-2 focus-visible:ring-gold-500/25"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to sign-in
        </Link>
      </p>

      {/* Cinematic royal header band — matches /account + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <KeyRound aria-hidden className="h-3.5 w-3.5" /> Account recovery
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Lost your authenticator app?
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          No access to your TOTP codes? Your single-use backup codes will get you back in.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Use one of your 8-character backup codes</CardTitle>
          <CardSubtitle>
            We issued 10 single-use codes when you turned on MFA. Each one works exactly once.
          </CardSubtitle>
        </CardHeader>
        <ol className="ml-5 list-decimal space-y-2 text-sm text-surface-foreground">
          <li>
            <Link
              href="/login"
              className="text-gold-600 underline-offset-2 transition hover:text-gold-700 hover:underline"
            >
              Sign in
            </Link>{' '}
            with your email + password as usual.
          </li>
          <li>When the MFA prompt appears, paste a backup code instead of the 6-digit TOTP.</li>
          <li>
            That backup code is now consumed. We&apos;ll log a warning and surface the remaining
            count in the api log so you know how many recoveries you have left.
          </li>
          <li>
            Once you&apos;re signed in, regenerate fresh codes from{' '}
            <Link
              href={'/account/preferences' as never}
              className="text-gold-600 underline-offset-2 transition hover:text-gold-700 hover:underline"
            >
              Account preferences
            </Link>{' '}
            (or wire up a new authenticator).
          </li>
        </ol>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>No backup codes left?</CardTitle>
          <CardSubtitle>
            Email{' '}
            <a
              href="mailto:support@travelsuperapp.local"
              className="text-gold-600 underline-offset-2 transition hover:text-gold-700 hover:underline"
            >
              support@travelsuperapp.local
            </a>{' '}
            from the address tied to the account.
          </CardSubtitle>
        </CardHeader>
        <p className="text-sm text-surface-foreground">
          We verify identity via past trip details, last-known email + IP fingerprint, and a signed
          receipt from any trip you&apos;ve completed. Recovery decisions are human-reviewed;
          turnaround is 1–2 business days.
        </p>
      </Card>
    </main>
  );
}

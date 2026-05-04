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
 * Installed by prompt [V.UX.31].
 */
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';

export default function MfaRecoverPage() {
  return (
    <main className="space-y-6">
      <p>
        <Link href="/login" className="text-sm text-muted hover:underline">
          ← Back to sign-in
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Lost your authenticator app?</h1>
      <Card>
        <CardHeader>
          <CardTitle>Use one of your 8-character backup codes</CardTitle>
          <CardSubtitle>
            We issued 10 single-use codes when you turned on MFA. Each one works exactly once.
          </CardSubtitle>
        </CardHeader>
        <ol className="ml-5 list-decimal space-y-2 text-sm">
          <li>
            <Link href="/login" className="text-brand underline-offset-2 hover:underline">
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
              className="text-brand underline-offset-2 hover:underline"
            >
              Account preferences
            </Link>{' '}
            (or wire up a new authenticator).
          </li>
        </ol>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>No backup codes left?</CardTitle>
          <CardSubtitle>
            Email{' '}
            <a
              href="mailto:support@travelsuperapp.local"
              className="text-brand underline-offset-2 hover:underline"
            >
              support@travelsuperapp.local
            </a>{' '}
            from the address tied to the account.
          </CardSubtitle>
        </CardHeader>
        <p className="text-sm">
          We verify identity via past trip details, last-known email + IP fingerprint, and a signed
          receipt from any trip you&apos;ve completed. Recovery decisions are human-reviewed;
          turnaround is 1–2 business days.
        </p>
      </Card>
    </main>
  );
}

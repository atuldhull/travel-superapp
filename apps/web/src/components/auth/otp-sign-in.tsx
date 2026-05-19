/**
 * OtpSignIn — passwordless one-time-code sign-in (Phase 1, B1/B2).
 *
 * Email **or** phone → we send a 6-digit code → enter it → signed in.
 * No password. Works for new and existing users (the API
 * find-or-creates). Talks to POST /auth/otp/request + /auth/otp/verify
 * via `apiFetch`-direct (the endpoints are additive — no SDK regen),
 * mirroring GoogleSignInButton: it populates the in-memory auth-store
 * then calls `onSignedIn(token)` so the page owns the redirect.
 *
 * Honest copy (B3): codes are enumeration-safe (we always say "sent");
 * the session is remembered on this device via the httpOnly refresh
 * cookie — no extra "remember me" checkbox needed.
 *
 * Installed for Phase 1 — Onboarding & Identity (page B frontend).
 */
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@app/sdk';
import { Button } from '../ui/button';
import { Field } from '../ui/input';
import { AuthError } from './auth-shell';
import { setAccessToken } from '../../lib/auth-store';

type Channel = 'email' | 'phone';
type Step = 'request' | 'verify';

interface VerifyEnvelope {
  readonly data: { readonly accessToken: string; readonly userId: string };
}

export interface OtpSignInProps {
  /** Called after the access token is in auth-store (page redirects). */
  readonly onSignedIn: (accessToken: string) => void | Promise<void>;
}

const RESEND_COOLDOWN_S = 30;

export function OtpSignIn({ onSignedIn }: OtpSignInProps) {
  const [channel, setChannel] = useState<Channel>('email');
  const [step, setStep] = useState<Step>('request');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function requestCode(): Promise<void> {
    if (!destination.trim()) {
      setError(channel === 'email' ? 'Enter your email.' : 'Enter your phone number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, destination: destination.trim() }),
      });
      setStep('verify');
      setCooldown(RESEND_COOLDOWN_S);
      setInfo(
        channel === 'email'
          ? `If that email can sign in, a 6-digit code is on its way.`
          : `If that number can sign in, we just texted a 6-digit code.`,
      );
    } catch (e) {
      const er = e as { code?: string; message?: string };
      setError(
        er.code === 'VALIDATION_FAILED'
          ? `That ${channel} doesn't look right.`
          : er.message || 'Could not send a code. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(): Promise<void> {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = (await apiFetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, destination: destination.trim(), code }),
      })) as VerifyEnvelope;
      const token = res.data.accessToken;
      setAccessToken(token);
      await onSignedIn(token);
    } catch (e) {
      const er = e as { code?: string; message?: string };
      setError(
        er.code === 'LOGIN_CODE_INVALID'
          ? 'That code is wrong or expired. Request a new one.'
          : er.message || 'Could not verify the code.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (step === 'verify') {
    return (
      <div className="space-y-4">
        {info ? <p className="text-sm text-muted">{info}</p> : null}
        <Field
          label="6-digit code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          pattern="\d{6}"
          required
          help={`Sent to ${destination.trim()}.`}
        />
        {error ? <AuthError>{error}</AuthError> : null}
        <Button
          type="button"
          variant="royal"
          disabled={busy}
          onClick={verifyCode}
          className="w-full justify-center"
        >
          {busy ? 'Verifying…' : 'Verify & sign in'}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('request');
              setCode('');
              setError(null);
              setInfo(null);
            }}
            className="text-muted underline-offset-2 transition hover:text-gold-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ← Use a different {channel}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || busy}
            onClick={requestCode}
            className="text-gold-600 underline-offset-2 transition hover:underline disabled:text-muted disabled:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-gold-600/20 bg-surface p-0.5 text-xs">
        {(
          [
            ['email', 'Email code'],
            ['phone', 'Phone'],
          ] as const
        ).map(([c, label]) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setChannel(c);
              setDestination('');
              setError(null);
            }}
            aria-pressed={channel === c}
            className={
              'rounded-full px-3 py-1 font-medium transition ' +
              (channel === c
                ? 'text-brand-900 shadow-(--shadow-depth-1)'
                : 'text-muted hover:text-surface-foreground')
            }
            style={channel === c ? { backgroundImage: 'var(--gradient-gold)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      {channel === 'email' ? (
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
      ) : (
        <Field
          label="Phone number"
          type="tel"
          autoComplete="tel"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="+15551234567"
          help="Include your country code, e.g. +1…"
          required
        />
      )}
      {error ? <AuthError>{error}</AuthError> : null}
      <Button
        type="button"
        variant="royal"
        disabled={busy}
        onClick={requestCode}
        className="w-full justify-center"
      >
        {busy ? 'Sending…' : 'Send me a code'}
      </Button>
      <p className="text-xs text-muted">
        No password needed. You can use email, phone, Google, or a password — any of them, on the
        same account. We keep you signed in on this device.
      </p>
    </div>
  );
}

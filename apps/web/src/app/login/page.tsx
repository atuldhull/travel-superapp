/**
 * Login page. Email + password (no MFA UI yet — MFA_REQUIRED comes
 * back as 401 and surfaces in the inline error today; the second-call
 * MFA prompt lands in a follow-up slice).
 *
 * Auth posture (CLAUDE rule 12):
 *   - Access token goes into the in-memory `auth-store` only.
 *   - Refresh cookie is set by the api on `/api/v1/auth` — httpOnly
 *     so client JS can never read it.
 *   - On hard reload the user is "logged out" until silent-refresh
 *     wiring lands in a follow-up slice.
 *
 * Installed by prompt [IV.18.19.21].
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
        // apiFetch returns the parsed body directly; orval's envelope
        // type wraps it in `{ data, status, headers }` but the runtime
        // shape is the body. Cast through unknown documents the gap.
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
          onChange={setEmail}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

interface FieldProps {
  readonly label: string;
  readonly type: 'email' | 'password';
  readonly autoComplete: string;
  readonly value: string;
  readonly required?: boolean;
  readonly onChange: (next: string) => void;
}

function Field({ label, type, autoComplete, value, required, onChange }: FieldProps) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm text-surface-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

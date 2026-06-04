/**
 * V.UX.13 — trusted-contacts CRUD for the safety-first persona.
 * Pre-set up to 3 contacts; on SOS trigger they all get notified
 * via the stub SMS adapter.
 *
 * Shape mirrors the rest of the owner-side surfaces:
 *   - useAuthBootComplete + useAuthToken to hold redirects until the
 *     silent-refresh has had a chance.
 *   - useTrustedContactsControllerList / Add / Remove.
 *   - Cap of 3 enforced server-side; the form disables itself when
 *     the count is already 3 so the user can't try and fail.
 *
 * Installed by prompt [V.UX.13].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  getTrustedContactsControllerListQueryKey,
  useTrustedContactsControllerAdd,
  useTrustedContactsControllerList,
  useTrustedContactsControllerRemove,
  type AddTrustedContactRequestDto,
  type ListTrustedContactsResponseDto,
  type TrustedContactDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const MAX_CONTACTS = 3;

export default function TrustedContactsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useTrustedContactsControllerList({
    query: { enabled: token !== null },
  });

  async function refreshList() {
    await queryClient.invalidateQueries({
      queryKey: getTrustedContactsControllerListQueryKey(),
    });
  }

  function showError(err: unknown, fallback: string) {
    const e = err as ApiError;
    setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? fallback}`);
  }

  const addMutation = useTrustedContactsControllerAdd({
    mutation: {
      onSuccess: async () => {
        await refreshList();
        setName('');
        setPhone('');
        setEmail('');
        setErrorMsg(null);
      },
      onError: (err: unknown) => showError(err, 'Add failed.'),
    },
  });

  const removeMutation = useTrustedContactsControllerRemove({
    mutation: {
      onSuccess: async () => {
        await refreshList();
        setErrorMsg(null);
      },
      onError: (err: unknown) => showError(err, 'Remove failed.'),
    },
  });

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }
  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }
  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn&apos;t load contacts ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
      </main>
    );
  }

  const body = data?.data as unknown as ListTrustedContactsResponseDto | undefined;
  const contacts: readonly TrustedContactDto[] = body?.contacts ?? [];
  const atCap = contacts.length >= MAX_CONTACTS;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length === 0) {
      setErrorMsg('Name is required.');
      return;
    }
    if (trimmedPhone.length === 0 && trimmedEmail.length === 0) {
      setErrorMsg('Phone or email is required so we can notify them.');
      return;
    }
    const data: AddTrustedContactRequestDto = {
      name: trimmedName,
      ...(trimmedPhone.length > 0
        ? { phone: trimmedPhone as unknown as AddTrustedContactRequestDto['phone'] }
        : {}),
      ...(trimmedEmail.length > 0
        ? { email: trimmedEmail as unknown as AddTrustedContactRequestDto['email'] }
        : {}),
    };
    addMutation.mutate({ data });
  }

  return (
    <main className="space-y-8">
      <p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Home
        </Link>
      </p>

      {/* Cinematic royal header band — matches /account + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Safety circle
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Trusted contacts
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Up to {MAX_CONTACTS} people who&apos;ll get a message with your live location when you tap
          the SOS button. Phone or email — at least one.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Your circle
            <Badge variant="gold">
              {contacts.length}/{MAX_CONTACTS} used
            </Badge>
          </CardTitle>
        </CardHeader>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">No contacts yet — add one below.</p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold tracking-tight text-surface-foreground">
                    {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {(c.phone as unknown as string | null) ?? '—'} ·{' '}
                    {(c.email as unknown as string | null) ?? '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate({ id: c.id })}
                  disabled={removeMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-danger/25 px-3 py-1 text-xs text-danger transition hover:bg-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50"
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Add a contact</CardTitle>
          {atCap ? (
            <CardSubtitle>
              You&apos;ve added the maximum of {MAX_CONTACTS}. Remove one to add another.
            </CardSubtitle>
          ) : null}
        </CardHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            disabled={atCap}
          />
          <Field
            label="Phone (optional if email set)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            disabled={atCap}
            placeholder="+15551234567"
          />
          <Field
            label="Email (optional if phone set)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            disabled={atCap}
            placeholder="someone@example.com"
          />
          {errorMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" variant="royal" disabled={atCap || addMutation.isPending}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {addMutation.isPending ? 'Adding…' : 'Add contact'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

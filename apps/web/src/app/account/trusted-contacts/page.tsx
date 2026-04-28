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
import {
  getTrustedContactsControllerListQueryKey,
  useTrustedContactsControllerAdd,
  useTrustedContactsControllerList,
  useTrustedContactsControllerRemove,
  type AddTrustedContactRequestDto,
  type ListTrustedContactsResponseDto,
  type TrustedContactDto,
} from '@app/sdk';
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
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load contacts ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
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
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Home
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>🛡️ Trusted contacts</CardTitle>
          <CardSubtitle>
            Up to {MAX_CONTACTS} people who'll get a message with your live location when you tap
            the SOS button. Phone or email — at least one.
          </CardSubtitle>
        </CardHeader>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">No contacts yet — add one below.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-md border border-muted/15 bg-muted/5 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {(c.phone as unknown as string | null) ?? '—'} ·{' '}
                    {(c.email as unknown as string | null) ?? '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate({ id: c.id })}
                  disabled={removeMutation.isPending}
                  className="text-xs text-danger hover:underline disabled:opacity-50"
                  aria-label={`Remove ${c.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          {contacts.length}/{MAX_CONTACTS} contacts used.
        </p>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add a contact</CardTitle>
          {atCap ? (
            <CardSubtitle>
              You've added the maximum of {MAX_CONTACTS}. Remove one to add another.
            </CardSubtitle>
          ) : null}
        </CardHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              disabled={atCap}
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            />
          </Field>
          <Field label="Phone (optional if email set)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              disabled={atCap}
              placeholder="+15551234567"
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            />
          </Field>
          <Field label="Email (optional if phone set)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              disabled={atCap}
              placeholder="someone@example.com"
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            />
          </Field>
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={atCap || addMutation.isPending}>
            {addMutation.isPending ? 'Adding…' : 'Add contact'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

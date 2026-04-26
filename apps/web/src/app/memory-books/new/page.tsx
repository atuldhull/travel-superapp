/**
 * Owner-scoped "create memory book" form — `/memory-books/new`.
 * Posts via the typed `useMemoryBookControllerCreate` mutation
 * landed in slice .19.51, then redirects to the edit page for the
 * fresh book.
 *
 * Same auth pattern as the index/edit pages: silent-refresh boot
 * completes first, then bounce to /login if no token.
 *
 * Installed by prompt [IV.18.19.54].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMemoryBookControllerListQueryKey,
  useMemoryBookControllerCreate,
  type CreateMemoryBookRequestDto,
  type MemoryBookDto,
} from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function NewMemoryBookPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('minimal');
  const [coverS3Key, setCoverS3Key] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const createMutation = useMemoryBookControllerCreate({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        await queryClient.invalidateQueries({
          queryKey: getMemoryBookControllerListQueryKey({ limit: '50' }),
        });
        const created = response.data as MemoryBookDto | undefined;
        if (created?.id) {
          router.push(`/memory-books/${created.id}/edit` as never);
        } else {
          router.push('/memory-books');
        }
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Create failed.'}`);
      },
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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setErrorMsg('Title is required.');
      return;
    }
    const data: CreateMemoryBookRequestDto = { title: trimmed };
    if (theme.trim()) data.theme = theme.trim();
    if (coverS3Key.trim()) {
      data.coverS3Key = coverS3Key.trim() as unknown as CreateMemoryBookRequestDto['coverS3Key'];
    }
    createMutation.mutate({ data });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/memory-books" className="text-sm text-muted hover:underline">
          ← Back to your books
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>New memory book</CardTitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              maxLength={120}
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Theme">
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={32}
              placeholder="minimal"
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Cover S3 key (optional)">
            <input
              type="text"
              value={coverS3Key}
              onChange={(e) => setCoverS3Key(e.target.value)}
              maxLength={512}
              placeholder="leave blank if you don't have one yet"
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create book'}
            </Button>
            <Link
              href="/memory-books"
              className="inline-flex items-center px-3 py-1.5 text-sm text-muted hover:underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}

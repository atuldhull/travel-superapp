/**
 * Owner-scoped "create memory book" form — `/memory-books/new`.
 * Posts via the typed `useMemoryBookControllerCreate` mutation
 * landed in slice .19.51, then redirects to the edit page for the
 * fresh book.
 *
 * Same auth pattern as the index/edit pages: silent-refresh boot
 * completes first, then bounce to /login if no token.
 *
 * Installed by prompt [IV.18.19.54]; restyled into the v2 ("Fusion")
 * design language (royal header band + gold tokens + font-display).
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react';
import {
  getMemoryBookControllerListQueryKey,
  useMemoryBookControllerCreate,
  type CreateMemoryBookRequestDto,
  type MemoryBookDto,
} from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

// Shared gold-tokened field styling so every input reads as one set.
const FIELD =
  'w-full rounded-xl border border-gold-600/25 bg-surface px-3.5 py-2.5 text-sm text-surface-foreground outline-none transition placeholder:text-muted/70 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <BookOpen aria-hidden className="h-3.5 w-3.5" /> New memory book
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Start a new book
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Give your memories a home — name it, pick a theme, and start filling its pages.
        </p>
      </header>

      <p>
        <Link
          href="/memory-books"
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to your books
        </Link>
      </p>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Book details</CardTitle>
          <CardSubtitle>
            Only a title is required — everything else you can change later.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="mb-title" className="block space-y-1.5">
            <span className="block text-sm font-medium text-surface-foreground">Title</span>
            <input
              id="mb-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              maxLength={120}
              className={FIELD}
            />
          </label>
          <label htmlFor="mb-theme" className="block space-y-1.5">
            <span className="block text-sm font-medium text-surface-foreground">Theme</span>
            <input
              id="mb-theme"
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={32}
              placeholder="minimal"
              className={FIELD}
            />
          </label>
          <label htmlFor="mb-cover" className="block space-y-1.5">
            <span className="block text-sm font-medium text-surface-foreground">
              Cover S3 key <span className="text-muted">(optional)</span>
            </span>
            <input
              id="mb-cover"
              type="text"
              value={coverS3Key}
              onChange={(e) => setCoverS3Key(e.target.value)}
              maxLength={512}
              placeholder="leave blank if you don't have one yet"
              className={FIELD}
            />
          </label>
          {errorMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" variant="royal" disabled={createMutation.isPending}>
              <Sparkles aria-hidden className="mr-1.5 h-4 w-4" />
              {createMutation.isPending ? 'Creating…' : 'Create book'}
            </Button>
            <Link
              href="/memory-books"
              className="inline-flex items-center text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}

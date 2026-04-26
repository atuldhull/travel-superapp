/**
 * Owner-scoped memory-book detail+edit page —
 * `/memory-books/:id/edit`. Mirrors the trip detail edit pattern:
 * read view + inline edit form + publish/unpublish + delete with
 * confirmation gate. Auth-bouncing matches `/memory-books`.
 *
 * Relies on the typed hooks landed in slice .19.51:
 *   useMemoryBookControllerGetOne   → MemoryBookWithAssetsResponseDto
 *   useMemoryBookControllerUpdate   → MemoryBookDto
 *   useMemoryBookControllerPublish  → MemoryBookDto
 *   useMemoryBookControllerUnpublish → MemoryBookDto
 *   useMemoryBookControllerRemove   → 204
 *
 * Cache invalidation pattern matches the trip detail page: invalidate
 * BOTH the detail key AND the list key on every successful mutation
 * so /memory-books reflects the change on next visit.
 *
 * Installed by prompt [IV.18.19.53].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMemoryBookControllerGetOneQueryKey,
  getMemoryBookControllerListQueryKey,
  useMediaControllerAttachToBook,
  useMediaControllerDownloadUrl,
  useMemoryBookControllerGetOne,
  useMemoryBookControllerPublish,
  useMemoryBookControllerRemove,
  useMemoryBookControllerUnpublish,
  useMemoryBookControllerUpdate,
  type AttachMediaToBookRequestDto,
  type MediaDownloadUrlResponseDto,
  type MemoryBookDto,
  type MemoryBookWithAssetsResponseDto,
  type UpdateMemoryBookRequestDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function MemoryBookEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useMemoryBookControllerGetOne(id, {
    query: { enabled: token !== null && id !== '' && !editing },
  });

  async function invalidateBookCaches() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getMemoryBookControllerGetOneQueryKey(id) }),
      queryClient.invalidateQueries({
        queryKey: getMemoryBookControllerListQueryKey({ limit: '50' }),
      }),
    ]);
  }

  function onMutateError(err: unknown, fallback: string) {
    const e = err as ApiError;
    setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? fallback}`);
  }

  const updateMutation = useMemoryBookControllerUpdate({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setEditing(false);
        setErrorMsg(null);
      },
      onError: (err: unknown) => onMutateError(err, 'Update failed.'),
    },
  });

  const publishMutation = useMemoryBookControllerPublish({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setErrorMsg(null);
      },
      onError: (err: unknown) => onMutateError(err, 'Publish failed.'),
    },
  });

  const unpublishMutation = useMemoryBookControllerUnpublish({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setErrorMsg(null);
      },
      onError: (err: unknown) => onMutateError(err, 'Unpublish failed.'),
    },
  });

  const deleteMutation = useMemoryBookControllerRemove({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getMemoryBookControllerListQueryKey({ limit: '50' }),
        });
        router.push('/memory-books');
      },
      onError: (err: unknown) => onMutateError(err, 'Delete failed.'),
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
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load memory book ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
        <p>
          <Link href="/memory-books" className="text-sm text-muted hover:underline">
            ← Back to your books
          </Link>
        </p>
      </main>
    );
  }

  const body = data?.data as unknown as MemoryBookWithAssetsResponseDto | undefined;
  const book = body?.book as MemoryBookDto;
  const assetIds = body?.assetIds ?? [];

  return (
    <main className="space-y-6">
      <p>
        <Link href="/memory-books" className="text-sm text-muted hover:underline">
          ← Back to your books
        </Link>
      </p>
      {editing ? (
        <EditForm
          book={book}
          isPending={updateMutation.isPending}
          errorMsg={errorMsg}
          onCancel={() => {
            setEditing(false);
            setErrorMsg(null);
          }}
          onSubmit={(patch) => updateMutation.mutate({ id, data: patch })}
        />
      ) : (
        <ReadView
          book={book}
          assetCount={assetIds.length}
          publishPending={publishMutation.isPending}
          unpublishPending={unpublishMutation.isPending}
          onEdit={() => {
            setEditing(true);
            setErrorMsg(null);
          }}
          onPublish={() => publishMutation.mutate({ id })}
          onUnpublish={() => unpublishMutation.mutate({ id })}
          onAskDelete={() => {
            setConfirmDelete(true);
            setErrorMsg(null);
          }}
          errorMsg={errorMsg}
        />
      )}
      <AssetsSection bookId={id} assetIds={assetIds} />
      {confirmDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Delete this memory book?</CardTitle>
            <CardSubtitle>
              Attached media stay (their `memoryBookId` clears via SetNull). The book itself is gone
              for good.
            </CardSubtitle>
          </CardHeader>
          {errorMsg ? (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => deleteMutation.mutate({ id })}
              disabled={deleteMutation.isPending}
              className="bg-danger text-white hover:opacity-90"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(false);
                setErrorMsg(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </main>
  );
}

interface ReadViewProps {
  readonly book: MemoryBookDto;
  readonly assetCount: number;
  readonly publishPending: boolean;
  readonly unpublishPending: boolean;
  readonly onEdit: () => void;
  readonly onPublish: () => void;
  readonly onUnpublish: () => void;
  readonly onAskDelete: () => void;
  readonly errorMsg: string | null;
}

function ReadView({
  book,
  assetCount,
  publishPending,
  unpublishPending,
  onEdit,
  onPublish,
  onUnpublish,
  onAskDelete,
  errorMsg,
}: ReadViewProps) {
  const publishedAt = book.publishedAt as unknown as string | null;
  const coverS3Key = book.coverS3Key as unknown as string | null;
  const published = publishedAt !== null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{book.title}</CardTitle>
            <CardSubtitle>
              <Badge variant={published ? 'brand' : 'neutral'}>
                {published ? 'published' : 'draft'}
              </Badge>{' '}
              · Theme {book.theme} · {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
            </CardSubtitle>
          </div>
          <div className="flex gap-2">
            {published ? (
              <Link
                href={`/memory-books/${book.id}` as never}
                className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
              >
                Public view
              </Link>
            ) : null}
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            {published ? (
              <Button variant="ghost" size="sm" onClick={onUnpublish} disabled={unpublishPending}>
                {unpublishPending ? 'Unpublishing…' : 'Unpublish'}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={onPublish} disabled={publishPending}>
                {publishPending ? 'Publishing…' : 'Publish'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onAskDelete}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      {coverS3Key ? (
        <p className="mt-2 truncate text-xs text-muted">
          Cover: <code className="font-mono text-[10px]">{coverS3Key}</code>
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Created {new Date(book.createdAt).toLocaleString()} · Updated{' '}
        {new Date(book.updatedAt).toLocaleString()}
        {publishedAt ? ` · Published ${new Date(publishedAt).toLocaleString()}` : ''}
      </p>
      {errorMsg ? (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </p>
      ) : null}
    </Card>
  );
}

interface EditFormProps {
  readonly book: MemoryBookDto;
  readonly isPending: boolean;
  readonly errorMsg: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (patch: UpdateMemoryBookRequestDto) => void;
}

function EditForm({ book, isPending, errorMsg, onCancel, onSubmit }: EditFormProps) {
  const [title, setTitle] = useState(book.title);
  const [theme, setTheme] = useState(book.theme);
  const initialCover = (book.coverS3Key as unknown as string | null) ?? '';
  const [coverS3Key, setCoverS3Key] = useState(initialCover);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch: UpdateMemoryBookRequestDto = {};
    if (title !== book.title) patch.title = title;
    if (theme !== book.theme) patch.theme = theme;
    if (coverS3Key !== initialCover) {
      patch.coverS3Key = (coverS3Key.trim() === ''
        ? null
        : coverS3Key.trim()) as unknown as UpdateMemoryBookRequestDto['coverS3Key'];
    }
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSubmit(patch);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit memory book</CardTitle>
      </CardHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Theme">
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            required
            maxLength={32}
            className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Cover S3 key (optional)">
          <input
            type="text"
            value={coverS3Key}
            onChange={(e) => setCoverS3Key(e.target.value)}
            maxLength={512}
            placeholder="leave blank to clear"
            className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
          />
        </Field>
        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface AssetsSectionProps {
  readonly bookId: string;
  readonly assetIds: readonly string[];
}

function AssetsSection({ bookId, assetIds }: AssetsSectionProps) {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function invalidateBook() {
    await queryClient.invalidateQueries({
      queryKey: getMemoryBookControllerGetOneQueryKey(bookId),
    });
  }

  const attachMutation = useMediaControllerAttachToBook({
    mutation: {
      onSuccess: async () => {
        await invalidateBook();
        setPendingId('');
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Attach failed.'}`);
      },
    },
  });

  function attach(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = pendingId.trim();
    if (trimmed.length === 0) {
      setErrorMsg('Paste a media-asset id to attach.');
      return;
    }
    const data: AttachMediaToBookRequestDto = {
      memoryBookId: bookId as unknown as AttachMediaToBookRequestDto['memoryBookId'],
    };
    attachMutation.mutate({ id: trimmed, data });
  }

  function detach(assetId: string) {
    setErrorMsg(null);
    const data: AttachMediaToBookRequestDto = {
      memoryBookId: null as unknown as AttachMediaToBookRequestDto['memoryBookId'],
    };
    attachMutation.mutate({ id: assetId, data });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Assets</CardTitle>
          <Badge variant="neutral">{assetIds.length}</Badge>
        </div>
        <CardSubtitle>
          Attach media you've already uploaded to a trip — paste its id below. Use the trip media
          subsection to upload new files.
        </CardSubtitle>
      </CardHeader>
      <form onSubmit={attach} className="mb-4 flex gap-2">
        <input
          type="text"
          value={pendingId}
          onChange={(e) => setPendingId(e.target.value)}
          placeholder="media asset id (cuid)"
          className="flex-1 rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm font-mono"
        />
        <Button type="submit" variant="outline" size="sm" disabled={attachMutation.isPending}>
          {attachMutation.isPending ? 'Attaching…' : 'Attach'}
        </Button>
      </form>
      {errorMsg ? (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </p>
      ) : null}
      {assetIds.length === 0 ? (
        <p className="text-sm text-muted">No assets attached yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assetIds.map((aid) => (
            <OwnerAssetThumb
              key={aid}
              assetId={aid}
              onDetach={() => detach(aid)}
              detaching={attachMutation.isPending}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

interface OwnerAssetThumbProps {
  readonly assetId: string;
  readonly onDetach: () => void;
  readonly detaching: boolean;
}

function OwnerAssetThumb({ assetId, onDetach, detaching }: OwnerAssetThumbProps) {
  const { data, isLoading, isError } = useMediaControllerDownloadUrl(assetId, {
    query: { retry: false, staleTime: 60_000 },
  });
  const url = (data?.data as unknown as MediaDownloadUrlResponseDto | undefined)?.url ?? null;

  return (
    <li className="flex flex-col rounded border border-muted/15 bg-muted/5 p-2 text-xs">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded bg-muted/20">
        {url ? (
          <img
            src={url}
            alt={`Asset ${assetId.slice(0, 8)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl" aria-label={isError ? 'failed to load' : 'loading'}>
            {isLoading ? '…' : isError ? '⚠️' : '🖼️'}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="truncate font-mono text-[10px] text-muted">{assetId.slice(0, 8)}…</span>
        <button
          type="button"
          onClick={onDetach}
          disabled={detaching}
          className="text-[10px] text-danger hover:underline disabled:opacity-50"
          aria-label={`Detach asset ${assetId.slice(0, 8)}`}
        >
          detach
        </button>
      </div>
    </li>
  );
}

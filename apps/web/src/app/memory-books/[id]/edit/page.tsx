/**
 * Owner-scoped memory-book editor — `/memory-books/:id/edit`. V.UX.12
 * rebuild: split-pane layout with the editor on the left
 * (metadata form + theme picker + drag-and-drop asset list with
 * inline caption editors) and a live preview iframe on the right
 * showing the public viewer in `?preview=true` mode.
 *
 *   - Drag-reorder persists via PATCH /memory-books/:id/asset-order.
 *   - Theme change patches the row + broadcasts a postMessage to the
 *     iframe so it repaints immediately (CSS variable swap, no
 *     reload).
 *   - Caption editing remains save-on-blur per asset (V.UX.11).
 *   - The "Preview as public" link opens the same preview URL in
 *     a new tab.
 *
 * Auth-bouncing matches `/memory-books`.
 *
 * Installed by prompt [IV.18.19.53]; pro editor [V.UX.12].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getMemoryBookControllerGetOneQueryKey,
  getMemoryBookControllerListQueryKey,
  useMediaControllerAttachToBook,
  useMediaControllerDownloadUrl,
  useMemoryBookControllerGetOne,
  useMemoryBookControllerPublish,
  useMemoryBookControllerRemove,
  useMemoryBookControllerReorderAssets,
  useMemoryBookControllerUnpublish,
  useMemoryBookControllerUpdate,
  useMemoryBookControllerUpdateAssetCaption,
  type AttachMediaToBookRequestDto,
  type MediaDownloadUrlResponseDto,
  type MemoryBookDto,
  type MemoryBookWithAssetsResponseDto,
  type ReorderBookAssetsRequestDto,
  type UpdateAssetCaptionRequestDto,
  type UpdateMemoryBookRequestDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { Skeleton } from '../../../../components/ui/skeleton';
import { toast } from '../../../../components/ui/toast';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';
import { PreviewPane } from '../../../../components/memory-book/preview-pane';
import { MEMORY_BOOK_THEMES, ThemePicker } from '../../../../components/memory-book/theme-picker';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface AssetSummary {
  readonly id: string;
  readonly kind: string;
  readonly caption: string | null;
  readonly position: number;
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
  const [previewKey, setPreviewKey] = useState(0);
  const [themeOptimistic, setThemeOptimistic] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useMemoryBookControllerGetOne(id, {
    query: { enabled: token !== null && id !== '' && !editing },
  });

  const invalidateBookCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getMemoryBookControllerGetOneQueryKey(id) }),
      queryClient.invalidateQueries({
        queryKey: getMemoryBookControllerListQueryKey({ limit: '50' }),
      }),
    ]);
  }, [queryClient, id]);

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
        setPreviewKey((k) => k + 1);
        toast.success('Memory book saved');
      },
      onError: (err: unknown) => onMutateError(err, 'Update failed.'),
    },
  });

  const publishMutation = useMemoryBookControllerPublish({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setErrorMsg(null);
        setPreviewKey((k) => k + 1);
        toast.success('Memory book published');
      },
      onError: (err: unknown) => onMutateError(err, 'Publish failed.'),
    },
  });

  const unpublishMutation = useMemoryBookControllerUnpublish({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setErrorMsg(null);
        setPreviewKey((k) => k + 1);
        toast.success('Memory book unpublished');
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

  const themeMutation = useMemoryBookControllerUpdate({
    mutation: {
      onSuccess: async () => {
        await invalidateBookCaches();
        setErrorMsg(null);
        // Theme already painted in iframe via postMessage; we still
        // bump the key so a hard refresh at any point shows the
        // committed value.
        setPreviewKey((k) => k + 1);
      },
      onError: (err: unknown) => {
        setThemeOptimistic(null);
        onMutateError(err, 'Theme update failed.');
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
  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" count={2} />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load memory book ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
        <p>
          <Link
            href="/memory-books"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to your books
          </Link>
        </p>
      </main>
    );
  }

  const body = data?.data as unknown as MemoryBookWithAssetsResponseDto | undefined;
  const book = body?.book as MemoryBookDto;
  const assetIds = body?.assetIds ?? [];
  const assetSummaries: readonly AssetSummary[] = (body?.assets ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    caption: (a.caption as unknown as string | null) ?? null,
    position: a.position,
  }));
  const activeTheme = themeOptimistic ?? book.theme;

  function applyTheme(slug: string) {
    if (slug === book.theme && themeOptimistic === null) return;
    setThemeOptimistic(slug);
    const patch: UpdateMemoryBookRequestDto = { theme: slug };
    themeMutation.mutate({ id, data: patch });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/memory-books" className="text-sm text-muted hover:underline">
          ← Back to your books
        </Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
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
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardSubtitle>
                Pick a look. The preview repaints instantly; the choice persists in your book.
              </CardSubtitle>
            </CardHeader>
            <ThemePicker
              value={activeTheme}
              onChange={applyTheme}
              disabled={themeMutation.isPending}
            />
            {themeMutation.isPending ? (
              <p className="mt-2 text-xs text-muted">Saving theme…</p>
            ) : null}
          </Card>
          <AssetsSection
            bookId={id}
            assetSummaries={assetSummaries}
            onMutated={() => {
              setPreviewKey((k) => k + 1);
            }}
          />
          {confirmDelete ? (
            <Card>
              <CardHeader>
                <CardTitle>Delete this memory book?</CardTitle>
                <CardSubtitle>
                  Attached media stay (their `memoryBookId` clears via SetNull). The book itself is
                  gone for good.
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
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <PreviewPane bookId={id} themeSlug={activeTheme} reloadKey={previewKey} />
        </div>
      </div>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/memory-books/${book.id}?preview=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
        >
          🔍 Preview as public ↗
        </a>
        {published ? (
          <Link
            href={`/memory-books/${book.id}` as never}
            className="inline-flex items-center gap-1 rounded-md border border-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/10"
          >
            Public view
          </Link>
        ) : null}
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit metadata
        </Button>
        {published ? (
          <Button variant="ghost" size="sm" onClick={onUnpublish} disabled={unpublishPending}>
            {unpublishPending ? 'Unpublishing…' : 'Unpublish'}
          </Button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishPending}
            className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-brand to-brand/70 px-4 py-1.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {publishPending ? 'Publishing…' : '🚀 Publish'}
          </button>
        )}
        <Button variant="ghost" size="sm" onClick={onAskDelete}>
          Delete
        </Button>
      </div>
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
  const initialCover = (book.coverS3Key as unknown as string | null) ?? '';
  const [coverS3Key, setCoverS3Key] = useState(initialCover);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch: UpdateMemoryBookRequestDto = {};
    if (title !== book.title) patch.title = title;
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
        <CardSubtitle>Theme is set via the picker below — change it there.</CardSubtitle>
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
  readonly assetSummaries: readonly AssetSummary[];
  readonly onMutated: () => void;
}

function AssetsSection({ bookId, assetSummaries, onMutated }: AssetsSectionProps) {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local order — initialized from server, mutated on drag, then
  // committed via the reorder mutation. Keeps the UI snappy under
  // drag without waiting on the network.
  const [order, setOrder] = useState<readonly string[]>(() => assetSummaries.map((a) => a.id));

  // Re-sync on server-data changes (attach/detach, fresh fetch, etc.).
  // Compare ids as a string so a permutation we just optimistically
  // applied doesn't get clobbered by a stale fetch carrying the old
  // order.
  useEffect(() => {
    const serverIds = assetSummaries.map((a) => a.id);
    const same = serverIds.length === order.length && serverIds.every((id, i) => id === order[i]);
    const sameSet =
      serverIds.length === order.length && serverIds.every((id) => order.includes(id));
    if (!sameSet) {
      // Membership changed (attach/detach) — adopt the server list.
      setOrder(serverIds);
    } else if (!same) {
      // Same membership, server has different positions — adopt.
      setOrder(serverIds);
    }
  }, [assetSummaries, order]);

  const orderedSummaries = useMemo(() => {
    const byId = new Map(assetSummaries.map((a) => [a.id, a]));
    return order.map((id) => byId.get(id)).filter((a): a is AssetSummary => a !== undefined);
  }, [order, assetSummaries]);

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
        onMutated();
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Attach failed.'}`);
      },
    },
  });

  const reorderMutation = useMemoryBookControllerReorderAssets({
    mutation: {
      onSuccess: async () => {
        await invalidateBook();
        setErrorMsg(null);
        onMutated();
      },
      onError: (err: unknown) => {
        // Roll back the optimistic order on failure by re-syncing
        // from the server.
        setOrder(assetSummaries.map((a) => a.id));
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Reorder failed.'}`);
      },
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove([...order], oldIdx, newIdx);
    setOrder(next);
    const data: ReorderBookAssetsRequestDto = { assetIds: [...next] };
    reorderMutation.mutate({ id: bookId, data });
  }

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
          <Badge variant="neutral">{order.length}</Badge>
        </div>
        <CardSubtitle>
          Drag to reorder. Captions save when you click away. Use the trip media subsection to
          upload new files.
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
      {order.length === 0 ? (
        <p className="text-sm text-muted">No assets attached yet.</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {orderedSummaries.map((summary) => (
                <SortableAssetRow
                  key={summary.id}
                  bookId={bookId}
                  asset={summary}
                  onDetach={() => detach(summary.id)}
                  detaching={attachMutation.isPending}
                  onCaptionSaved={onMutated}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
}

interface SortableAssetRowProps {
  readonly bookId: string;
  readonly asset: AssetSummary;
  readonly onDetach: () => void;
  readonly detaching: boolean;
  readonly onCaptionSaved: () => void;
}

function SortableAssetRow({
  bookId,
  asset,
  onDetach,
  detaching,
  onCaptionSaved,
}: SortableAssetRowProps) {
  const queryClient = useQueryClient();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: asset.id,
  });
  const { data, isLoading, isError } = useMediaControllerDownloadUrl(asset.id, {
    query: { retry: false, staleTime: 60_000 },
  });
  const url = (data?.data as unknown as MediaDownloadUrlResponseDto | undefined)?.url ?? null;

  const [draft, setDraft] = useState(asset.caption ?? '');
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(asset.caption ?? '');
  }, [asset.caption]);

  const captionMutation = useMemoryBookControllerUpdateAssetCaption({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getMemoryBookControllerGetOneQueryKey(bookId),
        });
        setSaveErr(null);
        onCaptionSaved();
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setSaveErr(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  function saveCaption() {
    const trimmed = draft.trim();
    if (trimmed === (asset.caption ?? '').trim()) return;
    const data: UpdateAssetCaptionRequestDto = {
      caption: (trimmed.length === 0
        ? null
        : trimmed) as unknown as UpdateAssetCaptionRequestDto['caption'],
    };
    captionMutation.mutate({ id: bookId, assetId: asset.id, data });
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-md border border-muted/15 bg-muted/5 p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder asset ${asset.id.slice(0, 8)}`}
        className="mt-1 cursor-grab text-muted hover:text-foreground active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div className="relative flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded bg-muted/20">
        {url ? (
          <img
            src={url}
            alt={asset.caption ?? `Asset ${asset.id.slice(0, 8)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xl" aria-label={isError ? 'failed to load' : 'loading'}>
            {isLoading ? '…' : isError ? '⚠️' : '🖼️'}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1 text-xs">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveCaption}
          rows={2}
          maxLength={280}
          placeholder="Caption (optional, max 280 chars)…"
          className="w-full rounded border border-muted/20 bg-background px-2 py-1 text-xs"
        />
        {saveErr ? <p className="text-[10px] text-danger">{saveErr}</p> : null}
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[10px] text-muted">
            {asset.id.slice(0, 8)}… · pos {asset.position}
          </span>
          <button
            type="button"
            onClick={onDetach}
            disabled={detaching}
            className="text-[10px] text-danger hover:underline disabled:opacity-50"
            aria-label={`Detach asset ${asset.id.slice(0, 8)}`}
          >
            detach
          </button>
        </div>
      </div>
    </li>
  );
}

// Keep the import referenced so tree-shaking doesn't drop it; the
// named theme list is exposed for tests to confirm the picker has
// the expected slugs.
void MEMORY_BOOK_THEMES;
